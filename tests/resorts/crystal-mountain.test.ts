import { describe, it, expect } from 'vitest';
import { descriptor } from '../../src/resorts/crystal-mountain/descriptor.js';
import { buildDayCellSelector, evaluateAvailabilityRules } from '../../src/resorts/engine.js';

describe('Crystal Mountain descriptor', () => {
  it('has correct id and platform', () => {
    expect(descriptor.id).toBe('crystal-mountain');
    expect(descriptor.platform).toBe('crystal');
  });

  it('builds correct Crystal calendar selector', () => {
    const selector = buildDayCellSelector(descriptor.calendar, '2026-03-20');
    expect(selector).toBe('#calendar .calendar_day[data-date^="2026-03-20"]');
  });

  it('detects available from fc-available class', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: '', className: 'calendar_day fc-available', ariaDisabled: null,
    })).toBe('available');
  });

  it('detects sold-out from fc-unavailable class', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: '', className: 'calendar_day fc-unavailable', ariaDisabled: null,
    })).toBe('sold-out');
  });

  it('detects no-reservation from no-reserve class', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: '', className: 'calendar_day no-reserve', ariaDisabled: null,
    })).toBe('no-reservation');
  });

  it('detects unavailable from calendar_disabled class', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: '', className: 'calendar_day calendar_disabled', ariaDisabled: null,
    })).toBe('unavailable');
  });

  it('detects unavailable from aria-disabled', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: '', className: 'calendar_day', ariaDisabled: 'true',
    })).toBe('unavailable');
  });

  it('does not support lots', () => {
    expect(descriptor.lots.supported).toBe(false);
  });

  it('has reservations at root path', () => {
    expect(descriptor.urls.reservations).toBe('/');
  });

  it('has correct URLs', () => {
    expect(descriptor.urls.base).toBe('https://parking.crystalmountainresort.com');
    expect(descriptor.urls.login).toBe('/login');
  });
});
