import { describe, it, expect, vi } from 'vitest';
import {
  sleep,
  jitter,
  formatDate,
  parseDate,
  isPastFreeTime,
  meetsOccupancyRequirement,
  log,
} from '../../src/lib/utils.js';

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

describe('parseDate', () => {
  it('parses valid YYYY-MM-DD format', () => {
    const date = parseDate('2030-06-15');
    expect(date.getFullYear()).toBe(2030);
    expect(date.getMonth()).toBe(5); // June is month 5 (0-indexed)
    expect(date.getDate()).toBe(15);
  });

  it('throws on invalid format (missing dashes)', () => {
    expect(() => parseDate('20260215')).toThrow('Invalid date format');
  });

  it('throws on invalid format (wrong separator)', () => {
    expect(() => parseDate('2026/02/15')).toThrow('Invalid date format');
  });

  it('throws on invalid format (US format)', () => {
    expect(() => parseDate('02-15-2026')).toThrow('Invalid date format');
  });

  it('throws on past date', () => {
    expect(() => parseDate('2020-01-01')).toThrow('in the past');
  });

  it('throws on invalid date values (month 13)', () => {
    // Note: JS Date is lenient with day overflow (Feb 30 -> Mar 2)
    // but month 13 creates NaN
    expect(() => parseDate('2026-13-01')).toThrow();
  });
});

describe('isPastFreeTime', () => {
  it('returns true when current time is past threshold', () => {
    const now = new Date('2026-02-15T11:00:00');
    expect(isPastFreeTime('10:00', now)).toBe(true);
  });

  it('returns false when current time is before threshold', () => {
    const now = new Date('2026-02-15T09:00:00');
    expect(isPastFreeTime('10:00', now)).toBe(false);
  });

  it('returns true when exactly at threshold', () => {
    const now = new Date('2026-02-15T10:00:00');
    expect(isPastFreeTime('10:00', now)).toBe(true);
  });

  it('handles different threshold times', () => {
    const now = new Date('2026-02-15T12:30:00');
    expect(isPastFreeTime('12:00', now)).toBe(true);
    expect(isPastFreeTime('13:00', now)).toBe(false);
  });

  it('handles times with minutes', () => {
    const now = new Date('2026-02-15T11:30:00');
    expect(isPastFreeTime('11:30', now)).toBe(true);
    expect(isPastFreeTime('11:31', now)).toBe(false);
  });

  it('throws on invalid time format', () => {
    expect(() => isPastFreeTime('invalid')).toThrow('Invalid time format');
    expect(() => isPastFreeTime('10')).toThrow('Invalid time format');
  });
});

describe('meetsOccupancyRequirement', () => {
  it('returns true when occupancy meets requirement', () => {
    expect(meetsOccupancyRequirement(4, 4)).toBe(true);
  });

  it('returns true when occupancy exceeds requirement', () => {
    expect(meetsOccupancyRequirement(5, 4)).toBe(true);
  });

  it('returns false when occupancy is below requirement', () => {
    expect(meetsOccupancyRequirement(3, 4)).toBe(false);
  });

  it('handles different thresholds', () => {
    expect(meetsOccupancyRequirement(3, 3)).toBe(true);
    expect(meetsOccupancyRequirement(2, 3)).toBe(false);
  });
});
