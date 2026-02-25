import type { Page, ElementHandle } from 'rebrowser-playwright';
import type { AvailabilityResult } from '../types.js';
import { getUrls } from '../constants.js';
import { sleep, log } from './utils.js';
import {
  buildCalendarDaySelector,
  buildLotCardSelector,
  buildLotDiscoverySelector,
  parseAvailabilityFromStyle,
} from './selectors.js';

// Centralized selectors — stable patterns only (no CSS module hashes)
const SELECTORS = {
  // Mobiscroll Calendar — library classes, very stable
  calendar: '.mbsc-calendar',
  calendarNextBtn: '.custom-next',
  calendarDay: buildCalendarDaySelector,

  // Lot/zone cards — uses imported builder
  lotCard: buildLotCardSelector,
  lotDiscovery: buildLotDiscoverySelector(),
} as const;

/**
 * Find the first visible element matching a selector.
 * Mobiscroll renders duplicate calendar cells across month panels;
 * page.$() returns the first (often hidden) match.
 */
async function findVisible(page: Page, selector: string): Promise<ElementHandle | null> {
  const elements = await page.$$(selector);
  for (const el of elements) {
    if (await el.isVisible()) return el;
  }
  return elements[0] ?? null; // fall back to first match if none visible
}

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

export async function navigateToReservations(page: Page, verbose = false, resortUrl?: string): Promise<void> {
  log.verbose('Navigating to reservation page', verbose);
  const urls = getUrls(resortUrl);
  await page.goto(urls.BASE + '/select-parking', { waitUntil: 'networkidle' });
  await sleep(1500); // Wait for SPA and Mobiscroll calendar to render
}

export async function getDateAvailability(
  page: Page,
  dateStr: string,
  verbose = false
): Promise<'available' | 'sold-out' | 'no-reservation' | 'unavailable' | 'unknown'> {
  const dateSelector = SELECTORS.calendarDay(dateStr);
  const dateElement = await findVisible(page, dateSelector);

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
    timestamp: new Date(),
  };

  // Wait for calendar and check date status (no clicking — avoids Turnstile)
  await page.waitForSelector(SELECTORS.calendar, { timeout: 15000 });
  await sleep(500);

  // Navigate to the correct month if needed
  const dateSelector = SELECTORS.calendarDay(dateStr);
  let dateElement = await findVisible(page, dateSelector);
  let attempts = 0;
  while (!dateElement && attempts < 6) {
    const nextBtn = await page.$(SELECTORS.calendarNextBtn);
    if (nextBtn) {
      const isDisabled = await nextBtn.getAttribute('disabled');
      if (isDisabled) break;
      await nextBtn.click();
      await sleep(500);
      dateElement = await findVisible(page, dateSelector);
    }
    attempts++;
  }

  // Get the date status from calendar colors
  const dateStatus = await getDateAvailability(page, dateStr, verbose);
  result.status = dateStatus;
  log.verbose(`Date status: ${dateStatus}`, verbose);

  return result;
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
