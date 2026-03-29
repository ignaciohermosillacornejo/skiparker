import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { startMockServer, stopMockServer, getMockUrl, setScenarioViaApi, futureDate } from './helpers';

const CLI = path.resolve('dist/index.js');
const AVAILABLE_DATE = futureDate(7);

describe('watch command - Crystal Mountain (E2E)', () => {
  beforeAll(async () => {
    await startMockServer();
  }, 20000);

  afterAll(() => {
    stopMockServer();
  });

  beforeEach(async () => {
    await setScenarioViaApi({
      platform: 'crystal',
      dates: {
        [AVAILABLE_DATE]: 'available',
      },
    });
  });

  it('detects availability on Crystal Mountain', async () => {
    const proc = spawn('node', [CLI, 'watch', '--date', AVAILABLE_DATE, '--interval', '3', '--jitter', '0', '--verbose'], {
      env: {
        ...process.env,
        SKI_PARKER_BASE_URL: getMockUrl(),
        SKI_PARKER_PLATFORM: 'crystal-mountain',
      },
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
});
