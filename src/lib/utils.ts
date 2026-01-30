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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format: "${dateStr}". Use YYYY-MM-DD (e.g. 2026-02-14)`);
  }
  const date = new Date(dateStr + 'T12:00:00Z');
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: "${dateStr}". Use YYYY-MM-DD (e.g. 2026-02-14)`);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) {
    throw new Error(`Date "${dateStr}" is in the past.`);
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

/**
 * Check if the current time is past the free-after threshold.
 * Many resorts offer free parking after a certain time (e.g., 10AM).
 *
 * @param freeAfterTime - Time in HH:MM format (e.g., "10:00")
 * @param now - Current time (defaults to now, injectable for testing)
 * @returns true if current time is at or past the threshold
 */
export function isPastFreeTime(freeAfterTime: string, now = new Date()): boolean {
  const [hours, minutes] = freeAfterTime.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time format: "${freeAfterTime}". Use HH:MM (e.g., "10:00")`);
  }
  const threshold = new Date(now);
  threshold.setHours(hours, minutes, 0, 0);
  return now >= threshold;
}

/**
 * Validate that occupancy meets the minimum carpool requirement.
 *
 * @param occupancy - Number of occupants in vehicle
 * @param minRequired - Minimum required (typically 3 or 4)
 * @returns true if occupancy meets or exceeds requirement
 */
export function meetsOccupancyRequirement(occupancy: number, minRequired: number): boolean {
  return occupancy >= minRequired;
}
