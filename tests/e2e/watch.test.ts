import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { startMockServer, stopMockServer, getMockUrl, setScenarioViaApi } from './helpers';

const CLI = path.resolve('dist/index.js');

describe('watch command (E2E)', () => {
  beforeAll(async () => {
    await startMockServer();
  }, 20000);

  afterAll(() => {
    stopMockServer();
  });

  beforeEach(async () => {
    await setScenarioViaApi({});
  });

  it('exits immediately when date is already available', async () => {
    // 2026-02-14 is available in the default scenario
    const proc = spawn('node', [CLI, 'watch', '--date', '2026-02-14', '--type', 'carpool', '--interval', '3', '--jitter', '0', '--verbose'], {
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

  it('auto-books when availability is detected', async () => {
    // 2026-02-09 starts unavailable, then becomes available
    const proc = spawn('node', [CLI, 'watch', '--date', '2026-02-09', '--type', 'carpool', '--interval', '3', '--jitter', '0', '--auto-book', '--plate', 'CFH2637', '--verbose'], {
      env: { ...process.env, SKI_PARKER_BASE_URL: getMockUrl() },
    });

    let stdout = '';
    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stdout += data.toString(); });

    // After 2s, make the date available
    await new Promise(r => setTimeout(r, 2000));
    await setScenarioViaApi({ dates: { '2026-02-09': 'available' } });

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
    expect(stdout).toContain('Booked');
  }, 90000);

  it('detects availability change during polling', async () => {
    // 2026-02-09 is not in the default scenario (unavailable)
    const proc = spawn('node', [CLI, 'watch', '--date', '2026-02-09', '--type', 'carpool', '--interval', '3', '--jitter', '0', '--verbose'], {
      env: { ...process.env, SKI_PARKER_BASE_URL: getMockUrl() },
    });

    let stdout = '';
    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stdout += data.toString(); });

    // After 2s, make the date available
    await new Promise(r => setTimeout(r, 2000));
    await setScenarioViaApi({ dates: { '2026-02-09': 'available' } });

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
});
