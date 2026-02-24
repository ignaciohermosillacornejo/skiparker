import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MOCK_PORT = 3847;
const MOCK_URL = `http://localhost:${MOCK_PORT}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_DIR = path.join(__dirname, '../mock-server');

let mockProcess: ChildProcess | null = null;

async function waitForPort(port: number, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok || res.status === 200) return;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`Port ${port} did not become available within ${timeoutMs}ms`);
}

export async function startMockServer(): Promise<void> {
  mockProcess = spawn('bun', ['run', 'dev'], {
    cwd: MOCK_DIR,
    stdio: 'pipe',
    env: { ...process.env },
  });

  mockProcess.on('error', (err) => {
    console.error('Mock server process error:', err);
  });

  await waitForPort(MOCK_PORT);
}

export function stopMockServer(): void {
  if (mockProcess) {
    mockProcess.kill();
    mockProcess = null;
  }
}

export function getMockUrl(): string {
  return MOCK_URL;
}

/**
 * Generate a future date string in YYYY-MM-DD format.
 * @param daysFromNow - Number of days in the future (default 7)
 */
export function futureDate(daysFromNow = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

export async function setScenarioViaApi(scenario: Record<string, unknown>): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await fetch(`${MOCK_URL}/api/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenario),
      });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error('Failed to set scenario after 5 attempts');
}
