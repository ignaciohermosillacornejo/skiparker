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
    await setScenarioViaApi({});
  });

  it('shows available types for an available date', async () => {
    // 2026-02-14 is available in default scenario
    const { stdout, exitCode } = runCli('check --date 2026-02-14 --verbose');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Available');
  });

  it('shows sold out for a sold-out date', async () => {
    // 2026-02-07 is sold-out in default scenario
    const { stdout } = runCli('check --date 2026-02-07 --verbose');
    expect(stdout).toContain('Sold out');
  });

  it('shows no reservation needed for a no-reservation date', async () => {
    // 2026-02-16 is no-reservation in default scenario
    const { stdout } = runCli('check --date 2026-02-16 --verbose');
    expect(stdout).toContain('No reservation needed');
  });

  it('shows unavailable for a date not in scenario', async () => {
    // 2026-02-09 is not in the default scenario
    const { stdout } = runCli('check --date 2026-02-09 --verbose');
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
});
