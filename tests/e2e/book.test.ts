import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { startMockServer, stopMockServer, getMockUrl, setScenarioViaApi } from './helpers';

const CLI = `node ${path.resolve('dist/index.js')}`;

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
    await setScenarioViaApi({});
  });

  it('books successfully with confirm modal', async () => {
    // 2026-02-14 is available in default scenario, checkoutOutcome defaults to 'confirm'
    const { stdout, exitCode } = runCli('book --date 2026-02-14 --type carpool --plate CFH2637 --verbose');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Date: 2026-02-14');
    expect(stdout).toContain('Type: carpool');
  });

  it('reports overlap error', async () => {
    // 2026-02-14 is available in defaults, just override checkout outcome
    await setScenarioViaApi({ checkoutOutcome: 'overlap' });

    const { stdout, exitCode } = runCli('book --date 2026-02-14 --type carpool --plate CFH2637 --verbose');
    expect(exitCode).toBe(1);
    expect(stdout).toContain('overlap');
  });

  it('reports reservation limit error', async () => {
    await setScenarioViaApi({ checkoutOutcome: 'limit' });

    const { stdout, exitCode } = runCli('book --date 2026-02-14 --type carpool --plate CFH2637 --verbose');
    expect(exitCode).toBe(1);
    expect(stdout).toContain('reservation limit');
  });

  it('books paid parking successfully', async () => {
    const { stdout, exitCode } = runCli('book --date 2026-02-14 --type paid --plate CFH2637 --verbose');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Type: paid');
  });

  it('reports unavailable for a date not in scenario', async () => {
    const { stdout, exitCode } = runCli('book --date 2026-02-09 --type carpool --plate CFH2637 --verbose');
    expect(exitCode).toBe(1);
    expect(stdout).toContain('not available');
  });

  it('reports sold out date as not available', async () => {
    const { stdout, exitCode } = runCli('book --date 2026-02-07 --type carpool --plate CFH2637 --verbose');
    expect(exitCode).toBe(1);
    expect(stdout).toContain('not available');
  });

  it('reports no-reservation date as not available', async () => {
    // 2026-02-16 is no-reservation in default scenario
    const { stdout, exitCode } = runCli('book --date 2026-02-16 --type carpool --plate CFH2637 --verbose');
    expect(exitCode).toBe(1);
    expect(stdout).toContain('not available');
  });

  it('rejects invalid reservation type', () => {
    const { stdout, exitCode } = runCli('book --date 2026-02-14 --type express --plate CFH2637');
    expect(exitCode).toBe(1);
    expect(stdout).toContain('Invalid type');
  });

  it('dry run stops before confirmation', async () => {
    // 2026-02-14 is available in defaults
    const { stdout, exitCode } = runCli('book --date 2026-02-14 --type carpool --plate CFH2637 --dry-run --verbose');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Dry run');
    expect(stdout).toContain('DRY-RUN');
  });
});
