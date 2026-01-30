#!/usr/bin/env npx tsx
/**
 * Selector Validation Script
 *
 * Tests our selectors against all real HONK Reserve 'N Ski sites.
 * Run with: npx tsx scripts/validate-selectors.ts
 */

import { chromium, type Page } from 'playwright';
import {
  buildCalendarDaySelector,
  buildRateCardSelector,
  buildLotCardSelector,
  buildLotDiscoverySelector,
} from '../src/lib/selectors.js';

// All standard Reserve 'N Ski resorts (excludes hourly/pay-on-arrival)
const RESORTS = [
  { name: 'Stevens Pass', url: 'https://reservenski.parkstevenspass.com', expectedLots: false },
  { name: 'Northstar', url: 'https://reservenski.parknorthstar.com', expectedLots: true },
  { name: 'Heavenly', url: 'https://reservenski.parkheavenly.com', expectedLots: false },
  { name: 'Kirkwood', url: 'https://reservenski.parkkirkwood.com', expectedLots: false },
  { name: 'Palisades Tahoe', url: 'https://reservenski.parkpalisadestahoe.com', expectedLots: true },
  { name: 'Breckenridge', url: 'https://reservenski.breckpark.com', expectedLots: true },
  { name: 'A-Basin', url: 'https://reservenski.parkabasin.com', expectedLots: true },
  { name: 'Park City Surface', url: 'https://reserve.parkatparkcitymountain.com', expectedLots: false },
  { name: 'Park City Garage', url: 'https://reserve-garage.parkatparkcitymountain.com', expectedLots: false },
  { name: 'Solitude', url: 'https://reservenski.parksolitude.com', expectedLots: false },
  { name: 'Brighton', url: 'https://reservenski.parkbrightonresort.com', expectedLots: false },
  { name: 'Alta', url: 'https://reserve.altaparking.com', expectedLots: false },
  { name: 'Whistler Blackcomb', url: 'https://reservenski.whistlerblackcombparking.com', expectedLots: true },
];

const SELECTORS = {
  calendar: '.mbsc-calendar',
  calendarNextBtn: '.custom-next',
  activeRateContainer: '[class*="containerActive"]',
  lotDiscovery: buildLotDiscoverySelector(),
};

interface SelectorResult {
  found: boolean;
  count?: number;
  details?: string;
}

interface ResortResult {
  name: string;
  url: string;
  success: boolean;
  loadTime: number;
  flow: 'single-lot' | 'multi-lot' | 'unknown';
  lotNames: string[];
  selectors: {
    calendar: SelectorResult;
    calendarNav: SelectorResult;
    lots: SelectorResult;
    rateContainer: SelectorResult;
    rateCards: SelectorResult;
  };
  error?: string;
  notes?: string;
}

