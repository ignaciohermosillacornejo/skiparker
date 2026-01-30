import type { Page } from 'playwright-core';
import type { AvailabilityResult, ReservationType, BookingResult } from '../types.js';
import { getUrls } from '../constants.js';
import { sleep, log } from './utils.js';
import {
  buildCalendarDaySelector,
  buildRateCardSelector,
  buildLotCardSelector,
  buildLotDiscoverySelector,
  parseAvailabilityFromStyle,
  CALENDAR_COLORS,
} from './selectors.js';

// Centralized selectors — stable patterns only (no CSS module hashes)
const SELECTORS = {
  // Mobiscroll Calendar — library classes, very stable
  calendar: '.mbsc-calendar',
  calendarNextBtn: '.custom-next',
  calendarDay: buildCalendarDaySelector,

  // Rate cards — uses imported builder
  activeRateContainer: '[class*="containerActive"]',
  rateCard: buildRateCardSelector,

  // Lot/zone cards — uses imported builder
  lotCard: buildLotCardSelector,
  lotDiscovery: buildLotDiscoverySelector(),

  // Checkout page (parking.honkmobile.com) — BEM classes, already stable
  checkoutContainer: '.CheckoutRoute',
  plateDisplay: '.CheckoutVehicleComponent--plate',
  editVehicleBtn: 'button[aria-label="Edit vehicle"]',
  termsCheckbox: 'input#terms',
  termsLabel: 'label[for="terms"]',
  continueBtn: '.CtaButton--container',

  // Post-checkout modals and errors
  overlapModal: '.ConflictConfirm',
  errorBox: '.TransactionProcessing--errorBox',
  errorCopy: '.TransactionProcessing--errorCopy',
  confirmBtn: 'button:has-text("Confirm")',
} as const;

export async function selectLot(page: Page, lotName: string, verbose = false): Promise<boolean> {
  log.verbose(`Selecting lot: ${lotName}`, verbose);
  const lotCard = await page.$(SELECTORS.lotCard(lotName));
  if (!lotCard) {
    log.verbose(`Lot "${lotName}" not found`, verbose);
    return false;
  }
  await lotCard.click();
  await sleep(1500);
  return true;
}

async function selectLotIfNeeded(page: Page, lotPreferences: string[] | undefined, verbose: boolean): Promise<void> {
  // Check if there are lot cards visible (multi-lot site)
  const lotCards = await page.$$(SELECTORS.lotDiscovery);
  if (lotCards.length === 0) {
    log.verbose('No lot selection needed (single-lot site)', verbose);
    return;
  }

  // Multi-lot site - select preferred lot or first available
  if (lotPreferences?.length) {
    for (const pref of lotPreferences) {
      if (await selectLot(page, pref, verbose)) {
        return;
      }
    }
    log.verbose('No preferred lots found, selecting first available', verbose);
  }

  // Select first lot
  const firstLot = lotCards[0];
  const lotName = (await firstLot.textContent())?.trim() || 'first lot';
  log.verbose(`Auto-selecting lot: ${lotName}`, verbose);
  await firstLot.click();
  await sleep(1500);
}

export async function discoverLots(page: Page, resortUrl: string, verbose = false): Promise<string[]> {
  await page.goto(`${resortUrl}/select-parking`, { waitUntil: 'networkidle' });
  await sleep(2000);
  const lotCards = await page.$$(SELECTORS.lotDiscovery);
  const lots: string[] = [];
  for (const card of lotCards) {
    const text = await card.textContent();
    if (text) lots.push(text.trim());
  }
  log.verbose(`Discovered ${lots.length} lots: ${lots.join(', ')}`, verbose);
  return lots;
}

export async function navigateToReservations(page: Page, verbose = false, resortUrl?: string): Promise<void> {
  log.verbose('Navigating to reservation page', verbose);
  const urls = getUrls(resortUrl);
  await page.goto(urls.BASE + '/select-parking', { waitUntil: 'networkidle' });
  await sleep(1500); // Wait for SPA and Mobiscroll calendar to render
}

