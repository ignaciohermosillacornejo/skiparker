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
      timeout: 60000,
    });
    return { stdout, exitCode: 0 };
  } catch (e: any) {
    return { stdout: (e.stdout ?? '') + (e.stderr ?? ''), exitCode: e.status ?? 1 };
  }
}

describe('book command (E2E)', () => {
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

  it('books successfully with confirm modal', async () => {
    const { stdout, exitCode } = runCli(`book --date ${AVAILABLE_DATE} --type carpool --plate CFH2637 --verbose`);
    expect(exitCode).toBe(0);
    expect(stdout).toContain(`Date: ${AVAILABLE_DATE}`);
    expect(stdout).toContain('Type: carpool');
  });

  it('reports overlap error', async () => {
    await setScenarioViaApi({
      dates: { [AVAILABLE_DATE]: 'available' },
      checkoutOutcome: 'overlap',
    });

    const { stdout, exitCode } = runCli(`book --date ${AVAILABLE_DATE} --type carpool --plate CFH2637 --verbose`);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('overlap');
  });

  it('reports reservation limit error', async () => {
    await setScenarioViaApi({
      dates: { [AVAILABLE_DATE]: 'available' },
      checkoutOutcome: 'limit',
    });

    const { stdout, exitCode } = runCli(`book --date ${AVAILABLE_DATE} --type carpool --plate CFH2637 --verbose`);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('reservation limit');
  });

  it('books paid parking successfully', async () => {
    const { stdout, exitCode } = runCli(`book --date ${AVAILABLE_DATE} --type paid --plate CFH2637 --verbose`);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Type: paid');
  });

  it('reports unavailable for a date not in scenario', async () => {
    const { stdout, exitCode } = runCli(`book --date ${UNAVAILABLE_DATE} --type carpool --plate CFH2637 --verbose`);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('not available');
  });

  it('reports sold out date as not available', async () => {
    const { stdout, exitCode } = runCli(`book --date ${SOLD_OUT_DATE} --type carpool --plate CFH2637 --verbose`);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('not available');
  });

  it('reports no-reservation date as not available', async () => {
    const { stdout, exitCode } = runCli(`book --date ${NO_RESERVATION_DATE} --type carpool --plate CFH2637 --verbose`);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('not available');
  });

  it('rejects invalid reservation type', () => {
    const { stdout, exitCode } = runCli(`book --date ${AVAILABLE_DATE} --type express --plate CFH2637`);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('Invalid type');
  });

  it('dry run stops before confirmation', async () => {
    const { stdout, exitCode } = runCli(`book --date ${AVAILABLE_DATE} --type carpool --plate CFH2637 --dry-run --verbose`);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Dry run');
    expect(stdout).toContain('DRY-RUN');
  });

  it('books successfully with multi-lot selection', async () => {
    await setScenarioViaApi({
      dates: { [AVAILABLE_DATE]: 'available' },
      lots: ['Lot A', 'Lot B'],
    });

    const { stdout, exitCode } = runCli(`book --date ${AVAILABLE_DATE} --type carpool --plate CFH2637 --lot "Lot A" --verbose`);
    expect(exitCode).toBe(0);
    expect(stdout).toContain(`Date: ${AVAILABLE_DATE}`);
    expect(stdout).toContain('Type: carpool');
  });
});
