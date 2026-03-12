/**
 * Scraper for Crystal Mountain Resort parking (parking.crystalmountainresort.com).
 * Crystal uses a different platform than HONK; this module implements the same
 * high-level operations (navigate, check availability, login, discover lots).
 */

import type { Page, ElementHandle } from 'playwright-core';
import type { AvailabilityResult } from '../types.js';
import { getUrls } from '../constants.js';
import { sleep, log } from './utils.js';
import {
  buildCrystalCalendarDaySelectors,
  CRYSTAL_SELECTORS,
  parseCrystalAvailability,
} from './selectors-crystal.js';

const CALENDAR_LOAD_TIMEOUT_MS = 15000;
const CALENDAR_RENDER_DELAY_MS = 500;
const SPA_RENDER_DELAY_MS = 1500;
const MONTH_NAVIGATION_DELAY_MS = 500;
const MAX_CALENDAR_NAVIGATION_ATTEMPTS = 6;

async function findVisible(page: Page, selector: string): Promise<ElementHandle | null> {
  const elements = await page.$$(selector);
  for (const el of elements) {
    if (await el.isVisible()) return el;
  }
  return elements[0] ?? null;
}

/** Crystal reservations are on the main page (no lot selection). */
export async function navigateToReservations(
  page: Page,
  verbose = false,
  resortUrl?: string
): Promise<void> {
  log.verbose('Navigating to Crystal Mountain reservation page', verbose);
  const urls = getUrls(resortUrl);
  await page.goto(urls.RESERVATIONS, { waitUntil: 'networkidle' });
  await sleep(SPA_RENDER_DELAY_MS);
}

/** No lot selection on Crystal (single parking product). */
export async function selectLotIfNeeded(
  _page: Page,
  _lotPreferences: string[] | undefined,
  verbose: boolean
): Promise<void> {
  log.verbose('Crystal Mountain: single product, no lot selection', verbose);
}

function getDateAvailabilityCrystal(
  page: Page,
  dateStr: string,
  verbose: boolean
): Promise<'available' | 'sold-out' | 'no-reservation' | 'unavailable' | 'unknown'> {
  return getDateAvailabilityInternal(page, dateStr, verbose);
}

async function getDateAvailabilityInternal(
  page: Page,
  dateStr: string,
  verbose: boolean
): Promise<'available' | 'sold-out' | 'no-reservation' | 'unavailable' | 'unknown'> {
  const selectors = buildCrystalCalendarDaySelectors(dateStr);
  let dateElement: ElementHandle | null = null;
  for (const sel of selectors) {
    dateElement = await findVisible(page, sel);
    if (dateElement) break;
  }

  if (!dateElement) return 'unknown';

  const style = (await dateElement.getAttribute('style')) || '';
  const className = (await dateElement.getAttribute('class')) || '';
  const ariaDisabled = await dateElement.getAttribute('aria-disabled');

  const status = parseCrystalAvailability(style, className, ariaDisabled);
  if (status !== 'unknown') return status;

  if (ariaDisabled === 'true') return 'unavailable';
  return 'no-reservation';
}

export async function getDateAvailability(
  page: Page,
  dateStr: string,
  verbose = false
): Promise<'available' | 'sold-out' | 'no-reservation' | 'unavailable' | 'unknown'> {
  return getDateAvailabilityCrystal(page, dateStr, verbose);
}

export async function checkAvailability(
  page: Page,
  dateStr: string,
  verbose = false,
  resortUrl?: string,
  _lotPreferences?: string[]
): Promise<AvailabilityResult> {
  log.verbose(`[Crystal] Checking availability for ${dateStr}`, verbose);

  await navigateToReservations(page, verbose, resortUrl);
  await selectLotIfNeeded(page, undefined, verbose);

  const result: AvailabilityResult = {
    date: dateStr,
    status: 'unknown',
    timestamp: new Date(),
  };

  // Wait for Crystal calendar container
  await page.waitForSelector(CRYSTAL_SELECTORS.calendar, { timeout: CALENDAR_LOAD_TIMEOUT_MS });
  await sleep(CALENDAR_RENDER_DELAY_MS);

  const dateSelectors = buildCrystalCalendarDaySelectors(dateStr);
  let dateElement: ElementHandle | null = null;
  for (const sel of dateSelectors) {
    dateElement = await findVisible(page, sel);
    if (dateElement) break;
  }
  let attempts = 0;

  while (!dateElement && attempts < MAX_CALENDAR_NAVIGATION_ATTEMPTS) {
    const nextBtn = await page.$(CRYSTAL_SELECTORS.navRight);
    if (!nextBtn) break;
    const isDisabled = await nextBtn.getAttribute('disabled');
    if (isDisabled) break;
    await nextBtn.click();
    await sleep(MONTH_NAVIGATION_DELAY_MS);
    for (const sel of dateSelectors) {
      dateElement = await findVisible(page, sel);
      if (dateElement) break;
    }
    attempts++;
  }

  if (!dateElement) {
    result.status = 'unavailable';
    log.verbose(`Date ${dateStr} not found in Crystal calendar after navigation`, verbose);
    return result;
  }

  const dateStatus = await getDateAvailabilityInternal(page, dateStr, verbose);
  result.status = dateStatus;
  log.verbose(`[Crystal] Date status: ${dateStatus}`, verbose);

  return result;
}

/** Crystal has a single parking product; return empty or single placeholder. */
export async function discoverLots(
  _page: Page,
  resortUrl: string,
  verbose = false
): Promise<string[]> {
  log.verbose('Crystal Mountain: single product, no lots to discover', verbose);
  return [];
}

export async function waitForLogin(
  page: Page,
  verbose = false,
  resortUrl?: string
): Promise<boolean> {
  log.verbose('[Crystal] Waiting for login...', verbose);

  const urls = getUrls(resortUrl);
  await page.goto(urls.LOGIN, { waitUntil: 'networkidle' });

  try {
    await page.waitForFunction(
      () => !window.location.href.includes('/login'),
      { timeout: 300000 }
    );
    return true;
  } catch {
    return false;
  }
}
