import type { Page } from 'playwright-core';
import type { AvailabilityResult, ReservationType, BookingResult } from '../types.js';
import { URLS } from '../constants.js';
import { sleep, log } from './utils.js';

// Centralized selectors - discovered from captured HTML (Jan 2026)
// Site uses Mobiscroll calendar library (mbsc-*) and React with CSS modules
const SELECTORS = {
  // Home page
  reserveSpotLink: 'a[href="/select-parking"]',

  // Mobiscroll Calendar (on /select-parking)
  calendar: '.mbsc-calendar',
  calendarNextBtn: '.custom-next',
  calendarPrevBtn: '.custom-prev',
  // Days have aria-label like "Saturday, January 3, 2026"
  calendarDay: (dateStr: string) => {
    // Convert YYYY-MM-DD to full date string for aria-label matching
    const date = new Date(dateStr + 'T12:00:00');
    const formatted = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    return `.mbsc-calendar-day-text[aria-label="${formatted}"]`;
  },

  // Availability indicators (legend on calendar page)
  availabilityLegend: '.SelectDate_availability__IccV4',
  availableIndicator: '.SelectDate_available__FuxXF',
  soldOutIndicator: '.SelectDate_soldOut__4YEX8',
  unavailableIndicator: '.SelectDate_unavailable__buZj7',
  noReservationIndicator: '.SelectDate_noReservation__C7oHz',

  // Date selection expandable card
  dateSection: '.ExpandableCard_titleBox__5k2mD:has-text("Date")',
  changeDateBtn: '.ExpandableCard_button__dLT0V:has-text("Change Date")',

  // Rate selection (after date selected)
  rateSection: '.ExpandableCard_titleBox__5k2mD:has-text("Parking rate")',
  rateWrapper: '.SelectRate_wrapper__v6wva',
  rateCard: '.SelectRate_card__AT83w',
  rateCopy: '.SelectRate_rateCopy__yfcwz',
  ratePrice: '.SelectRate_ratePrice__r2\\+hE',
  // Rate cards contain text like "Carpool 4+" or "Advanced Paid Reservations"
  carpoolCard: '.SelectRate_card__AT83w:has-text("Carpool")',
  paidCard: '.SelectRate_card__AT83w:has-text("Paid")',

  // Checkout page (different domain: parking.honkmobile.com)
  checkoutContainer: '.CheckoutRoute',
  plateDisplay: '.CheckoutVehicleComponent--plate',
  editVehicleBtn: 'button[aria-label="Edit vehicle"]',
  termsCheckbox: 'input#terms',
  termsLabel: 'label[for="terms"]',
  paymentMethodBtn: '.SelectPaymentMethodButton--wrapper',
  continueBtn: '.CtaButton--container',

  // Navigation
  backButton: '.BackButton',
  navTitle: '.Header--center',

  // Auth (settings page)
  settingsLink: 'a[href="/settings"]',
  hamburgerIcon: '.Nav_hamburgerIcon__AToZp',
} as const;

// Calendar day colors (inline styles indicate availability)
const CALENDAR_COLORS = {
  available: 'rgba(49, 200, 25', // Green tint
  soldOut: 'rgb(247, 205, 212)', // Pink/red tint
} as const;

export async function navigateToReservations(page: Page, verbose = false): Promise<void> {
  log.verbose('Navigating to reservation page', verbose);
  await page.goto(URLS.BASE + '/select-parking', { waitUntil: 'networkidle' });
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
  const isAvailable = style.includes(CALENDAR_COLORS.available);
  const isSoldOut = style.includes(CALENDAR_COLORS.soldOut);

  log.verbose(`Date style: ${style}`, verbose);
  log.verbose(`Available: ${isAvailable}, Sold out: ${isSoldOut}`, verbose);

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

  if (style.includes(CALENDAR_COLORS.available)) return 'available';
  if (style.includes(CALENDAR_COLORS.soldOut)) return 'sold-out';

  // Check for aria-disabled
  const isDisabled = await dateElement.getAttribute('aria-disabled');
  if (isDisabled === 'true') return 'unavailable';

  // No special styling = no reservation needed (weekday)
  return 'no-reservation';
}

