import path from 'node:path';
import os from 'node:os';

export const DEFAULT_RESORT_URL = 'https://reservenski.parkstevenspass.com';

/** Crystal Mountain Resort parking (non-HONK platform). */
export const CRYSTAL_MOUNTAIN_URL = 'https://parking.crystalmountainresort.com';

export type Platform = 'honk' | 'crystal';

/**
 * Detect platform from resort URL. Used to choose scraper flow and URL paths.
 */
export function getPlatform(resortUrl?: string): Platform {
  const raw = process.env.SKI_PARKER_BASE_URL || resortUrl || DEFAULT_RESORT_URL;
  const url = raw.replace(/\/+$/, '');
  if (url.includes('crystalmountainresort.com')) return 'crystal';
  return 'honk';
}

export function getUrls(resortUrl?: string) {
  // Environment variable takes precedence (for testing)
  const raw = process.env.SKI_PARKER_BASE_URL || resortUrl || DEFAULT_RESORT_URL;
  const base = raw.replace(/\/+$/, ''); // strip trailing slashes
  const platform = getPlatform(resortUrl);

  if (platform === 'crystal') {
    return {
      BASE: base,
      LOGIN: `${base}/login`,
      PROMO: `${base}/login`, // Crystal uses login for account
      /** Crystal reservations are on the main page (no /select-parking). */
      RESERVATIONS: base,
    };
  }

  return {
    BASE: base,
    LOGIN: `${base}/login`,
    PROMO: `${base}/code`,
    RESERVATIONS: `${base}/select-parking`,
  };
}

// Static fallback for code without config access
export const URLS = getUrls();

export const PATHS = {
  CONFIG_DIR: path.join(os.homedir(), '.ski-parker'),
  CONFIG_FILE: path.join(os.homedir(), '.ski-parker', 'config.json'),
  SESSION_FILE: path.join(os.homedir(), '.ski-parker', 'session.json'),
  CHROME_PROFILE: path.join(os.homedir(), '.ski-parker', 'chrome-profile'),
} as const;

export const DEFAULTS = {
  POLL_INTERVAL: 60,
  JITTER: 20,
  SLOW_MO: 50,
  VIEWPORT_WIDTH: 1280,
  VIEWPORT_HEIGHT: 720,
} as const;

export const RESERVATION_TYPES = ['paid', 'carpool', 'free'] as const;
