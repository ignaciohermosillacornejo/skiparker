import { parseDate } from './utils.js';
import type { Config } from '../types.js';

export function resolveDate(dateStr: string): string {
  parseDate(dateStr); // throws on invalid format or past date
  return dateStr;
}

export function resolveResortUrl(config: Config): string {
  // Environment variable takes precedence (for testing)
  const url = process.env.SKI_PARKER_BASE_URL || config.resortUrl;
  if (!url) {
    throw new Error('No resort URL configured. Run `ski-parker setup` first.');
  }
  return url;
}
