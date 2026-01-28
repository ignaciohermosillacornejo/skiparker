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

export const RESERVATION_TYPES = ['paid', 'carpool'] as const;
