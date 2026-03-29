import type { Page, ElementHandle } from 'playwright-core';
import type { DateStatus, AvailabilityResult } from '../types.js';
import type { ResortDescriptor, AvailabilityRule, ResolvedResort, ResortHooks } from './types.js';
import { sleep, log } from '../lib/utils.js';

// --- Pure functions (exported for unit testing) ---

export function formatDateForSelector(
  dateStr: string,
  format: ResortDescriptor['calendar']['dateFormat'],
): string {
  switch (format) {
    case 'aria-label-long': {
      const date = new Date(dateStr + 'T12:00:00');
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
    case 'data-date-iso':
      return dateStr;
  }
}

export function buildDayCellSelector(
  calendar: Pick<ResortDescriptor['calendar'], 'dayCellTemplate' | 'dateFormat'>,
  dateStr: string,
): string {
  const formatted = formatDateForSelector(dateStr, calendar.dateFormat);
  return calendar.dayCellTemplate.replace('{date}', formatted);
}

export function evaluateAvailabilityRules(
  rules: AvailabilityRule[],
  element: { style: string; className: string; ariaDisabled: string | null },
): DateStatus {
  for (const rule of rules) {
    switch (rule.match.type) {
      case 'style-contains':
        if (element.style.includes(rule.match.value)) return rule.status;
        break;
      case 'class-contains':
        if (element.className.includes(rule.match.value)) return rule.status;
        break;
      case 'aria-disabled':
        if (element.ariaDisabled === rule.match.value) return rule.status;
        break;
    }
  }
  return 'no-reservation';
}

// --- ScraperEngine class ---

export class ScraperEngine {
  private verbose: boolean;

  constructor(options: { verbose?: boolean } = {}) {
    this.verbose = options.verbose ?? false;
  }

  async navigateToReservations(page: Page, resort: ResolvedResort): Promise<void> {
    const { descriptor, hooks } = resort;
    const url = descriptor.urls.base + descriptor.urls.reservations;
    log.verbose(`Navigating to ${url}`, this.verbose);
    await page.goto(url, { waitUntil: 'networkidle' });
    if (hooks?.afterNavigate) {
      await hooks.afterNavigate(page);
    }
    await sleep(descriptor.timing.spaRenderDelay);
  }

  async selectLotIfNeeded(
    page: Page,
    resort: ResolvedResort,
    lotPreferences?: string[],
  ): Promise<void> {
    const { descriptor } = resort;
    if (!descriptor.lots.supported || !descriptor.lots.discoverySelector) {
      log.verbose('No lot selection needed', this.verbose);
      return;
    }

    const lotCards = await page.$$(descriptor.lots.discoverySelector);
    if (lotCards.length === 0) {
      log.verbose('No lot cards found (single-lot site)', this.verbose);
      return;
    }

    if (lotPreferences?.length) {
      for (const pref of lotPreferences) {
        for (const card of lotCards) {
          const text = (await card.textContent())?.trim();
          if (text && text.includes(pref)) {
            log.verbose(`Selecting preferred lot: ${pref}`, this.verbose);
            await card.click();
            await sleep(descriptor.timing.lotSelectDelay ?? 1500);
            return;
          }
        }
      }
      log.verbose('No preferred lots found, selecting first available', this.verbose);
    }

    const firstLot = lotCards[0];
    const lotName = (await firstLot.textContent())?.trim() || 'first lot';
    log.verbose(`Auto-selecting lot: ${lotName}`, this.verbose);
    await firstLot.click();
    await sleep(descriptor.timing.lotSelectDelay ?? 1500);
  }

  async findDateElement(
    page: Page,
    resort: ResolvedResort,
    dateStr: string,
  ): Promise<ElementHandle | null> {
    const { descriptor, hooks } = resort;
    const selector = buildDayCellSelector(descriptor.calendar, dateStr);

    const find = hooks?.findDateElement
      ? (s: string) => hooks.findDateElement!(page, s)
      : (s: string) => page.$(s);

    let element = await find(selector);
    let attempts = 0;

    while (!element && attempts < descriptor.calendar.maxNavigationAttempts) {
      const navSelector = descriptor.calendar.navRight;
      if (!navSelector) break;

      const nextBtn = await page.$(navSelector);
      if (!nextBtn) break;

      const isDisabled = await nextBtn.getAttribute('disabled');
      if (isDisabled) break;

      await nextBtn.click();
      await sleep(descriptor.timing.monthNavigationDelay);
      element = await find(selector);
      attempts++;
    }

    return element;
  }

  async evaluateElement(
    element: ElementHandle,
    resort: ResolvedResort,
  ): Promise<DateStatus> {
    const { descriptor, hooks } = resort;

    if (hooks?.parseAvailability) {
      return hooks.parseAvailability(element);
    }

    const style = (await element.getAttribute('style')) || '';
    const className = (await element.getAttribute('class')) || '';
    const ariaDisabled = await element.getAttribute('aria-disabled');

    return evaluateAvailabilityRules(descriptor.availability.rules, {
      style,
      className,
      ariaDisabled,
    });
  }

  async checkAvailability(
    page: Page,
    resort: ResolvedResort,
    dateStr: string,
    lotPreferences?: string[],
  ): Promise<AvailabilityResult> {
    const { descriptor } = resort;
    log.verbose(`Checking availability for ${dateStr}`, this.verbose);

    await this.navigateToReservations(page, resort);
    await this.selectLotIfNeeded(page, resort, lotPreferences);

    const result: AvailabilityResult = {
      date: dateStr,
      status: 'unknown',
      timestamp: new Date(),
    };

    await page.waitForSelector(descriptor.calendar.container, {
      timeout: descriptor.timing.calendarLoadTimeout,
    });
    await sleep(descriptor.timing.calendarRenderDelay);

    const dateElement = await this.findDateElement(page, resort, dateStr);

    if (!dateElement) {
      result.status = 'unavailable';
      log.verbose(`Date ${dateStr} not found in calendar after navigation`, this.verbose);
      return result;
    }

    result.status = await this.evaluateElement(dateElement, resort);
    log.verbose(`Date status: ${result.status}`, this.verbose);

    return result;
  }

  async discoverLots(page: Page, resort: ResolvedResort): Promise<string[]> {
    const { descriptor } = resort;
    if (!descriptor.lots.supported || !descriptor.lots.discoverySelector) {
      log.verbose('No lots to discover (single-product site)', this.verbose);
      return [];
    }

    const url = descriptor.urls.base + descriptor.urls.reservations;
    await page.goto(url, { waitUntil: 'networkidle' });
    await sleep(descriptor.timing.spaRenderDelay);

    const lotCards = await page.$$(descriptor.lots.discoverySelector);
    const lots: string[] = [];
    for (const card of lotCards) {
      const text = await card.textContent();
      if (text) lots.push(text.trim());
    }
    log.verbose(`Discovered ${lots.length} lots: ${lots.join(', ')}`, this.verbose);
    return lots;
  }

  async waitForLogin(page: Page, resort: ResolvedResort): Promise<boolean> {
    const { descriptor } = resort;
    log.verbose('Waiting for login...', this.verbose);

    const loginUrl = descriptor.urls.base + descriptor.urls.login;
    await page.goto(loginUrl, { waitUntil: 'networkidle' });

    try {
      await page.waitForFunction(
        () => !window.location.href.includes('/login'),
        { timeout: 300000 },
      );
      return true;
    } catch {
      return false;
    }
  }
}
