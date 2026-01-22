import { describe, it, expect, vi } from 'vitest';
import { sleep, jitter, formatDate, log } from '../../src/lib/utils.js';

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
