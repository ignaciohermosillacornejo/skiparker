import { describe, it, expect, afterEach } from 'vitest';
import { resolveDate, resolveResortUrl } from '../../src/lib/resolve.js';
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

describe('resolveResortUrl', () => {
  const originalEnv = process.env.SKI_PARKER_BASE_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SKI_PARKER_BASE_URL;
    } else {
      process.env.SKI_PARKER_BASE_URL = originalEnv;
    }
  });

  it('returns resort URL when configured', () => {
    const config = mockConfig({ resortUrl: 'https://reservenski.parkstevenspass.com' });
    expect(resolveResortUrl(config)).toBe('https://reservenski.parkstevenspass.com');
  });

  it('prefers environment variable over config', () => {
    process.env.SKI_PARKER_BASE_URL = 'https://mock-server.test';
    const config = mockConfig({ resortUrl: 'https://reservenski.parkstevenspass.com' });
    expect(resolveResortUrl(config)).toBe('https://mock-server.test');
  });

  it('uses environment variable when no config', () => {
    process.env.SKI_PARKER_BASE_URL = 'https://mock-server.test';
    const config = mockConfig();
    expect(resolveResortUrl(config)).toBe('https://mock-server.test');
  });

  it('throws when no resort URL configured', () => {
    delete process.env.SKI_PARKER_BASE_URL;
    const config = mockConfig();
    expect(() => resolveResortUrl(config)).toThrow('No resort URL configured');
  });
});
