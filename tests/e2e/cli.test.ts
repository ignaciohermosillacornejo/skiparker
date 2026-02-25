import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const CLI = `node ${path.resolve('dist/index.js')}`;

// Read version from package.json for dynamic version testing
const packageJson = JSON.parse(readFileSync(path.resolve('package.json'), 'utf-8'));
const CURRENT_VERSION = packageJson.version;

/**
 * Runs the CLI with the given arguments and returns the combined output.
 * Uses a dummy base URL to prevent real server connections during testing.
 *
 * @param args - CLI arguments to pass
 * @returns Object with combined stdout/stderr and exit code
 */
function runCli(args: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`${CLI} ${args}`, {
      encoding: 'utf-8',
      timeout: 30000,
      // Use dummy URL to prevent real connections (these tests don't need mock server)
      env: { ...process.env, SKI_PARKER_BASE_URL: 'http://localhost:9999' },
    });
    return { stdout, exitCode: 0 };
  } catch (e: any) {
    // Combine stdout and stderr for easier assertions (matches existing e2e test pattern)
    return {
      stdout: (e.stdout ?? '') + (e.stderr ?? ''),
      exitCode: e.status ?? 1,
    };
  }
}

/**
 * Extracts and decodes the GitHub issue URL from CLI output.
 * Handles URL encoding where spaces are represented as '+'.
 *
 * @param stdout - CLI output containing the URL
 * @returns Decoded URL string with spaces restored
 */
function extractAndDecodeUrl(stdout: string): string {
  const url = stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0];
  expect(url).toBeDefined();
  return decodeURIComponent(url!).replace(/\+/g, ' ');
}

describe('CLI entry point (index.ts)', () => {
  describe('--version', () => {
    it('outputs a valid semver version number', () => {
      const { stdout, exitCode } = runCli('--version');
      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/^\d+\.\d+\.\d+/m);
    });

    it('shows version matching package.json', () => {
      const { stdout } = runCli('--version');
      expect(stdout).toContain(CURRENT_VERSION);
    });
  });

  describe('--help', () => {
    it('shows help text', () => {
      const { stdout, exitCode } = runCli('--help');
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('ski-parker');
    });

    it('lists all commands', () => {
      const { stdout } = runCli('--help');
      expect(stdout).toContain('auth');
      expect(stdout).toContain('setup');
      expect(stdout).toContain('watch');
      expect(stdout).toContain('bug');
    });

    it('shows command descriptions', () => {
      const { stdout } = runCli('--help');
      expect(stdout).toContain('Authenticate with HONK');
      expect(stdout).toContain('Report a bug');
    });
  });

  describe('beta warning', () => {
    it('shows beta warning on --help', () => {
      const { stdout } = runCli('--help');
      expect(stdout).toContain('Beta software');
      expect(stdout).toContain('ski-parker bug');
    });

    it('shows beta warning on --version', () => {
      const { stdout } = runCli('--version');
      expect(stdout).toContain('Beta software');
    });

    it('shows beta warning on commands', () => {
      const { stdout } = runCli('bug --no-open');
      expect(stdout).toContain('Beta software');
    });
  });

  describe('unknown command', () => {
    it('shows error for unknown command', () => {
      const { stdout, exitCode } = runCli('unknown-command');
      expect(exitCode).toBe(1);
      expect(stdout).toContain("unknown command 'unknown-command'");
    });
  });

  describe('missing required options', () => {
    it('watch requires --date', () => {
      const { stdout, exitCode } = runCli('watch');
      expect(exitCode).toBe(1);
      expect(stdout).toContain("required option '-d, --date <date>'");
    });
  });

  describe('command-specific help', () => {
    it('watch --help shows config defaults info', () => {
      const { stdout } = runCli('watch --help');
      expect(stdout).toContain('Config defaults');
      expect(stdout).toContain('--interval');
    });

    it('bug --help shows options', () => {
      const { stdout } = runCli('bug --help');
      expect(stdout).toContain('--no-open');
      expect(stdout).toContain('Report a bug');
    });
  });
});

describe('bug command', () => {
  describe('--no-open flag', () => {
    it('outputs a GitHub issue URL', () => {
      const { stdout, exitCode } = runCli('bug --no-open');
      expect(exitCode).toBe(0);
      expect(stdout).toContain('https://github.com/ignaciohermosillacornejo/skiparker/issues/new');
    });

    it('includes bug label in URL', () => {
      const { stdout } = runCli('bug --no-open');
      expect(stdout).toContain('labels=bug');
    });

    it('includes system information in URL body', () => {
      const { stdout } = runCli('bug --no-open');
      const decodedUrl = extractAndDecodeUrl(stdout);

      expect(decodedUrl).toContain('ski-parker:');
      expect(decodedUrl).toContain('Node.js:');
      expect(decodedUrl).toContain('Platform:');
      expect(decodedUrl).toContain('Config exists:');
    });

    it('includes issue template sections', () => {
      const { stdout } = runCli('bug --no-open');
      const decodedUrl = extractAndDecodeUrl(stdout);

      expect(decodedUrl).toContain('## Description');
      expect(decodedUrl).toContain('## Expected behavior');
      expect(decodedUrl).toContain('## Steps to reproduce');
      expect(decodedUrl).toContain('## System information');
      expect(decodedUrl).toContain('## Additional context');
    });

    it('shows instruction message', () => {
      const { stdout } = runCli('bug --no-open');
      expect(stdout).toContain('Open this URL to report a bug');
    });
  });

  describe('URL structure', () => {
    it('generates valid URL with query parameters', () => {
      const { stdout } = runCli('bug --no-open');
      const urlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+/);
      expect(urlMatch).not.toBeNull();

      const url = new URL(urlMatch![0]);
      expect(url.hostname).toBe('github.com');
      expect(url.pathname).toBe('/ignaciohermosillacornejo/skiparker/issues/new');
      expect(url.searchParams.get('labels')).toBe('bug');
      expect(url.searchParams.get('body')).toBeTruthy();
    });

    it('includes current version in system info', () => {
      const { stdout } = runCli('bug --no-open');
      const decodedUrl = extractAndDecodeUrl(stdout);

      expect(decodedUrl).toContain(`ski-parker: ${CURRENT_VERSION}`);
    });

    it('includes Node.js version in system info', () => {
      const { stdout } = runCli('bug --no-open');
      const decodedUrl = extractAndDecodeUrl(stdout);

      expect(decodedUrl).toMatch(/Node\.js: v\d+\.\d+\.\d+/);
    });

    it('includes platform info', () => {
      const { stdout } = runCli('bug --no-open');
      const decodedUrl = extractAndDecodeUrl(stdout);

      expect(decodedUrl).toMatch(/Platform: (darwin|linux|win32)/);
    });
  });
});