export async function selectDate(page: Page, dateStr: string, verbose = false): Promise<boolean> {
  log.verbose(`Selecting date: ${dateStr}`, verbose);

  // Wait for Mobiscroll calendar to load
  await page.waitForSelector(SELECTORS.calendar, { timeout: 15000 });
  await sleep(500);

  // Build the aria-label selector for the target date
  const dateSelector = SELECTORS.calendarDay(dateStr);
  log.verbose(`Looking for: ${dateSelector}`, verbose);

  // May need to navigate to correct month - check if date is visible
  let dateElement = await page.$(dateSelector);

  // If not found, try navigating forward through months
  let attempts = 0;
  while (!dateElement && attempts < 6) {
    const nextBtn = await page.$(SELECTORS.calendarNextBtn);
    if (nextBtn) {
      const isDisabled = await nextBtn.getAttribute('disabled');
      if (isDisabled) break;
      await nextBtn.click();
      await sleep(500);
      dateElement = await page.$(dateSelector);
    }
    attempts++;
  }

  if (!dateElement) {
    log.verbose(`Date element not found: ${dateSelector}`, verbose);
    return false;
  }

  // Check if date is available (green background) or sold out (pink)
  const style = await dateElement.getAttribute('style') || '';
  const colorStatus = parseAvailabilityFromStyle(style);

  log.verbose(`Date style: ${style}`, verbose);
  log.verbose(`Available: ${colorStatus === 'available'}, Sold out: ${colorStatus === 'sold-out'}`, verbose);

  // Click the date to proceed
  await dateElement.click();
  await sleep(1000);
  return true;
}

export async function getDateAvailability(
  page: Page,
  dateStr: string,
  verbose = false
): Promise<'available' | 'sold-out' | 'no-reservation' | 'unavailable' | 'unknown'> {
  const dateSelector = SELECTORS.calendarDay(dateStr);
  const dateElement = await page.$(dateSelector);

  if (!dateElement) return 'unknown';

  const style = await dateElement.getAttribute('style') || '';
  const colorStatus = parseAvailabilityFromStyle(style);

  if (colorStatus === 'available') return 'available';
  if (colorStatus === 'sold-out') return 'sold-out';

  // Check for aria-disabled
  const isDisabled = await dateElement.getAttribute('aria-disabled');
  if (isDisabled === 'true') return 'unavailable';

  // No special styling = no reservation needed (weekday)
  return 'no-reservation';
}

export async function checkAvailability(
  page: Page,
  dateStr: string,
  verbose = false,
  resortUrl?: string,
  lotPreferences?: string[],
): Promise<AvailabilityResult> {
  log.verbose(`Checking availability for ${dateStr}`, verbose);

  await navigateToReservations(page, verbose, resortUrl);

  // Handle lot selection for multi-lot sites
  await selectLotIfNeeded(page, lotPreferences, verbose);

  const result: AvailabilityResult = {
    date: dateStr,
    status: 'unknown',
    available: {
      paid: false,
      carpool: false,
    },
    timestamp: new Date(),
  };

  // Wait for calendar and check date status before clicking
  await page.waitForSelector(SELECTORS.calendar, { timeout: 15000 });
  await sleep(500);

  // Navigate to the correct month if needed (same logic as selectDate)
  const dateSelector = SELECTORS.calendarDay(dateStr);
  let dateElement = await page.$(dateSelector);
  let attempts = 0;
  while (!dateElement && attempts < 6) {
    const nextBtn = await page.$(SELECTORS.calendarNextBtn);
    if (nextBtn) {
      const isDisabled = await nextBtn.getAttribute('disabled');
      if (isDisabled) break;
      await nextBtn.click();
      await sleep(500);
      dateElement = await page.$(dateSelector);
    }
    attempts++;
  }

  // Get the date status from calendar colors
  const dateStatus = await getDateAvailability(page, dateStr, verbose);
  result.status = dateStatus;
  log.verbose(`Date status: ${dateStatus}`, verbose);

  if (dateStatus === 'no-reservation' || dateStatus === 'unavailable' || dateStatus === 'unknown') {
    return result;
  }

  if (dateStatus === 'sold-out') {
    return result;
  }

  // Date is available - click it to see rate options
  const dateSelected = await selectDate(page, dateStr, verbose);
  if (!dateSelected) {
    log.warn('Could not select date on calendar');
    return result;
  }

  // Wait for rate selection to appear
  await sleep(1000);

  // Check if rate cards are present
  const rateWrapper = await page.$(SELECTORS.activeRateContainer);
  if (!rateWrapper) {
    log.verbose('Rate selection not shown - date may be unavailable', verbose);
    return result;
  }

  // Check for Carpool option
  const carpoolCard = await page.$(SELECTORS.rateCard('Carpool'));
  if (carpoolCard) {
    result.available.carpool = true;
    log.verbose('Carpool: available', verbose);
  }

  // Check for Paid option
  const paidCard = await page.$(SELECTORS.rateCard('Paid'));
  if (paidCard) {
    result.available.paid = true;
    log.verbose('Paid: available', verbose);
  }

  return result;
}

