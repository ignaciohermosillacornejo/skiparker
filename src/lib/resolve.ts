import { parseDate } from './utils.js';
import { RESERVATION_TYPES } from '../constants.js';
import type { Config, ReservationType } from '../types.js';

export function resolveDate(dateStr: string): string {
  parseDate(dateStr); // throws on invalid format or past date
  return dateStr;
}

export function resolveType(flag: string | undefined, config: Config): ReservationType {
  const type = flag || config.defaultType;
  if (!type) {
    throw new Error('No type configured. Run `ski-parker setup` or pass --type.');
  }
  if (!RESERVATION_TYPES.includes(type as ReservationType)) {
    throw new Error(`Invalid type: ${type}. Must be one of: ${RESERVATION_TYPES.join(', ')}`);
  }
  return type as ReservationType;
}

export function resolvePlate(flag: string | undefined, config: Config): string {
  const plate = flag || config.defaultPlate;
  if (!plate) {
    throw new Error('No plate configured. Run `ski-parker setup` or pass --plate.');
  }
  return plate;
}
