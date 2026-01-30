import { describe, it, expect } from 'vitest';
import { resolveDate, resolveType, resolvePlate, resolveResortUrl } from '../../src/lib/resolve.js';
import type { Config } from '../../src/types.js';

const mockConfig = (overrides: Partial<Config> = {}): Config => ({
  pollInterval: 300,
  jitter: 60,
  notifications: { desktop: true, sound: true },
  browser: { headless: true, slowMo: 50 },
  ...overrides,
});

describe('resolveDate', () => {
  it('returns valid future date unchanged', () => {
    const futureDate = '2030-06-15';
    expect(resolveDate(futureDate)).toBe(futureDate);
  });

  it('throws on invalid date format', () => {
    expect(() => resolveDate('2026-0215')).toThrow('Invalid date format');
    expect(() => resolveDate('02-15-2026')).toThrow('Invalid date format');
    expect(() => resolveDate('2026/02/15')).toThrow('Invalid date format');
  });

  it('throws on past date', () => {
    expect(() => resolveDate('2020-01-01')).toThrow('in the past');
  });
});

describe('resolveType', () => {
  it('returns flag value when provided', () => {
    const config = mockConfig({ defaultType: 'carpool' });
    expect(resolveType('paid', config)).toBe('paid');
  });

  it('falls back to config default when no flag', () => {
    const config = mockConfig({ defaultType: 'carpool' });
    expect(resolveType(undefined, config)).toBe('carpool');
  });

  it('throws when no type available', () => {
    const config = mockConfig();
    expect(() => resolveType(undefined, config)).toThrow('No type configured');
  });

  it('throws on invalid type', () => {
    const config = mockConfig();
    expect(() => resolveType('express', config)).toThrow('Invalid type: express');
  });

  it('accepts paid type', () => {
    const config = mockConfig();
    expect(resolveType('paid', config)).toBe('paid');
  });

  it('accepts carpool type', () => {
    const config = mockConfig();
    expect(resolveType('carpool', config)).toBe('carpool');
  });

  it('accepts free type', () => {
    const config = mockConfig();
    expect(resolveType('free', config)).toBe('free');
  });
});

describe('resolvePlate', () => {
  it('returns flag value when provided', () => {
    const config = mockConfig({ defaultPlate: 'ABC123' });
    expect(resolvePlate('XYZ789', config)).toBe('XYZ789');
  });

  it('falls back to config default when no flag', () => {
    const config = mockConfig({ defaultPlate: 'ABC123' });
    expect(resolvePlate(undefined, config)).toBe('ABC123');
  });

  it('throws when no plate available', () => {
    const config = mockConfig();
    expect(() => resolvePlate(undefined, config)).toThrow('No plate configured');
  });
});

describe('resolveResortUrl', () => {
  it('returns resort URL when configured', () => {
    const config = mockConfig({ resortUrl: 'https://reservenski.parkstevenspass.com' });
    expect(resolveResortUrl(config)).toBe('https://reservenski.parkstevenspass.com');
  });

  it('throws when no resort URL configured', () => {
    const config = mockConfig();
    expect(() => resolveResortUrl(config)).toThrow('No resort URL configured');
  });
});
