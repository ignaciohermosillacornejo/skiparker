import { describe, it, expect } from 'vitest';
import {
  formatDateForAriaLabel,
  parseAvailabilityFromStyle,
  buildCalendarDaySelector,
  buildRateCardSelector,
  buildLotCardSelector,
  buildLotDiscoverySelector,
  CALENDAR_COLORS,
} from '../../src/lib/selectors.js';

describe('formatDateForAriaLabel', () => {
  it('formats a date string to full weekday format', () => {
    expect(formatDateForAriaLabel('2026-02-15')).toBe('Sunday, February 15, 2026');
  });

  it('handles different months correctly', () => {
    expect(formatDateForAriaLabel('2026-01-01')).toBe('Thursday, January 1, 2026');
    expect(formatDateForAriaLabel('2026-12-25')).toBe('Friday, December 25, 2026');
  });

  it('handles leap year dates', () => {
    expect(formatDateForAriaLabel('2028-02-29')).toBe('Tuesday, February 29, 2028');
  });
});

describe('parseAvailabilityFromStyle', () => {
  it('returns available when style contains green color', () => {
    const style = 'background-color: rgba(49, 200, 25, 0.2); color: rgb(0, 0, 0);';
    expect(parseAvailabilityFromStyle(style)).toBe('available');
  });

  it('returns sold-out when style contains pink/red color', () => {
    const style = 'background-color: rgb(247, 205, 212); color: rgb(0, 0, 0);';
    expect(parseAvailabilityFromStyle(style)).toBe('sold-out');
  });

  it('returns unknown when style has no recognized color', () => {
    const style = 'color: rgb(0, 0, 0);';
    expect(parseAvailabilityFromStyle(style)).toBe('unknown');
  });

  it('returns unknown for empty style', () => {
    expect(parseAvailabilityFromStyle('')).toBe('unknown');
  });

  it('accepts custom colors configuration', () => {
    const customColors = {
      available: 'rgb(0, 255, 0)',
      soldOut: 'rgb(255, 0, 0)',
    };
    expect(parseAvailabilityFromStyle('background: rgb(0, 255, 0)', customColors)).toBe('available');
    expect(parseAvailabilityFromStyle('background: rgb(255, 0, 0)', customColors)).toBe('sold-out');
  });
});

describe('buildCalendarDaySelector', () => {
  it('builds selector with formatted aria-label', () => {
    const selector = buildCalendarDaySelector('2026-02-15');
    expect(selector).toBe('.mbsc-calendar-day-text[aria-label="Sunday, February 15, 2026"]');
  });

  it('handles different dates correctly', () => {
    const selector = buildCalendarDaySelector('2026-03-21');
    expect(selector).toBe('.mbsc-calendar-day-text[aria-label="Saturday, March 21, 2026"]');
  });
});

describe('buildRateCardSelector', () => {
  it('builds selector for Carpool rate card', () => {
    const selector = buildRateCardSelector('Carpool');
    expect(selector).toBe('[class*="containerActive"] [class*="card"]:has-text("Carpool")');
  });

  it('builds selector for Paid rate card', () => {
    const selector = buildRateCardSelector('Paid');
    expect(selector).toBe('[class*="containerActive"] [class*="card"]:has-text("Paid")');
  });

  it('handles custom labels', () => {
    const selector = buildRateCardSelector('Free Passholder');
    expect(selector).toBe('[class*="containerActive"] [class*="card"]:has-text("Free Passholder")');
  });
});

describe('buildLotCardSelector', () => {
  it('builds selector for lot by name', () => {
    const selector = buildLotCardSelector('CREEKSIDE');
    expect(selector).toBe('[class*="containerActive"] [class*="card"]:has-text("CREEKSIDE")');
  });

  it('handles lot names with spaces', () => {
    const selector = buildLotCardSelector('UPPER LOTS');
    expect(selector).toBe('[class*="containerActive"] [class*="card"]:has-text("UPPER LOTS")');
  });
});

describe('buildLotDiscoverySelector', () => {
  it('returns the SelectZone card selector', () => {
    const selector = buildLotDiscoverySelector();
    expect(selector).toBe('[class*="SelectZone"] [class*="card"]');
  });
});

describe('CALENDAR_COLORS', () => {
  it('has expected available color', () => {
    expect(CALENDAR_COLORS.available).toBe('rgba(49, 200, 25');
  });

  it('has expected soldOut color', () => {
    expect(CALENDAR_COLORS.soldOut).toBe('rgb(247, 205, 212)');
  });
});
