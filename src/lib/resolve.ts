import { parseDate } from './utils.js';
import { registry } from '../resorts/index.js';
import type { Config } from '../types.js';
import type { ResolvedResort } from '../resorts/types.js';

export function resolveDate(dateStr: string): string {
  parseDate(dateStr);
  return dateStr;
}

export function resolveResort(config: Config): ResolvedResort {
  const baseUrlOverride = process.env.SKI_PARKER_BASE_URL;

  if (baseUrlOverride) {
    const platformId = process.env.SKI_PARKER_PLATFORM || 'stevens-pass';
    const resort = registry.findById(platformId);
    return {
      descriptor: {
        ...resort.descriptor,
        urls: { ...resort.descriptor.urls, base: baseUrlOverride },
      },
      hooks: resort.hooks,
    };
  }

  const url = config.resortUrl;
  if (!url) {
    throw new Error('No resort URL configured. Run `ski-parker setup` first.');
  }
  return registry.findByUrl(url);
}