export async function checkAvailability(
  page: Page,
  dateStr: string,
  verbose = false
): Promise<AvailabilityResult> {
  log.verbose(`Checking availability for ${dateStr}`, verbose);

  await navigateToReservations(page, verbose);

  const result: AvailabilityResult = {
    date: dateStr,
    available: {
      paid: false,
      carpool: false,
      ada: false,
    },
    timestamp: new Date(),
  };

  // Navigate to the date in calendar
  const dateSelected = await selectDate(page, dateStr, verbose);
  if (!dateSelected) {
    log.warn('Could not select date on calendar');
    return result;
  }

  // Wait for rate selection to appear
  await sleep(1000);

  // Check if rate cards are present
  const rateWrapper = await page.$(SELECTORS.rateWrapper);
  if (!rateWrapper) {
    log.verbose('Rate selection not shown - date may be unavailable', verbose);
    return result;
  }

  // Check for Carpool option
  const carpoolCard = await page.$(SELECTORS.carpoolCard);
  if (carpoolCard) {
    result.available.carpool = true;
    log.verbose('Carpool: available', verbose);
  }

  // Check for Paid option
  const paidCard = await page.$(SELECTORS.paidCard);
  if (paidCard) {
    result.available.paid = true;
    log.verbose('Paid: available', verbose);
  }

  // ADA typically shown alongside paid if available
  // For now, assume ADA follows paid availability
  result.available.ada = result.available.paid;

  return result;
}

export async function bookSpot(
  page: Page,
  dateStr: string,
  type: ReservationType,
  plate: string,
  dryRun = false,
  verbose = false
): Promise<BookingResult> {
  log.verbose(`Booking ${type} spot for ${dateStr}`, verbose);

  const result: BookingResult = {
    success: false,
    date: dateStr,
    type,
    plate,
  };

  try {
    // Navigate and select date
    await navigateToReservations(page, verbose);
    const dateSelected = await selectDate(page, dateStr, verbose);

    if (!dateSelected) {
      result.error = 'Could not select date';
      return result;
    }

    // Wait for rate selection
    await sleep(1000);

    // Select reservation type by clicking the appropriate rate card
    const typeCards: Record<ReservationType, string> = {
      paid: SELECTORS.paidCard,
      carpool: SELECTORS.carpoolCard,
      ada: SELECTORS.paidCard, // ADA uses same card flow
    };

    const typeCard = await page.$(typeCards[type]);
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
    const termsCheckbox = await page.$(SELECTORS.termsCheckbox);
    if (termsCheckbox) {
      const isChecked = await termsCheckbox.isChecked();
      if (!isChecked) {
        await termsCheckbox.click();
        await sleep(300);
      }
    }

    if (dryRun) {
      log.info('Dry run - stopping before final confirmation');
      result.success = true;
      result.confirmationNumber = 'DRY-RUN';
      return result;
    }

    // Click continue to complete booking
    const continueBtn = await page.$(SELECTORS.continueBtn);
    if (continueBtn) {
      // Check if button is enabled
      const isDisabled = await continueBtn.evaluate(
        el => el.classList.contains('CtaButton--container__disabled')
      );
      if (isDisabled) {
        result.error = 'Continue button is disabled - check terms/payment';
        return result;
      }
      await continueBtn.click();
      await sleep(3000);
    }

    // TODO: Handle post-purchase confirmation page
    result.success = true;
    return result;

  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    return result;
  }
}

export async function waitForLogin(page: Page, verbose = false): Promise<boolean> {
  log.verbose('Waiting for login...', verbose);

  await page.goto(URLS.LOGIN, { waitUntil: 'networkidle' });

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
