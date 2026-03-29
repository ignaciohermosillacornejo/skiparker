import { describe, it, expect } from 'vitest';
import { formatDateForSelector, buildDayCellSelector, evaluateAvailabilityRules } from '../../src/resorts/engine.js';

describe('formatDateForSelector', () => {
  it('formats aria-label-long as full weekday date', () => {
    expect(formatDateForSelector('2026-02-15', 'aria-label-long'))
      .toBe('Sunday, February 15, 2026');
  });

  it('formats data-date-iso as YYYY-MM-DD passthrough', () => {
    expect(formatDateForSelector('2026-03-20', 'data-date-iso'))
      .toBe('2026-03-20');
  });

  it('handles leap year dates', () => {
    expect(formatDateForSelector('2028-02-29', 'aria-label-long'))
      .toBe('Tuesday, February 29, 2028');
  });

  it('handles different months', () => {
    expect(formatDateForSelector('2026-01-01', 'aria-label-long'))
      .toBe('Thursday, January 1, 2026');
    expect(formatDateForSelector('2026-12-25', 'aria-label-long'))
      .toBe('Friday, December 25, 2026');
  });
});

describe('buildDayCellSelector', () => {
  it('builds HONK selector with aria-label', () => {
    const calendar = {
      container: '.mbsc-calendar',
      dayCellTemplate: '.mbsc-calendar-day-text[aria-label="{date}"]',
      dateFormat: 'aria-label-long' as const,
      maxNavigationAttempts: 6,
    };
    expect(buildDayCellSelector(calendar, '2026-02-15'))
      .toBe('.mbsc-calendar-day-text[aria-label="Sunday, February 15, 2026"]');
  });

  it('builds Crystal selector with data-date prefix', () => {
    const calendar = {
      container: '#calendar',
      dayCellTemplate: '#calendar .calendar_day[data-date^="{date}"]',
      dateFormat: 'data-date-iso' as const,
      maxNavigationAttempts: 6,
    };
    expect(buildDayCellSelector(calendar, '2026-03-20'))
      .toBe('#calendar .calendar_day[data-date^="2026-03-20"]');
  });
});

describe('evaluateAvailabilityRules', () => {
  const honkRules = [
    { match: { type: 'style-contains' as const, value: 'rgba(49, 200, 25' }, status: 'available' as const },
    { match: { type: 'style-contains' as const, value: 'rgb(247, 205, 212)' }, status: 'sold-out' as const },
    { match: { type: 'aria-disabled' as const, value: 'true' }, status: 'unavailable' as const },
  ];

  it('matches available by style', () => {
    expect(evaluateAvailabilityRules(honkRules, {
      style: 'background-color: rgba(49, 200, 25, 0.2); color: rgb(0, 0, 0);',
      className: '',
      ariaDisabled: null,
    })).toBe('available');
  });

  it('matches sold-out by style', () => {
    expect(evaluateAvailabilityRules(honkRules, {
      style: 'background-color: rgb(247, 205, 212); color: rgb(0, 0, 0);',
      className: '',
      ariaDisabled: null,
    })).toBe('sold-out');
  });

  it('matches unavailable by aria-disabled', () => {
    expect(evaluateAvailabilityRules(honkRules, {
      style: '',
      className: '',
      ariaDisabled: 'true',
    })).toBe('unavailable');
  });

  it('returns no-reservation when no rules match', () => {
    expect(evaluateAvailabilityRules(honkRules, {
      style: 'color: rgb(0, 0, 0);',
      className: '',
      ariaDisabled: null,
    })).toBe('no-reservation');
  });

  it('returns first matching rule (order matters)', () => {
    const rules = [
      { match: { type: 'class-contains' as const, value: 'fc-available' }, status: 'available' as const },
      { match: { type: 'class-contains' as const, value: 'fc' }, status: 'sold-out' as const },
    ];
    expect(evaluateAvailabilityRules(rules, {
      style: '',
      className: 'calendar_day fc-available',
      ariaDisabled: null,
    })).toBe('available');
  });

  it('matches Crystal classes', () => {
    const crystalRules = [
      { match: { type: 'aria-disabled' as const, value: 'true' }, status: 'unavailable' as const },
      { match: { type: 'class-contains' as const, value: 'calendar_disabled' }, status: 'unavailable' as const },
      { match: { type: 'class-contains' as const, value: 'no-reserve' }, status: 'no-reservation' as const },
      { match: { type: 'class-contains' as const, value: 'fc-available' }, status: 'available' as const },
      { match: { type: 'class-contains' as const, value: 'fc-unavailable' }, status: 'sold-out' as const },
    ];

    expect(evaluateAvailabilityRules(crystalRules, {
      style: '', className: 'calendar_day fc-available', ariaDisabled: null,
    })).toBe('available');

    expect(evaluateAvailabilityRules(crystalRules, {
      style: '', className: 'calendar_day fc-unavailable', ariaDisabled: null,
    })).toBe('sold-out');

    expect(evaluateAvailabilityRules(crystalRules, {
      style: '', className: 'calendar_day no-reserve', ariaDisabled: null,
    })).toBe('no-reservation');

    expect(evaluateAvailabilityRules(crystalRules, {
      style: '', className: 'calendar_day calendar_disabled', ariaDisabled: null,
    })).toBe('unavailable');
  });
});
