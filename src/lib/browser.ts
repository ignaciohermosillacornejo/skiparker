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

export async function createBrowser(options: BrowserOptions = {}): Promise<BrowserContext> {
  ensureConfigDir();

  const { headed = false, verbose = false } = options;

  log.verbose(`Launching browser (headed: ${headed})`, verbose);

  const context = await chromium.launchPersistentContext(PATHS.CHROME_PROFILE, {
    headless: !headed,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
    viewport: {
      width: DEFAULTS.VIEWPORT_WIDTH,
      height: DEFAULTS.VIEWPORT_HEIGHT,
    },
    slowMo: DEFAULTS.SLOW_MO,
  });

  return context;
}

export async function saveSession(context: BrowserContext): Promise<void> {
  ensureConfigDir();
  const state = await context.storageState();
  fs.writeFileSync(PATHS.SESSION_FILE, JSON.stringify(state, null, 2));
  log.success('Session saved');
}

export async function loadSession(context: BrowserContext): Promise<boolean> {
  // Skip session requirement when running against mock server (e2e tests)
  if (process.env.SKI_PARKER_BASE_URL) {
    return true;
  }

  if (!fs.existsSync(PATHS.SESSION_FILE)) {
    return false;
  }

  try {
    const state = JSON.parse(fs.readFileSync(PATHS.SESSION_FILE, 'utf-8'));
    await context.addCookies(state.cookies || []);
    return true;
  } catch {
    return false;
  }
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