async function testResort(page: Page, resort: typeof RESORTS[0]): Promise<ResortResult> {
  const result: ResortResult = {
    name: resort.name,
    url: resort.url,
    success: false,
    loadTime: 0,
    flow: 'unknown',
    lotNames: [],
    selectors: {
      calendar: { found: false },
      calendarNav: { found: false },
      lots: { found: false },
      rateContainer: { found: false },
      rateCards: { found: false },
    },
  };

  const startTime = Date.now();

  try {
    // Navigate to select-parking page
    await page.goto(`${resort.url}/select-parking`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for SPA to render
    await page.waitForTimeout(2500);

    result.loadTime = Date.now() - startTime;

    // Step 1: Check for lot cards (multi-lot sites show this first)
    const lots = await page.$$(SELECTORS.lotDiscovery);
    result.selectors.lots = {
      found: lots.length > 0,
      count: lots.length,
    };

    // Get lot names
    if (lots.length > 0) {
      for (const lot of lots) {
        const text = await lot.textContent();
        if (text) result.lotNames.push(text.trim());
      }
      result.selectors.lots.details = `Found ${lots.length} lots: ${result.lotNames.join(', ')}`;
    }

    // Step 2: Check for calendar
    let calendar = await page.$(SELECTORS.calendar);
    result.selectors.calendar.found = !!calendar;

    // If lots found but no calendar, this is multi-lot flow - click first lot
    if (lots.length > 0 && !calendar) {
      result.flow = 'multi-lot';
      result.notes = 'Multi-lot site: selecting first lot to reveal calendar';

      // Click first lot
      await lots[0].click();
      await page.waitForTimeout(2000);

      // Check for calendar again
      calendar = await page.$(SELECTORS.calendar);
      result.selectors.calendar.found = !!calendar;
      result.selectors.calendar.details = calendar
        ? 'Calendar found after lot selection'
        : 'Calendar still not found after lot selection';
    } else if (calendar) {
      result.flow = lots.length > 0 ? 'multi-lot' : 'single-lot';
      result.selectors.calendar.details = 'Calendar found immediately';
    }

    // Step 3: Check calendar navigation
    const navBtn = await page.$(SELECTORS.calendarNextBtn);
    result.selectors.calendarNav = {
      found: !!navBtn,
      details: navBtn ? 'Custom next button found' : 'Nav button not found',
    };

    // Step 4: Check rate container
    const rateContainer = await page.$(SELECTORS.activeRateContainer);
    result.selectors.rateContainer = {
      found: !!rateContainer,
      details: rateContainer ? 'Rate container active' : 'Rate container not visible',
    };

    // Step 5: If we have calendar, try clicking a date to see rate cards
    if (calendar) {
      // Find any clickable date (green background = available)
      const availableDate = await page.$('.mbsc-calendar-cell[style*="rgba(49, 200, 25"]');
      if (availableDate) {
        await availableDate.click();
        await page.waitForTimeout(1500);

        // Check for rate cards
        const paidCard = await page.$(buildRateCardSelector('Paid'));
        const carpoolCard = await page.$(buildRateCardSelector('Carpool'));

        result.selectors.rateCards = {
          found: !!(paidCard || carpoolCard),
          details: `Paid: ${paidCard ? '✓' : '✗'}, Carpool: ${carpoolCard ? '✓' : '✗'}`,
        };
      } else {
        result.selectors.rateCards = {
          found: false,
          details: 'No available dates found to test rate cards',
        };
      }
    }

    // Determine success: calendar must be findable (either immediately or after lot selection)
    result.success = result.selectors.calendar.found;

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.loadTime = Date.now() - startTime;
  }

  return result;
}

async function main() {
  console.log('='.repeat(70));
  console.log('HONK Selector Validation');
  console.log('Testing selectors against all Reserve \'N Ski resorts');
  console.log('='.repeat(70));
  console.log();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const page = await context.newPage();

  const results: ResortResult[] = [];

  for (const resort of RESORTS) {
    process.stdout.write(`Testing ${resort.name.padEnd(20)}... `);

    const result = await testResort(page, resort);
    results.push(result);

    if (result.success) {
      const flow = result.flow === 'multi-lot' ? ' [multi-lot]' : '';
      console.log(`✓ (${result.loadTime}ms)${flow}`);
    } else if (result.error) {
      console.log(`✗ ERROR: ${result.error.substring(0, 40)}`);
    } else {
      console.log(`✗ Calendar not found`);
    }
  }

  await browser.close();

  // Print detailed results
  console.log();
  console.log('='.repeat(70));
  console.log('DETAILED RESULTS');
  console.log('='.repeat(70));

  for (const result of results) {
    console.log();
    console.log(`${result.success ? '✓' : '✗'} ${result.name} (${result.flow})`);
    console.log(`  URL: ${result.url}`);
    console.log(`  Load time: ${result.loadTime}ms`);

    if (result.notes) {
      console.log(`  Note: ${result.notes}`);
    }

    if (result.error) {
      console.log(`  ERROR: ${result.error}`);
      continue;
    }

    if (result.lotNames.length > 0) {
      console.log(`  Lots: ${result.lotNames.join(', ')}`);
    }

    console.log(`  Selectors:`);
    console.log(`    Calendar:      ${result.selectors.calendar.found ? '✓' : '✗'} ${result.selectors.calendar.details || ''}`);
    console.log(`    Calendar Nav:  ${result.selectors.calendarNav.found ? '✓' : '✗'} ${result.selectors.calendarNav.details || ''}`);
    console.log(`    Lot Cards:     ${result.selectors.lots.found ? '✓' : '○'} ${result.selectors.lots.count || 0} found`);
    console.log(`    Rate Container:${result.selectors.rateContainer.found ? '✓' : '○'} ${result.selectors.rateContainer.details || ''}`);
    if (result.selectors.rateCards.found !== undefined) {
      console.log(`    Rate Cards:    ${result.selectors.rateCards.found ? '✓' : '○'} ${result.selectors.rateCards.details || ''}`);
    }
  }

  // Print summary
  console.log();
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const multiLot = results.filter(r => r.flow === 'multi-lot').length;
  const singleLot = results.filter(r => r.flow === 'single-lot').length;

  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);
  console.log();
  console.log(`Single-lot sites: ${singleLot}`);
  console.log(`Multi-lot sites: ${multiLot}`);

  if (failed > 0) {
    console.log();
    console.log('Failed resorts (may need investigation):');
    for (const result of results.filter(r => !r.success)) {
      console.log(`  - ${result.name}: ${result.error || 'Calendar not found'}`);
      if (result.notes) console.log(`    ${result.notes}`);
    }
  }

  // Exit with error code if any failed
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
