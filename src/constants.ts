import path from 'node:path';
import os from 'node:os';

export const DEFAULT_RESORT_URL = 'https://reservenski.parkstevenspass.com';

export function getUrls(resortUrl?: string) {
  // Environment variable takes precedence (for testing)
  const raw = process.env.SKI_PARKER_BASE_URL || resortUrl || DEFAULT_RESORT_URL;
  const base = raw.replace(/\/+$/, ''); // strip trailing slashes
  return {
    BASE: base,
    LOGIN: `${base}/login`,
    PROMO: `${base}/code`,
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
