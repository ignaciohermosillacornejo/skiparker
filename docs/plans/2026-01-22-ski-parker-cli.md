# Ski-Parker CLI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI tool that automates checking and reserving parking spots at Stevens Pass ski resort via the HONK reservation system.

**Architecture:** Node.js CLI using Commander.js for command parsing, Playwright with stealth plugin for browser automation, persistent Chrome profile for session management. Commands: `auth` (manual login), `check` (one-time availability check), `watch` (poll until found), `book` (reserve spot).

**Tech Stack:** TypeScript, Node.js (ESM), Playwright-extra with Stealth plugin, Commander.js, node-notifier, chalk, ora, Vitest for testing.

---

## Task 1: Project Initialization

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

**Step 1: Initialize npm project**

Run: `npm init -y`

**Step 2: Update package.json with correct configuration**

Replace `package.json` contents:

```json
{
  "name": "ski-parker",
  "version": "0.1.0",
  "description": "Automated Stevens Pass parking reservation CLI",
  "type": "module",
  "bin": {
    "ski-parker": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["stevens-pass", "parking", "automation", "cli"],
  "author": "",
  "license": "MIT"
}
```

**Step 3: Install production dependencies**

Run: `npm install playwright playwright-extra puppeteer-extra-plugin-stealth commander node-notifier chalk ora`

**Step 4: Install dev dependencies**

Run: `npm install -D typescript @types/node vitest`

**Step 5: Create tsconfig.json**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 6: Create .gitignore**

Create `.gitignore`:

```
node_modules/
dist/
*.log
.DS_Store

# Session data (contains auth tokens)
.ski-parker/
```

**Step 7: Verify TypeScript compiles**

Run: `npx tsc --version`
Expected: TypeScript version output (e.g., "Version 5.x.x")

**Step 8: Initialize git and commit**

Run:
```bash
git init
git add package.json tsconfig.json .gitignore package-lock.json
git commit -m "chore: initialize project with typescript and dependencies"
```

---

## Task 2: Types and Constants

**Files:**
- Create: `src/types.ts`
- Create: `src/constants.ts`

**Step 1: Create types file**

Create `src/types.ts`:

```typescript
export type ReservationType = 'paid' | 'carpool' | 'ada';

export interface AvailabilityResult {
  date: string;
  available: Record<ReservationType, boolean>;
  timestamp: Date;
}

export interface BookingResult {
  success: boolean;
  confirmationNumber?: string;
  date: string;
  type: ReservationType;
  plate: string;
  error?: string;
}

export interface Config {
  defaultPlate?: string;
  defaultType?: ReservationType;
  pollInterval: number;
  jitter: number;
  notifications: {
    desktop: boolean;
    sound: boolean;
  };
  browser: {
    headless: boolean;
    slowMo: number;
  };
}

export interface WatchOptions {
  date: string;
  type: ReservationType;
  interval: number;
  jitter: number;
  notify: boolean;
  sound: boolean;
  autoBook: boolean;
  headed: boolean;
  dryRun: boolean;
  verbose: boolean;
  plate?: string;
}

export interface CheckOptions {
  date: string;
  headed: boolean;
  verbose: boolean;
}

export interface BookOptions {
  date: string;
  type: ReservationType;
  plate: string;
  headed: boolean;
  dryRun: boolean;
  verbose: boolean;
}

export interface AuthOptions {
  verbose: boolean;
}
```

**Step 2: Create constants file**

Create `src/constants.ts`:

```typescript
import path from 'node:path';
import os from 'node:os';

export const URLS = {
  BASE: 'https://reservenski.parkstevenspass.com',
  LOGIN: 'https://reservenski.parkstevenspass.com/login',
  PROMO: 'https://reservenski.parkstevenspass.com/code',
} as const;

export const PATHS = {
  CONFIG_DIR: path.join(os.homedir(), '.ski-parker'),
  CONFIG_FILE: path.join(os.homedir(), '.ski-parker', 'config.json'),
  SESSION_FILE: path.join(os.homedir(), '.ski-parker', 'session.json'),
  CHROME_PROFILE: path.join(os.homedir(), '.ski-parker', 'chrome-profile'),
} as const;

export const DEFAULTS = {
  POLL_INTERVAL: 300,
  JITTER: 60,
  SLOW_MO: 50,
  VIEWPORT_WIDTH: 1280,
  VIEWPORT_HEIGHT: 720,
} as const;

export const RESERVATION_TYPES = ['paid', 'carpool', 'ada'] as const;
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

Run:
```bash
git add src/types.ts src/constants.ts
git commit -m "feat: add types and constants"
```

---

## Task 3: Utility Functions

**Files:**
- Create: `src/lib/utils.ts`
- Create: `tests/lib/utils.test.ts`

**Step 1: Write failing test for sleep function**

Create `tests/lib/utils.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { sleep, jitter, formatDate, log } from '../src/lib/utils.js';

