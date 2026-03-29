import { describe, it, expect } from 'vitest';
import { descriptor } from '../../src/resorts/stevens-pass/descriptor.js';
import { hooks } from '../../src/resorts/stevens-pass/hooks.js';
import { buildDayCellSelector, evaluateAvailabilityRules } from '../../src/resorts/engine.js';

describe('Stevens Pass descriptor', () => {
  it('has correct id and platform', () => {
    expect(descriptor.id).toBe('stevens-pass');
    expect(descriptor.platform).toBe('honk');
  });

  it('builds correct HONK calendar selector', () => {
    const selector = buildDayCellSelector(descriptor.calendar, '2026-02-15');
    expect(selector).toBe('.mbsc-calendar-day-text[aria-label="Sunday, February 15, 2026"]');
  });

  it('builds selector for different date', () => {
    const selector = buildDayCellSelector(descriptor.calendar, '2026-03-21');
    expect(selector).toBe('.mbsc-calendar-day-text[aria-label="Saturday, March 21, 2026"]');
  });

  it('detects available from green style', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: 'background-color: rgba(49, 200, 25, 0.2); color: rgb(0, 0, 0);',
      className: '', ariaDisabled: null,
    })).toBe('available');
  });

  it('detects sold-out from pink style', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: 'background-color: rgb(247, 205, 212); color: rgb(0, 0, 0);',
      className: '', ariaDisabled: null,
    })).toBe('sold-out');
  });

  it('detects unavailable from aria-disabled', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: '', className: '', ariaDisabled: 'true',
    })).toBe('unavailable');
  });

  it('returns no-reservation for unstyled dates', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: 'color: rgb(0, 0, 0);', className: '', ariaDisabled: null,
    })).toBe('no-reservation');
  });

  it('supports lot discovery', () => {
    expect(descriptor.lots.supported).toBe(true);
    expect(descriptor.lots.discoverySelector).toBeDefined();
  });

  it('has correct URLs', () => {
    expect(descriptor.urls.base).toBe('https://reservenski.parkstevenspass.com');
    expect(descriptor.urls.reservations).toBe('/select-parking');
    expect(descriptor.urls.login).toBe('/login');
    expect(descriptor.urls.promo).toBe('/code');
  });
});

describe('Stevens Pass hooks', () => {
  it('exports findDateElement hook', () => {
    expect(hooks.findDateElement).toBeDefined();
    expect(typeof hooks.findDateElement).toBe('function');
  });
});
