import { describe, it, expect, vi, afterEach } from 'vitest';
import type { BrowserContext, Cookie } from 'playwright-core';

// Mock modules with side effects before importing the function under test
vi.mock('playwright-extra', () => ({
  chromium: {
    use: vi.fn(),
    launch: vi.fn(),
    launchPersistentContext: vi.fn(),
  },
}));

vi.mock('puppeteer-extra-plugin-stealth', () => ({
  default: vi.fn(() => ({})),
}));

vi.mock('../../src/lib/config.js', () => ({
  ensureConfigDir: vi.fn(),
}));

import { checkSessionStatus } from '../../src/lib/browser.js';

function makeCookie(overrides: Partial<Cookie> = {}): Cookie {
  return {
    name: 'test',
    value: 'value',
    domain: 'example.com',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
    ...overrides,
  };
}

function mockContext(cookies: Cookie[]): BrowserContext {
  return {
    cookies: vi.fn().mockResolvedValue(cookies),
  } as unknown as BrowserContext;
}

describe('checkSessionStatus', () => {
  const originalEnv = process.env.SKI_PARKER_BASE_URL;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SKI_PARKER_BASE_URL = originalEnv;
    } else {
      delete process.env.SKI_PARKER_BASE_URL;
    }
  });

  it('returns valid when no cookies exist (localStorage-only auth)', async () => {
    const ctx = mockContext([]);
    const status = await checkSessionStatus(ctx);
    expect(status.valid).toBe(true);
    expect(status.warning).toBeUndefined();
  });

  it('returns valid when no cookies exist even with SKI_PARKER_BASE_URL set', async () => {
    process.env.SKI_PARKER_BASE_URL = 'http://localhost:3847';
    const ctx = mockContext([]);
    const status = await checkSessionStatus(ctx);
    expect(status.valid).toBe(true);
  });

  it('returns valid for session cookies (expires = -1)', async () => {
    const ctx = mockContext([
      makeCookie({ name: 'session_id', expires: -1 }),
    ]);
    const status = await checkSessionStatus(ctx);
    expect(status.valid).toBe(true);
    expect(status.warning).toBeUndefined();
  });

  it('returns valid for cookies expiring far in the future', async () => {
    const farFuture = (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000; // 30 days
    const ctx = mockContext([
      makeCookie({ name: 'auth_token', domain: 'honk.com', expires: farFuture }),
    ]);
    const status = await checkSessionStatus(ctx);
    expect(status.valid).toBe(true);
    expect(status.warning).toBeUndefined();
    expect(status.expiresAt).toBeDefined();
  });

  it('returns valid with warning for cookies expiring within 24 hours', async () => {
    const soonExpiry = (Date.now() + 6 * 60 * 60 * 1000) / 1000; // 6 hours
    const ctx = mockContext([
      makeCookie({ name: 'auth_token', domain: 'honk.com', expires: soonExpiry }),
    ]);
    const status = await checkSessionStatus(ctx);
    expect(status.valid).toBe(true);
    expect(status.warning).toContain('expires in');
    expect(status.warning).toContain('hours');
  });

  it('returns invalid for expired cookies', async () => {
    const pastExpiry = (Date.now() - 60 * 60 * 1000) / 1000; // 1 hour ago
    const ctx = mockContext([
      makeCookie({ name: 'auth_token', domain: 'honk.com', expires: pastExpiry }),
    ]);
    const status = await checkSessionStatus(ctx);
    expect(status.valid).toBe(false);
    expect(status.warning).toContain('expired');
  });

  it('uses auth cookies when available over generic cookies', async () => {
    const farFuture = (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000;
    const pastExpiry = (Date.now() - 60 * 60 * 1000) / 1000;
    const ctx = mockContext([
      makeCookie({ name: 'tracking', expires: pastExpiry }), // expired generic
      makeCookie({ name: 'auth_token', domain: 'honk.com', expires: farFuture }), // valid auth
    ]);
    const status = await checkSessionStatus(ctx);
    expect(status.valid).toBe(true); // auth cookie is valid
  });

  it('falls back to all cookies when no auth cookies found', async () => {
    const pastExpiry = (Date.now() - 60 * 60 * 1000) / 1000;
    const ctx = mockContext([
      makeCookie({ name: 'tracking', domain: 'example.com', expires: pastExpiry }),
    ]);
    const status = await checkSessionStatus(ctx);
    expect(status.valid).toBe(false); // expired generic cookie
  });

  it('reports earliest expiry among multiple auth cookies', async () => {
    const sooner = (Date.now() + 2 * 60 * 60 * 1000) / 1000; // 2 hours
    const later = (Date.now() + 20 * 60 * 60 * 1000) / 1000; // 20 hours
    const ctx = mockContext([
      makeCookie({ name: 'session_v1', domain: 'honk.com', expires: sooner }),
      makeCookie({ name: 'token_v2', domain: 'honk.com', expires: later }),
    ]);
    const status = await checkSessionStatus(ctx);
    expect(status.valid).toBe(true);
    expect(status.warning).toContain('expires in');
    // Math.floor(2h / 1h) = 2
    expect(status.warning).toContain('2 hours');
  });

  it('identifies auth cookies by name pattern', async () => {
    const farFuture = (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000;
    // These names contain 'auth', 'session', or 'token' (case-insensitive)
    for (const name of ['auth_token', 'session_id', 'access_token', 'MY_SESSION_KEY']) {
      const ctx = mockContext([
        makeCookie({ name, expires: farFuture }),
      ]);
      const status = await checkSessionStatus(ctx);
      expect(status.valid).toBe(true);
    }
  });

  it('identifies auth cookies by honk domain', async () => {
    const farFuture = (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000;
    const ctx = mockContext([
      makeCookie({ name: 'xyz', domain: 'app.honk.com', expires: farFuture }),
    ]);
    const status = await checkSessionStatus(ctx);
    expect(status.valid).toBe(true);
  });

  it('returns expiresInMs for non-expired cookies with expiry', async () => {
    const farFuture = (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000;
    const ctx = mockContext([
      makeCookie({ name: 'auth_token', expires: farFuture }),
    ]);
    const status = await checkSessionStatus(ctx);
    expect(status.expiresInMs).toBeGreaterThan(0);
  });

  it('returns expiresInMs as 0 for expired cookies', async () => {
    const pastExpiry = (Date.now() - 60 * 60 * 1000) / 1000;
    const ctx = mockContext([
      makeCookie({ name: 'auth_token', expires: pastExpiry }),
    ]);
    const status = await checkSessionStatus(ctx);
    expect(status.expiresInMs).toBe(0);
  });
});