export async function bookSpot(
  page: Page,
  dateStr: string,
  type: ReservationType,
  plate: string,
  dryRun = false,
  verbose = false,
  resortUrl?: string,
  lotPreferences?: string[],
): Promise<BookingResult> {
  log.verbose(`Booking ${type} spot for ${dateStr}`, verbose);

  const result: BookingResult = {
    success: false,
    date: dateStr,
    type,
    plate,
  };

  try {
    const typeCards: Record<ReservationType, string> = {
      paid: SELECTORS.rateCard('Paid'),
      carpool: SELECTORS.rateCard('Carpool'),
    };

    let typeCard = await page.$(typeCards[type]);

    if (!typeCard) {
      // Not on rate selection screen — navigate and try each lot in preference order
      await navigateToReservations(page, verbose, resortUrl);

      // Discover lots if none configured
      let lotsToTry = lotPreferences?.length ? lotPreferences : [];
      if (lotsToTry.length === 0) {
        const lotCards = await page.$$(SELECTORS.lotDiscovery);
        for (const card of lotCards) {
          const text = await card.textContent();
          if (text) lotsToTry.push(text.trim());
        }
      }

      // If still no lots, it's a single-lot site
      if (lotsToTry.length === 0) {
        lotsToTry = ['']; // Empty string signals no lot selection needed
      }

      for (const lot of lotsToTry) {
        log.verbose(lot ? `Trying lot: ${lot}` : 'Navigating to date selection', verbose);

        if (lot) {
          const lotSelected = await selectLot(page, lot, verbose);
          if (!lotSelected) {
            await navigateToReservations(page, verbose, resortUrl);
            continue;
          }
        }

        const dateSelected = await selectDate(page, dateStr, verbose);
        if (!dateSelected) {
          result.error = 'Could not select date';
          return result;
        }

        await sleep(1000);
        typeCard = await page.$(typeCards[type]);
        if (typeCard) break;

        log.verbose(lot ? `${type} not available in ${lot}, trying next lot` : `${type} option not found`, verbose);
        await navigateToReservations(page, verbose, resortUrl);
      }
    }

    if (!typeCard) {
      result.error = `${type} option not found`;
      return result;
    }

    log.verbose(`Clicking ${type} rate card`, verbose);
    await typeCard.click();
    await sleep(2000); // Redirects to parking.honkmobile.com/checkout

    // Now on checkout page (different domain)
    await page.waitForSelector(SELECTORS.checkoutContainer, { timeout: 15000 });
    log.verbose('On checkout page', verbose);

    // Check if we need to update the license plate
    const currentPlate = await page.$(SELECTORS.plateDisplay);
    if (currentPlate) {
      const displayedPlate = await currentPlate.textContent();
      log.verbose(`Current plate: ${displayedPlate}`, verbose);

      if (displayedPlate !== plate) {
        // Click edit to change plate
        const editBtn = await page.$(SELECTORS.editVehicleBtn);
        if (editBtn) {
          await editBtn.click();
          await sleep(500);
          // Plate editing modal flow would go here
          // For now, log a warning
          log.warn(`Plate mismatch: displayed=${displayedPlate}, wanted=${plate}`);
        }
      }
    }

    // Accept terms and conditions
    log.verbose('Looking for terms checkbox', verbose);
    const termsCheckbox = await page.waitForSelector(SELECTORS.termsCheckbox, { timeout: 10000 }).catch(() => null);
    if (termsCheckbox) {
      const isChecked = await termsCheckbox.isChecked();
      log.verbose(`Terms checkbox found, checked: ${isChecked}`, verbose);
      if (!isChecked) {
        log.verbose('Accepting terms and conditions', verbose);
        // Click the label wrapper to trigger React state update
        await page.click(SELECTORS.termsLabel);
        await sleep(500);
        // Verify it got checked
        const nowChecked = await termsCheckbox.isChecked();
        log.verbose(`Terms after click: ${nowChecked}`, verbose);
        if (!nowChecked) {
          // Fallback: force-check via JS
          log.verbose('Fallback: force-checking via JS', verbose);
          await termsCheckbox.evaluate((el: HTMLInputElement) => {
            el.click();
            el.dispatchEvent(new Event('change', { bubbles: true }));
          });
          await sleep(500);
        }
      }
    } else {
      log.verbose('Terms checkbox not found - may already be accepted', verbose);
    }

    if (dryRun) {
      log.info('Dry run - stopping before final confirmation');
      result.success = true;
      result.confirmationNumber = 'DRY-RUN';
      return result;
    }

    // Click Continue button
    log.verbose('Waiting for Continue button', verbose);
    const continueBtn = await page.waitForSelector(SELECTORS.continueBtn, { timeout: 15000 }).catch(() => null);
    if (!continueBtn) {
      result.error = 'Continue button not found';
      return result;
    }

    const isDisabled = await continueBtn.evaluate(
      el => el.classList.contains('CtaButton--container__disabled')
    );
    if (isDisabled) {
      result.error = 'Continue button is disabled - check terms/payment';
      return result;
    }

    log.verbose('Clicking Continue', verbose);
    await continueBtn.click();

    // Race: overlap modal, confirm modal, reservation limit error, or post-purchase redirect
    log.verbose('Waiting for response after Continue', verbose);
    const outcome = await Promise.race([
      page.waitForSelector(SELECTORS.overlapModal, { timeout: 20000 })
        .then(() => 'overlap' as const),
      page.waitForSelector(SELECTORS.errorBox, { timeout: 20000 })
        .then(() => 'limit' as const),
      page.waitForSelector(SELECTORS.confirmBtn, { timeout: 20000 })
        .then(() => 'confirm' as const),
      page.waitForURL('**/post-purchase**', { timeout: 20000 })
        .then(() => 'redirect' as const),
    ]).catch(() => null);

    if (!outcome) {
      result.error = 'No response after clicking Continue';
      return result;
    }

    if (outcome === 'overlap') {
      log.verbose('Parking session overlap detected', verbose);
      result.error = 'This date overlaps a previously-purchased session';
      return result;
    }

    if (outcome === 'limit') {
      const errorEl = await page.$(SELECTORS.errorCopy);
      const errorText = errorEl ? await errorEl.textContent() : 'Reservation limit reached';
      log.verbose(`Reservation limit error: ${errorText}`, verbose);
      result.error = errorText || 'Reservation limit reached';
      return result;
    }

    if (outcome === 'confirm') {
      const confirmBtn = await page.$(SELECTORS.confirmBtn);
      if (confirmBtn) {
        log.verbose('Clicking Confirm', verbose);
        await confirmBtn.click();
      }
    } else {
      log.verbose('Redirected directly to post-purchase', verbose);
    }

    // Wait for post-purchase page
    log.verbose('Waiting for confirmation page', verbose);
    try {
      await page.waitForURL('**/post-purchase**', { timeout: 30000 });
      log.verbose('On post-purchase confirmation page', verbose);

      // Try to extract confirmation number
      await sleep(2000);
      const pageText = await page.textContent('body');
      const confMatch = pageText?.match(/confirmation[:\s#]*([A-Z0-9-]+)/i);
      if (confMatch) {
        result.confirmationNumber = confMatch[1];
      }
    } catch {
      const currentUrl = page.url();
      if (currentUrl.includes('checkout')) {
        result.error = 'Booking did not complete - still on checkout page';
        return result;
      }
    }

    result.success = true;
    return result;

  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    return result;
  }
}

export async function waitForLogin(page: Page, verbose = false, resortUrl?: string): Promise<boolean> {
  log.verbose('Waiting for login...', verbose);

  const urls = getUrls(resortUrl);
  await page.goto(urls.LOGIN, { waitUntil: 'networkidle' });

  // Wait for either successful login (redirect away from login) or timeout
  try {
    await page.waitForFunction(
      () => !window.location.href.includes('/login'),
      { timeout: 300000 } // 5 minute timeout for manual login
    );
    return true;
  } catch {
    return false;
  }
}
