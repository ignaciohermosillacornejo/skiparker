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
