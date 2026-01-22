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
