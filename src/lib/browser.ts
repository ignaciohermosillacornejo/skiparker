import { chromium } from 'playwright-extra';
import type { BrowserContext, Page } from 'playwright-core';
import stealth from 'puppeteer-extra-plugin-stealth';
import fs from 'node:fs';
import { PATHS, DEFAULTS, URLS } from '../constants.js';
import { log } from './utils.js';
import { ensureConfigDir } from './config.js';

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

export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    await page.goto(URLS.BASE, { waitUntil: 'networkidle' });

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
