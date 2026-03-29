import { describe, it, expect, afterEach } from 'vitest';
import { resolveDate, resolveResort } from '../../src/lib/resolve.js';
import type { Config } from '../../src/types.js';

const mockConfig = (overrides: Partial<Config> = {}): Config => ({
  pollInterval: 60,
  jitter: 20,
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

describe('resolveResort', () => {
  const originalBaseUrl = process.env.SKI_PARKER_BASE_URL;
  const originalPlatform = process.env.SKI_PARKER_PLATFORM;

  afterEach(() => {
    if (originalBaseUrl === undefined) delete process.env.SKI_PARKER_BASE_URL;
    else process.env.SKI_PARKER_BASE_URL = originalBaseUrl;
    if (originalPlatform === undefined) delete process.env.SKI_PARKER_PLATFORM;
    else process.env.SKI_PARKER_PLATFORM = originalPlatform;
  });

  it('resolves Stevens Pass by URL', () => {
    const config = mockConfig({ resortUrl: 'https://reservenski.parkstevenspass.com' });
    const resort = resolveResort(config);
    expect(resort.descriptor.id).toBe('stevens-pass');
  });

  it('resolves Crystal Mountain by URL', () => {
    const config = mockConfig({ resortUrl: 'https://parking.crystalmountainresort.com' });
    const resort = resolveResort(config);
    expect(resort.descriptor.id).toBe('crystal-mountain');
  });

  it('throws on unknown URL', () => {
    const config = mockConfig({ resortUrl: 'https://unknown-resort.example.com' });
    expect(() => resolveResort(config)).toThrow(/no resort matches/i);
  });

  it('throws when no URL configured', () => {
    delete process.env.SKI_PARKER_BASE_URL;
    const config = mockConfig();
    expect(() => resolveResort(config)).toThrow('No resort URL configured');
  });

  it('uses SKI_PARKER_BASE_URL with default platform', () => {
    process.env.SKI_PARKER_BASE_URL = 'http://localhost:3847';
    delete process.env.SKI_PARKER_PLATFORM;
    const config = mockConfig();
    const resort = resolveResort(config);
    expect(resort.descriptor.id).toBe('stevens-pass');
    expect(resort.descriptor.urls.base).toBe('http://localhost:3847');
  });

  it('uses SKI_PARKER_PLATFORM to select descriptor', () => {
    process.env.SKI_PARKER_BASE_URL = 'http://localhost:3847';
    process.env.SKI_PARKER_PLATFORM = 'crystal-mountain';
    const config = mockConfig();
    const resort = resolveResort(config);
    expect(resort.descriptor.id).toBe('crystal-mountain');
    expect(resort.descriptor.urls.base).toBe('http://localhost:3847');
  });
});
