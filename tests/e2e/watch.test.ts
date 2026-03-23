import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { startMockServer, stopMockServer, getMockUrl, setScenarioViaApi, futureDate } from './helpers';

const CLI = path.resolve('dist/index.js');

// Dynamic future dates to avoid "date in the past" errors
const AVAILABLE_DATE = futureDate(7);
const UNAVAILABLE_DATE = futureDate(10);

describe('watch command (E2E)', () => {
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
      },
    });
  });

  it('exits immediately when date is already available', async () => {
    const proc = spawn('node', [CLI, 'watch', '--date', AVAILABLE_DATE, '--interval', '3', '--jitter', '0', '--verbose'], {
      env: { ...process.env, SKI_PARKER_BASE_URL: getMockUrl() },
    });

    let stdout = '';
    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stdout += data.toString(); });

    const exitCode = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error(`watch did not exit in time. stdout: ${stdout}`));
      }, 30000);
      proc.on('close', (code) => {
        clearTimeout(timeout);
        resolve(code ?? 1);
      });
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('AVAILABLE');
  }, 60000);

  it('detects availability change during polling', async () => {
    // Start with date unavailable
    await setScenarioViaApi({
      dates: {},
    });

    const proc = spawn('node', [CLI, 'watch', '--date', UNAVAILABLE_DATE, '--interval', '3', '--jitter', '0', '--verbose'], {
      env: { ...process.env, SKI_PARKER_BASE_URL: getMockUrl() },
    });

    let stdout = '';
    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stdout += data.toString(); });

    // After 2s, make the date available
    await new Promise(r => setTimeout(r, 2000));
    await setScenarioViaApi({ dates: { [UNAVAILABLE_DATE]: 'available' } });

    // Wait for process to exit (it breaks out of the loop on availability)
    const exitCode = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error(`watch did not exit in time. stdout: ${stdout}`));
      }, 60000);
      proc.on('close', (code) => {
        clearTimeout(timeout);
        resolve(code ?? 1);
      });
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('AVAILABLE');
  }, 90000);

  it('works without session cookies (localStorage-only auth)', async () => {
    // This reproduces the reported bug: users got "no session cookies found"
    // after successful auth because HONK uses localStorage, not cookies.
    // The watch command should proceed without cookies.
    await setScenarioViaApi({
      dates: {
        [AVAILABLE_DATE]: 'available',
      },
    });

    const proc = spawn('node', [CLI, 'watch', '--date', AVAILABLE_DATE, '--interval', '3', '--jitter', '0', '--verbose'], {
      env: { ...process.env, SKI_PARKER_BASE_URL: getMockUrl() },
    });

    let stdout = '';
    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stdout += data.toString(); });

    const exitCode = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error(`watch did not exit in time. stdout: ${stdout}`));
      }, 30000);
      proc.on('close', (code) => {
        clearTimeout(timeout);
        resolve(code ?? 1);
      });
    });

    // Should NOT exit with error about "no session cookies found"
    expect(stdout).not.toContain('No session cookies found');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('AVAILABLE');
  }, 60000);
});
