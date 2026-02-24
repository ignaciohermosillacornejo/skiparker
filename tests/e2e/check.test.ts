import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { startMockServer, stopMockServer, getMockUrl, setScenarioViaApi, futureDate } from './helpers';

const CLI = `node ${path.resolve('dist/index.js')}`;

// Dynamic future dates to avoid "date in the past" errors
const AVAILABLE_DATE = futureDate(7);
const SOLD_OUT_DATE = futureDate(8);
const NO_RESERVATION_DATE = futureDate(9);
const UNAVAILABLE_DATE = futureDate(10);

function runCli(args: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`${CLI} ${args}`, {
      env: { ...process.env, SKI_PARKER_BASE_URL: getMockUrl() },
      encoding: 'utf-8',
      timeout: 30000,
    });
    return { stdout, exitCode: 0 };
  } catch (e: any) {
    return { stdout: (e.stdout ?? '') + (e.stderr ?? ''), exitCode: e.status ?? 1 };
  }
}

describe('check command (E2E)', () => {
  beforeAll(async () => {
    await startMockServer();
  }, 20000);

  afterAll(() => {
    stopMockServer();
  });

  beforeEach(async () => {
    await setScenarioViaApi({
      dates: {
        [AVAILABLE_DATE]: 'available',
        [SOLD_OUT_DATE]: 'sold-out',
        [NO_RESERVATION_DATE]: 'no-reservation',
      },
    });
  });

  it('shows available types for an available date', async () => {
    const { stdout, exitCode } = runCli(`check --date ${AVAILABLE_DATE} --verbose`);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Available');
  });

  it('shows sold out for a sold-out date', async () => {
    const { stdout } = runCli(`check --date ${SOLD_OUT_DATE} --verbose`);
    expect(stdout).toContain('Sold out');
  });

  it('shows no reservation needed for a no-reservation date', async () => {
    const { stdout } = runCli(`check --date ${NO_RESERVATION_DATE} --verbose`);
    expect(stdout).toContain('No reservation needed');
  });

  it('shows unavailable for a date not in scenario', async () => {
    const { stdout } = runCli(`check --date ${UNAVAILABLE_DATE} --verbose`);
    expect(stdout).toContain('unavailable');
  });

  it('rejects a past date before launching browser', () => {
    const { stdout, exitCode } = runCli('check --date 2020-01-01');
    expect(exitCode).toBe(1);
    expect(stdout).toContain('in the past');
  });

  it('rejects invalid date format', () => {
    const { stdout, exitCode } = runCli('check --date 2026-0214');
    expect(exitCode).toBe(1);
    expect(stdout).toContain('Invalid date format');
  });

  it('shows available types for a multi-lot resort', async () => {
    await setScenarioViaApi({
      dates: { [AVAILABLE_DATE]: 'available' },
      lots: ['Lot A', 'Lot B'],
    });

    const { stdout, exitCode } = runCli(`check --date ${AVAILABLE_DATE} --lot "Lot A" --verbose`);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Available');
  });
});