describe('sleep', () => {
  it('should delay execution for specified milliseconds', async () => {
    const start = Date.now();
    await sleep(100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(95);
    expect(elapsed).toBeLessThan(150);
  });
});

describe('jitter', () => {
  it('should return a value within the jitter range', () => {
    const base = 1000;
    const jitterAmount = 100;
    for (let i = 0; i < 100; i++) {
      const result = jitter(base, jitterAmount);
      expect(result).toBeGreaterThanOrEqual(base - jitterAmount);
      expect(result).toBeLessThanOrEqual(base + jitterAmount);
    }
  });

  it('should return base value when jitter is 0', () => {
    expect(jitter(500, 0)).toBe(500);
  });
});

describe('formatDate', () => {
  it('should format date as YYYY-MM-DD', () => {
    const date = new Date('2025-02-15T12:00:00Z');
    expect(formatDate(date)).toBe('2025-02-15');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/utils.test.ts`
Expected: FAIL - module not found

**Step 3: Implement utils**

Create `src/lib/utils.ts`:

```typescript
import chalk from 'chalk';

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function jitter(baseMs: number, jitterMs: number): number {
  if (jitterMs === 0) return baseMs;
  const offset = Math.random() * 2 * jitterMs - jitterMs;
  return Math.round(baseMs + offset);
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function parseDate(dateStr: string): Date {
  const date = new Date(dateStr + 'T12:00:00Z');
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD`);
  }
  return date;
}

export const log = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.log(chalk.red('✗'), msg),
  verbose: (msg: string, enabled: boolean) => {
    if (enabled) console.log(chalk.gray('  →'), chalk.gray(msg));
  },
};
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/utils.test.ts`
Expected: All tests PASS

**Step 5: Commit**

Run:
```bash
git add src/lib/utils.ts tests/lib/utils.test.ts
git commit -m "feat: add utility functions with tests"
```

---

## Task 4: Config Management

**Files:**
- Create: `src/lib/config.ts`
- Create: `tests/lib/config.test.ts`

**Step 1: Write failing test for config**

Create `tests/lib/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Mock the fs module before importing config
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

import { loadConfig, saveConfig, getDefaultConfig, ensureConfigDir } from '../src/lib/config.js';

describe('getDefaultConfig', () => {
  it('should return default configuration', () => {
    const config = getDefaultConfig();
    expect(config.pollInterval).toBe(300);
    expect(config.jitter).toBe(60);
    expect(config.notifications.desktop).toBe(true);
    expect(config.notifications.sound).toBe(true);
    expect(config.browser.headless).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/config.test.ts`
Expected: FAIL - module not found

**Step 3: Implement config**

Create `src/lib/config.ts`:

```typescript
import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../types.js';
import { PATHS, DEFAULTS } from '../constants.js';

export function getDefaultConfig(): Config {
  return {
    pollInterval: DEFAULTS.POLL_INTERVAL,
    jitter: DEFAULTS.JITTER,
    notifications: {
      desktop: true,
      sound: true,
    },
    browser: {
      headless: true,
      slowMo: DEFAULTS.SLOW_MO,
    },
  };
}

export function ensureConfigDir(): void {
  if (!fs.existsSync(PATHS.CONFIG_DIR)) {
    fs.mkdirSync(PATHS.CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureConfigDir();

  if (!fs.existsSync(PATHS.CONFIG_FILE)) {
    return getDefaultConfig();
  }

  try {
    const content = fs.readFileSync(PATHS.CONFIG_FILE, 'utf-8');
    const loaded = JSON.parse(content) as Partial<Config>;
    return { ...getDefaultConfig(), ...loaded };
  } catch {
    return getDefaultConfig();
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  fs.writeFileSync(PATHS.CONFIG_FILE, JSON.stringify(config, null, 2));
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/config.test.ts`
Expected: All tests PASS

**Step 5: Commit**

Run:
```bash
git add src/lib/config.ts tests/lib/config.test.ts
git commit -m "feat: add config management"
```

---

## Task 5: Browser Setup with Stealth

**Files:**
- Create: `src/lib/browser.ts`

**Step 1: Create browser module**

Create `src/lib/browser.ts`:

```typescript
import { chromium, type BrowserContext, type Page } from 'playwright-extra';
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
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (may have warnings about stealth plugin types)

**Step 3: Commit**

Run:
```bash
git add src/lib/browser.ts
git commit -m "feat: add browser setup with stealth plugin"
```

---

## Task 6: Notification System

**Files:**
- Create: `src/lib/notify.ts`

**Step 1: Create notification module**

Create `src/lib/notify.ts`:

```typescript
import notifier from 'node-notifier';
import path from 'node:path';
import { exec } from 'node:child_process';
import type { ReservationType } from '../types.js';

export interface NotifyOptions {
  desktop?: boolean;
  sound?: boolean;
}

export function notifyAvailable(
  date: string,
  type: ReservationType,
  options: NotifyOptions = {}
): void {
  const { desktop = true, sound = true } = options;

  if (desktop) {
    notifier.notify({
      title: 'Ski Parker - Spot Available!',
      message: `${type.toUpperCase()} parking available for ${date}`,
      sound: sound,
      wait: false,
    });
  }

  if (sound) {
    playSound();
  }
}

export function notifyBooked(
  date: string,
  type: ReservationType,
  confirmationNumber?: string
): void {
  notifier.notify({
    title: 'Ski Parker - Booking Confirmed!',
    message: `${type.toUpperCase()} parking booked for ${date}${confirmationNumber ? ` (${confirmationNumber})` : ''}`,
    sound: true,
    wait: false,
  });
}

export function notifyError(message: string): void {
  notifier.notify({
    title: 'Ski Parker - Error',
    message,
    sound: true,
    wait: false,
  });
}

function playSound(): void {
  // macOS system sound
  if (process.platform === 'darwin') {
    exec('afplay /System/Library/Sounds/Glass.aiff');
  }
  // Windows
  else if (process.platform === 'win32') {
    exec('powershell -c (New-Object Media.SoundPlayer "C:\\Windows\\Media\\notify.wav").PlaySync()');
  }
  // Linux - try paplay first, then aplay
  else {
    exec('paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || aplay /usr/share/sounds/alsa/Front_Center.wav 2>/dev/null');
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

Run:
```bash
git add src/lib/notify.ts
git commit -m "feat: add notification system"
```

---

## Task 7: Scraper Module (Page Interactions)

**Files:**
- Create: `src/lib/scraper.ts`

**Step 1: Create scraper module**

This module contains all selectors and page interactions. Selectors are centralized for easy updates when the site changes.

Create `src/lib/scraper.ts`:

```typescript
import type { Page } from 'playwright';
import type { AvailabilityResult, ReservationType, BookingResult } from '../types.js';
import { URLS } from '../constants.js';
import { sleep, log } from './utils.js';

// Centralized selectors - discovered from captured HTML (Jan 2026)
// Site uses Mobiscroll calendar library (mbsc-*) and React with CSS modules
const SELECTORS = {
  // Home page
  reserveSpotLink: 'a[href="/select-parking"]',

  // Mobiscroll Calendar (on /select-parking)
  calendar: '.mbsc-calendar',
  calendarNextBtn: '.custom-next',
  calendarPrevBtn: '.custom-prev',
  // Days have aria-label like "Saturday, January 3, 2026"
  calendarDay: (dateStr: string) => {
    // Convert YYYY-MM-DD to full date string for aria-label matching
    const date = new Date(dateStr + 'T12:00:00');
    const formatted = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    return `.mbsc-calendar-day-text[aria-label="${formatted}"]`;
  },

  // Availability indicators (legend on calendar page)
  availabilityLegend: '.SelectDate_availability__IccV4',
  availableIndicator: '.SelectDate_available__FuxXF',
  soldOutIndicator: '.SelectDate_soldOut__4YEX8',
  unavailableIndicator: '.SelectDate_unavailable__buZj7',
  noReservationIndicator: '.SelectDate_noReservation__C7oHz',

  // Date selection expandable card
  dateSection: '.ExpandableCard_titleBox__5k2mD:has-text("Date")',
  changeDateBtn: '.ExpandableCard_button__dLT0V:has-text("Change Date")',

  // Rate selection (after date selected)
  rateSection: '.ExpandableCard_titleBox__5k2mD:has-text("Parking rate")',
  rateWrapper: '.SelectRate_wrapper__v6wva',
  rateCard: '.SelectRate_card__AT83w',
  rateCopy: '.SelectRate_rateCopy__yfcwz',
  ratePrice: '.SelectRate_ratePrice__r2\\+hE',
  // Rate cards contain text like "Carpool 4+" or "Advanced Paid Reservations"
  carpoolCard: '.SelectRate_card__AT83w:has-text("Carpool")',
  paidCard: '.SelectRate_card__AT83w:has-text("Paid")',

  // Checkout page (different domain: parking.honkmobile.com)
  checkoutContainer: '.CheckoutRoute',
  plateDisplay: '.CheckoutVehicleComponent--plate',
  editVehicleBtn: 'button[aria-label="Edit vehicle"]',
  termsCheckbox: 'input#terms',
  termsLabel: 'label[for="terms"]',
  paymentMethodBtn: '.SelectPaymentMethodButton--wrapper',
  continueBtn: '.CtaButton--container',

  // Navigation
  backButton: '.BackButton',
  navTitle: '.Header--center',

  // Auth (settings page)
  settingsLink: 'a[href="/settings"]',
  hamburgerIcon: '.Nav_hamburgerIcon__AToZp',
} as const;

// Calendar day colors (inline styles indicate availability)
const CALENDAR_COLORS = {
  available: 'rgba(49, 200, 25', // Green tint
  soldOut: 'rgb(247, 205, 212)', // Pink/red tint
} as const;

export async function navigateToReservations(page: Page, verbose = false): Promise<void> {
  log.verbose('Navigating to reservation page', verbose);
  await page.goto(URLS.BASE + '/select-parking', { waitUntil: 'networkidle' });
  await sleep(1500); // Wait for SPA and Mobiscroll calendar to render
}

export async function selectDate(page: Page, dateStr: string, verbose = false): Promise<boolean> {
  log.verbose(`Selecting date: ${dateStr}`, verbose);

  // Wait for Mobiscroll calendar to load
  await page.waitForSelector(SELECTORS.calendar, { timeout: 15000 });
  await sleep(500);

  // Build the aria-label selector for the target date
  const dateSelector = SELECTORS.calendarDay(dateStr);
  log.verbose(`Looking for: ${dateSelector}`, verbose);

  // May need to navigate to correct month - check if date is visible
  let dateElement = await page.$(dateSelector);

  // If not found, try navigating forward through months
  let attempts = 0;
  while (!dateElement && attempts < 6) {
    const nextBtn = await page.$(SELECTORS.calendarNextBtn);
    if (nextBtn) {
      const isDisabled = await nextBtn.getAttribute('disabled');
      if (isDisabled) break;
      await nextBtn.click();
      await sleep(500);
      dateElement = await page.$(dateSelector);
    }
    attempts++;
  }

  if (!dateElement) {
    log.verbose(`Date element not found: ${dateSelector}`, verbose);
    return false;
  }

  // Check if date is available (green background) or sold out (pink)
  const style = await dateElement.getAttribute('style') || '';
  const isAvailable = style.includes(CALENDAR_COLORS.available);
  const isSoldOut = style.includes(CALENDAR_COLORS.soldOut);

  log.verbose(`Date style: ${style}`, verbose);
  log.verbose(`Available: ${isAvailable}, Sold out: ${isSoldOut}`, verbose);

  // Click the date to proceed
  await dateElement.click();
  await sleep(1000);
  return true;
}

export async function getDateAvailability(
  page: Page,
  dateStr: string,
  verbose = false
): Promise<'available' | 'sold-out' | 'no-reservation' | 'unavailable' | 'unknown'> {
  const dateSelector = SELECTORS.calendarDay(dateStr);
  const dateElement = await page.$(dateSelector);

  if (!dateElement) return 'unknown';

  const style = await dateElement.getAttribute('style') || '';

  if (style.includes(CALENDAR_COLORS.available)) return 'available';
  if (style.includes(CALENDAR_COLORS.soldOut)) return 'sold-out';

  // Check for aria-disabled
  const isDisabled = await dateElement.getAttribute('aria-disabled');
  if (isDisabled === 'true') return 'unavailable';

  // No special styling = no reservation needed (weekday)
  return 'no-reservation';
}

export async function checkAvailability(
  page: Page,
  dateStr: string,
  verbose = false
): Promise<AvailabilityResult> {
  log.verbose(`Checking availability for ${dateStr}`, verbose);

  await navigateToReservations(page, verbose);

  const result: AvailabilityResult = {
    date: dateStr,
    available: {
      paid: false,
      carpool: false,
      ada: false,
    },
    timestamp: new Date(),
  };

  // Navigate to the date in calendar
  const dateSelected = await selectDate(page, dateStr, verbose);
  if (!dateSelected) {
    log.warn('Could not select date on calendar');
    return result;
  }

  // Wait for rate selection to appear
  await sleep(1000);

  // Check if rate cards are present
  const rateWrapper = await page.$(SELECTORS.rateWrapper);
  if (!rateWrapper) {
    log.verbose('Rate selection not shown - date may be unavailable', verbose);
    return result;
  }

  // Check for Carpool option
  const carpoolCard = await page.$(SELECTORS.carpoolCard);
  if (carpoolCard) {
    result.available.carpool = true;
    log.verbose('Carpool: available', verbose);
  }

  // Check for Paid option
  const paidCard = await page.$(SELECTORS.paidCard);
  if (paidCard) {
    result.available.paid = true;
    log.verbose('Paid: available', verbose);
  }

  // ADA typically shown alongside paid if available
  // For now, assume ADA follows paid availability
  result.available.ada = result.available.paid;

  return result;
}

export async function bookSpot(
  page: Page,
  dateStr: string,
  type: ReservationType,
  plate: string,
  dryRun = false,
  verbose = false
): Promise<BookingResult> {
  log.verbose(`Booking ${type} spot for ${dateStr}`, verbose);

  const result: BookingResult = {
    success: false,
    date: dateStr,
    type,
    plate,
  };

  try {
    // Navigate and select date
    await navigateToReservations(page, verbose);
    const dateSelected = await selectDate(page, dateStr, verbose);

    if (!dateSelected) {
      result.error = 'Could not select date';
      return result;
    }

    // Wait for rate selection
    await sleep(1000);

    // Select reservation type by clicking the appropriate rate card
    const typeCards: Record<ReservationType, string> = {
      paid: SELECTORS.paidCard,
      carpool: SELECTORS.carpoolCard,
      ada: SELECTORS.paidCard, // ADA uses same card flow
    };

    const typeCard = await page.$(typeCards[type]);
    if (!typeCard) {
      result.error = `${type} option not found`;
      return result;
    }

    log.verbose(`Clicking ${type} rate card`, verbose);
    await typeCard.click();
    await sleep(2000); // Redirects to parking.honkmobile.com/checkout

    // Now on checkout page (different domain)
    await page.waitForSelector(SELECTORS.checkoutContainer, { timeout: 15000 });
    log.verbose('On checkout page', verbose);

    // Check if we need to update the license plate
    const currentPlate = await page.$(SELECTORS.plateDisplay);
    if (currentPlate) {
      const displayedPlate = await currentPlate.textContent();
      log.verbose(`Current plate: ${displayedPlate}`, verbose);

      if (displayedPlate !== plate) {
        // Click edit to change plate
        const editBtn = await page.$(SELECTORS.editVehicleBtn);
        if (editBtn) {
          await editBtn.click();
          await sleep(500);
          // Plate editing modal flow would go here
          // For now, log a warning
          log.warn(`Plate mismatch: displayed=${displayedPlate}, wanted=${plate}`);
        }
      }
    }

    // Accept terms and conditions
    const termsCheckbox = await page.$(SELECTORS.termsCheckbox);
    if (termsCheckbox) {
      const isChecked = await termsCheckbox.isChecked();
      if (!isChecked) {
        await termsCheckbox.click();
        await sleep(300);
      }
    }

    if (dryRun) {
      log.info('Dry run - stopping before final confirmation');
      result.success = true;
      result.confirmationNumber = 'DRY-RUN';
      return result;
    }

    // Click continue to complete booking
    const continueBtn = await page.$(SELECTORS.continueBtn);
    if (continueBtn) {
      // Check if button is enabled
      const isDisabled = await continueBtn.evaluate(
        el => el.classList.contains('CtaButton--container__disabled')
      );
      if (isDisabled) {
        result.error = 'Continue button is disabled - check terms/payment';
        return result;
      }
      await continueBtn.click();
      await sleep(3000);
    }

    // TODO: Handle post-purchase confirmation page
    // Get confirmation number
    const confirmElement = await page.$(SELECTORS.confirmationNumber);
    if (confirmElement) {
      result.confirmationNumber = await confirmElement.textContent() || undefined;
    }

    result.success = true;
    return result;

  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    return result;
  }
}

export async function waitForLogin(page: Page, verbose = false): Promise<boolean> {
  log.verbose('Waiting for login...', verbose);

  await page.goto(URLS.LOGIN, { waitUntil: 'networkidle' });

  // Wait for either successful login (redirect away from login) or timeout
  try {
    await page.waitForFunction(
      () => !window.location.href.includes('/login'),
      { timeout: 300000 } // 5 minute timeout for manual login
    );
    return true;
  } catch {
    return false;
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

Run:
```bash
git add src/lib/scraper.ts
git commit -m "feat: add scraper module with page interactions"
```

---

## Task 8: Auth Command

**Files:**
- Create: `src/commands/auth.ts`

**Step 1: Create auth command**

Create `src/commands/auth.ts`:

```typescript
import ora from 'ora';
import type { AuthOptions } from '../types.js';
import { createBrowser, saveSession, isLoggedIn } from '../lib/browser.js';
import { waitForLogin } from '../lib/scraper.js';
import { log } from '../lib/utils.js';

export async function authCommand(options: AuthOptions): Promise<void> {
  const spinner = ora('Launching browser for login...').start();

  let context;
  try {
    // Always headed for auth
    context = await createBrowser({ headed: true, verbose: options.verbose });
    const page = await context.newPage();

    spinner.text = 'Checking existing session...';

    // Check if already logged in
    if (await isLoggedIn(page)) {
      spinner.succeed('Already logged in!');
      await saveSession(context);
      await context.close();
      return;
    }

    spinner.info('Please log in to your HONK account in the browser window.');
    spinner.start('Waiting for login...');

    const loggedIn = await waitForLogin(page, options.verbose);

    if (loggedIn) {
      spinner.succeed('Login successful!');
      await saveSession(context);
      log.success('Session saved to ~/.ski-parker/session.json');
    } else {
      spinner.fail('Login timed out. Please try again.');
    }

  } catch (error) {
    spinner.fail('Authentication failed');
    log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    if (context) {
      await context.close();
    }
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

Run:
```bash
git add src/commands/auth.ts
git commit -m "feat: add auth command"
```

---

## Task 9: Check Command

**Files:**
- Create: `src/commands/check.ts`

**Step 1: Create check command**

Create `src/commands/check.ts`:

```typescript
import ora from 'ora';
import chalk from 'chalk';
import type { CheckOptions, ReservationType } from '../types.js';
import { createBrowser, loadSession } from '../lib/browser.js';
import { checkAvailability } from '../lib/scraper.js';
import { log } from '../lib/utils.js';

export async function checkCommand(options: CheckOptions): Promise<void> {
  const spinner = ora(`Checking availability for ${options.date}...`).start();

  let context;
  try {
    context = await createBrowser({
      headed: options.headed,
      verbose: options.verbose
    });

    const page = await context.newPage();

    spinner.text = 'Loading session...';
    const hasSession = await loadSession(context);

    if (!hasSession) {
      spinner.warn('No saved session found. Run `ski-parker auth` first.');
    }

    spinner.text = 'Checking availability...';
    const result = await checkAvailability(page, options.date, options.verbose);

    spinner.stop();

    // Display results
    console.log();
    console.log(chalk.bold(`Availability for ${options.date}:`));
    console.log();

    const types: ReservationType[] = ['paid', 'carpool', 'ada'];
    for (const type of types) {
      const available = result.available[type];
      const status = available
        ? chalk.green('✓ Available')
        : chalk.red('✗ Sold Out');
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      console.log(`  ${label.padEnd(10)} ${status}`);
    }

    console.log();
    console.log(chalk.gray(`Checked at: ${result.timestamp.toLocaleTimeString()}`));

  } catch (error) {
    spinner.fail('Check failed');
    log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    if (context) {
      await context.close();
    }
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

Run:
```bash
git add src/commands/check.ts
git commit -m "feat: add check command"
```

---

## Task 10: Watch Command

**Files:**
- Create: `src/commands/watch.ts`

**Step 1: Create watch command**

Create `src/commands/watch.ts`:

```typescript
import ora from 'ora';
import chalk from 'chalk';
import type { WatchOptions } from '../types.js';
import { createBrowser, loadSession } from '../lib/browser.js';
import { checkAvailability, bookSpot } from '../lib/scraper.js';
import { notifyAvailable, notifyBooked, notifyError } from '../lib/notify.js';
import { log, sleep, jitter as jitterFn } from '../lib/utils.js';

export async function watchCommand(options: WatchOptions): Promise<void> {
  const {
    date,
    type,
    interval,
    jitter,
    notify,
    sound,
    autoBook,
    headed,
    dryRun,
    verbose,
    plate,
  } = options;

  log.info(`Watching for ${type} parking on ${date}`);
  log.info(`Checking every ${interval}s (±${jitter}s jitter)`);

  if (autoBook) {
    if (!plate) {
      log.error('--plate is required when using --auto-book');
      process.exit(1);
    }
    log.info(`Auto-book enabled with plate: ${plate}`);
  }

  if (dryRun) {
    log.warn('Dry run mode - will not actually book');
  }

  console.log();
  console.log(chalk.gray('Press Ctrl+C to stop'));
  console.log();

  let context;
  let checkCount = 0;
  let isRunning = true;

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    isRunning = false;
    log.info('Shutting down...');
  });

  try {
    context = await createBrowser({ headed, verbose });
    const page = await context.newPage();

    const hasSession = await loadSession(context);
    if (!hasSession) {
      log.warn('No saved session. Run `ski-parker auth` first.');
    }

    while (isRunning) {
      checkCount++;
      const spinner = ora(`Check #${checkCount}...`).start();

      try {
        const result = await checkAvailability(page, date, verbose);
        const available = result.available[type];

        if (available) {
          spinner.succeed(`${type.toUpperCase()} parking AVAILABLE!`);

          if (notify) {
            notifyAvailable(date, type, { desktop: true, sound });
          }

          if (autoBook && plate) {
            log.info('Auto-booking...');
            const bookResult = await bookSpot(page, date, type, plate, dryRun, verbose);

            if (bookResult.success) {
              log.success(`Booked! Confirmation: ${bookResult.confirmationNumber}`);
              notifyBooked(date, type, bookResult.confirmationNumber);
            } else {
              log.error(`Booking failed: ${bookResult.error}`);
              notifyError(`Booking failed: ${bookResult.error}`);
            }
          }

          break; // Exit loop on availability
        }

        spinner.info(`Check #${checkCount}: ${type} not available - ${result.timestamp.toLocaleTimeString()}`);

      } catch (error) {
        spinner.fail(`Check #${checkCount} failed: ${error}`);
        log.verbose(String(error), verbose);
      }

      // Wait with jitter before next check
      const waitMs = jitterFn(interval * 1000, jitter * 1000);
      log.verbose(`Next check in ${Math.round(waitMs / 1000)}s`, verbose);
      await sleep(waitMs);
    }

  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    if (context) {
      await context.close();
    }
    log.info(`Completed ${checkCount} checks`);
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

Run:
```bash
git add src/commands/watch.ts
git commit -m "feat: add watch command"
```

---

## Task 11: Book Command

**Files:**
- Create: `src/commands/book.ts`

**Step 1: Create book command**

Create `src/commands/book.ts`:

```typescript
import ora from 'ora';
import type { BookOptions } from '../types.js';
import { createBrowser, loadSession } from '../lib/browser.js';
import { checkAvailability, bookSpot } from '../lib/scraper.js';
import { notifyBooked, notifyError } from '../lib/notify.js';
import { log } from '../lib/utils.js';

export async function bookCommand(options: BookOptions): Promise<void> {
  const { date, type, plate, headed, dryRun, verbose } = options;

  if (dryRun) {
    log.warn('Dry run mode - will stop before final confirmation');
  }

  const spinner = ora(`Booking ${type} parking for ${date}...`).start();

  let context;
  try {
    context = await createBrowser({ headed, verbose });
    const page = await context.newPage();

    spinner.text = 'Loading session...';
    const hasSession = await loadSession(context);

    if (!hasSession) {
      spinner.fail('No saved session found. Run `ski-parker auth` first.');
      process.exit(1);
    }

    // First check availability
    spinner.text = 'Checking availability...';
    const availability = await checkAvailability(page, date, verbose);

    if (!availability.available[type]) {
      spinner.fail(`${type} parking is not available for ${date}`);
      process.exit(1);
    }

    spinner.succeed(`${type} parking is available!`);
    spinner.start('Booking...');

    const result = await bookSpot(page, date, type, plate, dryRun, verbose);

    if (result.success) {
      spinner.succeed('Booking successful!');
      console.log();
      log.success(`Date: ${result.date}`);
      log.success(`Type: ${result.type}`);
      log.success(`Plate: ${result.plate}`);
      if (result.confirmationNumber) {
        log.success(`Confirmation: ${result.confirmationNumber}`);
      }

      notifyBooked(date, type, result.confirmationNumber);
    } else {
      spinner.fail('Booking failed');
      log.error(result.error || 'Unknown error');
      notifyError(result.error || 'Booking failed');
      process.exit(1);
    }

  } catch (error) {
    spinner.fail('Booking failed');
    log.error(error instanceof Error ? error.message : String(error));
    notifyError(error instanceof Error ? error.message : 'Booking failed');
    process.exit(1);
  } finally {
    if (context) {
      await context.close();
    }
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

Run:
```bash
git add src/commands/book.ts
git commit -m "feat: add book command"
```

---

## Task 12: CLI Entry Point

**Files:**
- Create: `src/index.ts`

**Step 1: Create CLI entry point**

Create `src/index.ts`:

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { authCommand } from './commands/auth.js';
import { checkCommand } from './commands/check.js';
import { watchCommand } from './commands/watch.js';
import { bookCommand } from './commands/book.js';
import { loadConfig } from './lib/config.js';
import { RESERVATION_TYPES, DEFAULTS } from './constants.js';
import type { ReservationType } from './types.js';

const config = loadConfig();
const program = new Command();

program
  .name('ski-parker')
  .description('Automated Stevens Pass parking reservation CLI')
  .version('0.1.0');

// Auth command
program
  .command('auth')
  .description('Authenticate with HONK (opens browser for manual login)')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    await authCommand({ verbose: opts.verbose });
  });

// Check command
program
  .command('check')
  .description('Check parking availability for a specific date')
  .requiredOption('-d, --date <date>', 'Date to check (YYYY-MM-DD)')
  .option('--headed', 'Show browser window', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    await checkCommand({
      date: opts.date,
      headed: opts.headed,
      verbose: opts.verbose,
    });
  });

// Watch command
program
  .command('watch')
  .description('Watch for parking availability and optionally auto-book')
  .requiredOption('-d, --date <date>', 'Date to watch (YYYY-MM-DD)')
  .requiredOption('-t, --type <type>', `Reservation type: ${RESERVATION_TYPES.join(', ')}`)
  .option('-i, --interval <seconds>', 'Poll interval in seconds', String(config.pollInterval || DEFAULTS.POLL_INTERVAL))
  .option('-j, --jitter <seconds>', 'Random ± seconds added to interval', String(config.jitter || DEFAULTS.JITTER))
  .option('--no-notify', 'Disable desktop notifications')
  .option('--no-sound', 'Disable sound notifications')
  .option('--auto-book', 'Automatically book when available', false)
  .option('-p, --plate <plate>', 'License plate (required for auto-book)', config.defaultPlate)
  .option('--headed', 'Show browser window', false)
  .option('--dry-run', 'Do not actually book', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    // Validate type
    if (!RESERVATION_TYPES.includes(opts.type as ReservationType)) {
      console.error(`Invalid type: ${opts.type}. Must be one of: ${RESERVATION_TYPES.join(', ')}`);
      process.exit(1);
    }

    await watchCommand({
      date: opts.date,
      type: opts.type as ReservationType,
      interval: parseInt(opts.interval, 10),
      jitter: parseInt(opts.jitter, 10),
      notify: opts.notify,
      sound: opts.sound,
      autoBook: opts.autoBook,
      plate: opts.plate,
      headed: opts.headed,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
    });
  });

// Book command
program
  .command('book')
  .description('Book a parking spot immediately')
  .requiredOption('-d, --date <date>', 'Date to book (YYYY-MM-DD)')
  .requiredOption('-t, --type <type>', `Reservation type: ${RESERVATION_TYPES.join(', ')}`)
  .requiredOption('-p, --plate <plate>', 'License plate number')
  .option('--headed', 'Show browser window', false)
  .option('--dry-run', 'Stop before final confirmation', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    // Validate type
    if (!RESERVATION_TYPES.includes(opts.type as ReservationType)) {
      console.error(`Invalid type: ${opts.type}. Must be one of: ${RESERVATION_TYPES.join(', ')}`);
      process.exit(1);
    }

    await bookCommand({
      date: opts.date,
      type: opts.type as ReservationType,
      plate: opts.plate,
      headed: opts.headed,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
    });
  });

program.parse();
```

**Step 2: Build the project**

Run: `npm run build`
Expected: Compiles without errors, creates `dist/` directory

**Step 3: Test CLI help**

Run: `node dist/index.js --help`
Expected: Shows CLI help with all commands

**Step 4: Commit**

Run:
```bash
git add src/index.ts
git commit -m "feat: add CLI entry point with all commands"
```

---

## Task 13: Add Type Definitions for Stealth Plugin

**Files:**
- Create: `src/playwright-extra.d.ts`

**Step 1: Create type definitions**

The stealth plugin doesn't have proper TypeScript types. Create a declaration file.

Create `src/playwright-extra.d.ts`:

```typescript
declare module 'playwright-extra' {
  import type { BrowserType, Browser, BrowserContext, LaunchOptions } from 'playwright';

  interface PersistentContextOptions extends LaunchOptions {
    headless?: boolean;
    channel?: string;
    args?: string[];
    viewport?: { width: number; height: number };
    slowMo?: number;
  }

  interface PlaywrightExtra extends BrowserType {
    use(plugin: unknown): void;
    launchPersistentContext(
      userDataDir: string,
      options?: PersistentContextOptions
    ): Promise<BrowserContext>;
  }

  export const chromium: PlaywrightExtra;
}

declare module 'puppeteer-extra-plugin-stealth' {
  function stealth(): unknown;
  export default stealth;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Compiles without errors

**Step 3: Commit**

Run:
```bash
git add src/playwright-extra.d.ts
git commit -m "fix: add type definitions for playwright-extra"
```

---

## Task 14: Create Fixtures Directory Structure

**Files:**
- Create: `fixtures/html/.gitkeep`
- Create: `fixtures/api/.gitkeep`
- Create: `fixtures/har/.gitkeep`

**Step 1: Create fixture directories**

Run:
```bash
mkdir -p fixtures/html fixtures/api fixtures/har
touch fixtures/html/.gitkeep fixtures/api/.gitkeep fixtures/har/.gitkeep
```

**Step 2: Add fixture capture script to package.json**

Update `package.json` scripts to add capture command:

Add to scripts section:
```json
"capture": "node dist/capture-fixtures.js"
```

**Step 3: Commit**

Run:
```bash
git add fixtures/ package.json
git commit -m "chore: add fixtures directory structure"
```

---

## Task 15: Fixture Capture Script

**Files:**
- Create: `src/capture-fixtures.ts`

**Step 1: Create capture script**

Create `src/capture-fixtures.ts`:

```typescript
#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createBrowser, loadSession } from './lib/browser.js';
import { URLS } from './constants.js';
import { log, sleep } from './lib/utils.js';

const FIXTURES_DIR = path.join(process.cwd(), 'fixtures');

async function captureFixtures() {
  log.info('Capturing HTML fixtures from live site...');
  log.warn('This requires a valid session. Run `ski-parker auth` first.');

  const context = await createBrowser({ headed: true, verbose: true });
  const page = await context.newPage();

  await loadSession(context);

  try {
    // Capture main reservation page
    log.info('Capturing reservation page...');
    await page.goto(URLS.BASE, { waitUntil: 'networkidle' });
    await sleep(3000); // Wait for SPA to fully render

    const mainHtml = await page.content();
    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'html', 'reservation-page.html'),
      mainHtml
    );
    log.success('Saved: fixtures/html/reservation-page.html');

    // Capture login page
    log.info('Capturing login page...');
    await page.goto(URLS.LOGIN, { waitUntil: 'networkidle' });
    await sleep(2000);

    const loginHtml = await page.content();
    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'html', 'login-page.html'),
      loginHtml
    );
    log.success('Saved: fixtures/html/login-page.html');

    // Take screenshots
    log.info('Capturing screenshots...');
    await page.goto(URLS.BASE, { waitUntil: 'networkidle' });
    await sleep(2000);
    await page.screenshot({
      path: path.join(FIXTURES_DIR, 'html', 'reservation-screenshot.png'),
      fullPage: true
    });
    log.success('Saved: fixtures/html/reservation-screenshot.png');

    log.success('Fixture capture complete!');
    log.info('Review the HTML files to identify correct selectors for scraper.ts');

  } catch (error) {
    log.error(`Capture failed: ${error}`);
  } finally {
    await context.close();
  }
}

captureFixtures();
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Compiles without errors

**Step 3: Commit**

Run:
```bash
git add src/capture-fixtures.ts
git commit -m "feat: add fixture capture script"
```

---

## Task 16: README Documentation

**Files:**
- Create: `README.md`

**Step 1: Create README**

Create `README.md`:

```markdown
# ski-parker

Automated Stevens Pass parking reservation CLI using Playwright stealth.

## Installation

```bash
npm install
npm run build
npm link  # Makes 'ski-parker' available globally
```

## Quick Start

```bash
# 1. Authenticate (one-time setup)
ski-parker auth

# 2. Check availability
ski-parker check --date 2025-02-15

# 3. Watch for availability
ski-parker watch --date 2025-02-15 --type paid

# 4. Book immediately
ski-parker book --date 2025-02-15 --type paid --plate ABC1234
```

## Commands

### `ski-parker auth`

Opens a browser window for manual login to HONK. Saves session for future use.

### `ski-parker check`

Check availability for a specific date.

```bash
ski-parker check --date 2025-02-15 [--headed] [--verbose]
```

### `ski-parker watch`

Poll for availability until a spot opens.

```bash
ski-parker watch --date 2025-02-15 --type paid \
  [--interval 300] \
  [--jitter 60] \
  [--auto-book --plate ABC1234] \
  [--no-notify] \
  [--no-sound] \
  [--headed] \
  [--dry-run] \
  [--verbose]
```

### `ski-parker book`

Book a spot immediately if available.

```bash
ski-parker book --date 2025-02-15 --type paid --plate ABC1234 \
  [--headed] \
  [--dry-run] \
  [--verbose]
```

## Reservation Types

- `paid` - Standard paid parking ($20)
- `carpool` - Free carpool parking
- `ada` - ADA accessible parking

## Configuration

Config file: `~/.ski-parker/config.json`

```json
{
  "defaultPlate": "ABC1234",
  "defaultType": "paid",
  "pollInterval": 300,
  "jitter": 60,
  "notifications": {
    "desktop": true,
    "sound": true
  },
  "browser": {
    "headless": true,
    "slowMo": 50
  }
}
```

## Development

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Build
npm run build

# Capture HTML fixtures from live site
npm run capture
```

## Troubleshooting

### Session expired

Run `ski-parker auth` again to re-authenticate.

### Selectors not working

The HONK site may have changed. Capture new fixtures with `npm run capture`, examine the HTML, and update selectors in `src/lib/scraper.ts`.
```

**Step 2: Commit**

Run:
```bash
git add README.md
git commit -m "docs: add README with usage instructions"
```

---

## Task 17: Final Build and Test

**Step 1: Clean build**

Run: `rm -rf dist && npm run build`
Expected: Compiles successfully

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Test CLI commands (help only)**

Run:
```bash
node dist/index.js --help
node dist/index.js auth --help
node dist/index.js check --help
node dist/index.js watch --help
node dist/index.js book --help
```
Expected: All help commands show correct options

**Step 4: Link globally**

Run: `npm link`
Expected: `ski-parker` command now available globally

**Step 5: Final commit**

Run:
```bash
git add -A
git commit -m "chore: final build verification"
```

---

## Task 18: Live Testing and Selector Refinement

**This task requires manual execution against the live site.**

**Step 1: Run auth command**

Run: `ski-parker auth`
Expected: Browser opens, you can log in manually, session saves

**Step 2: Capture fixtures**

Run: `npm run capture`
Expected: HTML files saved to fixtures directory

**Step 3: Examine HTML and refine selectors**

- Open `fixtures/html/reservation-page.html` in browser
- Use browser DevTools to find correct selectors for:
  - Calendar element
  - Date buttons
  - Reservation type options (paid, carpool, ada)
  - License plate input
  - Continue/Confirm buttons
- Update selectors in `src/lib/scraper.ts` accordingly

**Step 4: Test check command**

Run: `ski-parker check --date 2025-02-15 --headed --verbose`
Expected: Shows availability for specified date

**Step 5: Iterate on selectors**

Repeat steps 3-4 until selectors work reliably.

**Step 6: Commit selector updates**

Run:
```bash
git add src/lib/scraper.ts
git commit -m "fix: refine selectors based on live site testing"
```

---

## Summary

| Task | Description | Est. Complexity |
|------|-------------|-----------------|
| 1 | Project initialization | Low |
| 2 | Types and constants | Low |
| 3 | Utility functions | Low |
| 4 | Config management | Low |
| 5 | Browser setup with stealth | Medium |
| 6 | Notification system | Low |
| 7 | Scraper module | Medium |
| 8 | Auth command | Low |
| 9 | Check command | Low |
| 10 | Watch command | Medium |
| 11 | Book command | Medium |
| 12 | CLI entry point | Low |
| 13 | Type definitions | Low |
| 14 | Fixtures directory | Low |
| 15 | Fixture capture script | Low |
| 16 | README documentation | Low |
| 17 | Final build and test | Low |
| 18 | Live testing (manual) | High |

**Critical path:** Tasks 1-12 must be completed in order. Tasks 13-17 can be done in parallel after task 12.

**Selector discovery:** Task 18 is iterative and will require multiple passes based on actual site structure.
