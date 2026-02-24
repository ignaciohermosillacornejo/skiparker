import { chromium } from 'playwright-extra';
import type { BrowserContext, Page, Cookie } from 'playwright-core';
import stealth from 'puppeteer-extra-plugin-stealth';
import fs from 'node:fs';
import { PATHS, DEFAULTS, getUrls } from '../constants.js';
import { log } from './utils.js';
import { ensureConfigDir } from './config.js';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Apply stealth plugin
chromium.use(stealth());

export interface BrowserOptions {
  headed?: boolean;
  verbose?: boolean;
}

/**
 * Check whether a saved session file exists (or test env is set).
 */
export function hasSession(): boolean {
  if (process.env.SKI_PARKER_BASE_URL) return true;
  return fs.existsSync(PATHS.SESSION_FILE);
}

/**
 * Create a browser context.
 *
 * - headed mode: uses launchPersistentContext (for interactive auth)
 * - headless mode: uses chromium.launch() + newContext({ storageState })
 *   so that the full storage state (cookies + localStorage/origins) is restored.
 */
export async function createBrowser(options: BrowserOptions = {}): Promise<BrowserContext> {
  ensureConfigDir();

  const { headed = false, verbose = false } = options;

  log.verbose(`Launching browser (headed: ${headed})`, verbose);

  const commonArgs = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
  ];
  const viewport = {
    width: DEFAULTS.VIEWPORT_WIDTH,
    height: DEFAULTS.VIEWPORT_HEIGHT,
  };

  if (headed) {
    // Interactive mode — persistent context keeps profile across auth sessions
    const context = await chromium.launchPersistentContext(PATHS.CHROME_PROFILE, {
      headless: false,
      channel: 'chrome',
      args: commonArgs,
      viewport,
      slowMo: DEFAULTS.SLOW_MO,
    });
    return context;
  }

  // Headless mode — use standard launch + storageState for full session restore
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: commonArgs,
  });

  const contextOptions: Parameters<typeof browser.newContext>[0] = {
    viewport,
  };

  // Restore full storage state (cookies + localStorage/origins) if available
  if (hasSession()) {
    contextOptions.storageState = PATHS.SESSION_FILE;
    log.verbose('Restoring session from storage state', verbose);
  }

  const context = await browser.newContext(contextOptions);
  return context;
}

/**
 * Close a browser context and its parent browser (if any).
 * Handles both persistent contexts (no parent browser) and standard contexts.
 */
export async function closeBrowser(context: BrowserContext): Promise<void> {
  await context.close();
  // Standard contexts have a parent browser that also needs closing
  const browser = context.browser();
  if (browser) {
    await browser.close();
  }
}

export async function saveSession(context: BrowserContext): Promise<void> {
  ensureConfigDir();
  const state = await context.storageState();
  fs.writeFileSync(PATHS.SESSION_FILE, JSON.stringify(state, null, 2));
  log.success('Session saved');
}

export async function isLoggedIn(page: Page, resortUrl?: string): Promise<boolean> {
  try {
    const urls = getUrls(resortUrl);
    await page.goto(urls.BASE, { waitUntil: 'networkidle' });

    // Check if we're redirected to login
    const url = page.url();
    if (url.includes('/login')) {
      return false;
    }

    // Look for logged-in indicators (adjust selectors based on actual site)
    const logoutButton = await page.$('button:has-text("Logout"), button:has-text("Sign Out"), [data-testid="logout"]');
    return logoutButton !== null;
  } catch {
    return false;
  }
}

export interface SessionStatus {
  valid: boolean;
  expiresAt?: Date;
  expiresInMs?: number;
  warning?: string;
}

/**
 * Check session validity and expiration.
 * Returns status including whether session is expiring soon.
 */
export async function checkSessionStatus(context: BrowserContext): Promise<SessionStatus> {
  // Skip check when running against mock server
  if (process.env.SKI_PARKER_BASE_URL) {
    return { valid: true };
  }

  const cookies = await context.cookies();

  if (cookies.length === 0) {
    return { valid: false, warning: 'No session cookies found' };
  }

  // Find auth-related cookies (HONK uses various cookie names)
  const authCookies = cookies.filter(c =>
    c.name.toLowerCase().includes('auth') ||
    c.name.toLowerCase().includes('session') ||
    c.name.toLowerCase().includes('token') ||
    c.domain.includes('honk')
  );

  if (authCookies.length === 0) {
    // Check all cookies for expiration as fallback
    return checkCookieExpiration(cookies);
  }

  return checkCookieExpiration(authCookies);
}

function checkCookieExpiration(cookies: Cookie[]): SessionStatus {
  const now = Date.now();
  let earliestExpiry: number | null = null;

  for (const cookie of cookies) {
    // expires is in seconds since epoch, -1 means session cookie
    if (cookie.expires > 0) {
      const expiresMs = cookie.expires * 1000;
      if (earliestExpiry === null || expiresMs < earliestExpiry) {
        earliestExpiry = expiresMs;
      }
    }
  }

  // No expiring cookies found (all session cookies)
  if (earliestExpiry === null) {
    return { valid: true };
  }

  const expiresInMs = earliestExpiry - now;
  const expiresAt = new Date(earliestExpiry);

  // Already expired
  if (expiresInMs <= 0) {
    return {
      valid: false,
      expiresAt,
      expiresInMs: 0,
      warning: 'Session has expired. Run `ski-parker auth` to re-authenticate.',
    };
  }

  // Expiring within 24 hours
  if (expiresInMs < TWENTY_FOUR_HOURS_MS) {
    const hoursLeft = Math.floor(expiresInMs / (60 * 60 * 1000));
    return {
      valid: true,
      expiresAt,
      expiresInMs,
      warning: `Session expires in ${hoursLeft} hours. Consider running \`ski-parker auth\` to refresh.`,
    };
  }

  return {
    valid: true,
    expiresAt,
    expiresInMs,
  };
}

/**
 * Validate session by actually checking if we're logged in.
 * More reliable but slower than cookie-based check.
 */
export async function validateSession(
  context: BrowserContext,
  resortUrl?: string,
  verbose = false
): Promise<{ valid: boolean; warning?: string }> {
  // Skip validation when running against mock server
  if (process.env.SKI_PARKER_BASE_URL) {
    return { valid: true };
  }

  // First check cookie-based status
  const cookieStatus = await checkSessionStatus(context);

  if (!cookieStatus.valid) {
    return { valid: false, warning: cookieStatus.warning };
  }

  // If cookies look valid but expiring soon, warn user
  if (cookieStatus.warning) {
    log.warn(cookieStatus.warning);
  }

  // Actually verify we're logged in by checking the site
  const page = await context.newPage();
  try {
    const loggedIn = await isLoggedIn(page, resortUrl);
    if (!loggedIn) {
      return {
        valid: false,
        warning: 'Session expired. Run `ski-parker auth` to re-authenticate.',
      };
    }
    return { valid: true, warning: cookieStatus.warning };
  } finally {
    await page.close();
  }
}
