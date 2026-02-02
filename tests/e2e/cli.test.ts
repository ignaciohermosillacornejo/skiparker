import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

const CLI = `node ${path.resolve('dist/index.js')}`;

function runCli(args: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`${CLI} ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
      env: { ...process.env, SKI_PARKER_BASE_URL: 'http://localhost:9999' },
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (e: any) {
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 1,
    };
  }
}

describe('CLI entry point (index.ts)', () => {
  describe('--version', () => {
    it('outputs the version number', () => {
      const { stdout, exitCode } = runCli('--version');
      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/^\d+\.\d+\.\d+/m);
    });

    it('shows version 0.2.0', () => {
      const { stdout } = runCli('--version');
      expect(stdout).toContain('0.2.0');
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
      expect(stdout).toContain('check');
      expect(stdout).toContain('watch');
      expect(stdout).toContain('book');
      expect(stdout).toContain('bug');
    });

    it('shows command descriptions', () => {
      const { stdout } = runCli('--help');
      expect(stdout).toContain('Authenticate with HONK');
      expect(stdout).toContain('Check parking availability');
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
      const { stderr, exitCode } = runCli('unknown-command');
      expect(exitCode).toBe(1);
      expect(stderr).toContain("unknown command 'unknown-command'");
    });
  });

  describe('missing required options', () => {
    it('check requires --date', () => {
      const { stderr, exitCode } = runCli('check');
      expect(exitCode).toBe(1);
      expect(stderr).toContain("required option '-d, --date <date>'");
    });

    it('watch requires --date', () => {
      const { stderr, exitCode } = runCli('watch');
      expect(exitCode).toBe(1);
      expect(stderr).toContain("required option '-d, --date <date>'");
    });

    it('book requires --date', () => {
      const { stderr, exitCode } = runCli('book');
      expect(exitCode).toBe(1);
      expect(stderr).toContain("required option '-d, --date <date>'");
    });
  });

  describe('command-specific help', () => {
    it('check --help shows examples', () => {
      const { stdout } = runCli('check --help');
      expect(stdout).toContain('Examples:');
      expect(stdout).toContain('--date');
      expect(stdout).toContain('--lot');
    });

    it('watch --help shows config defaults info', () => {
      const { stdout } = runCli('watch --help');
      expect(stdout).toContain('Config defaults');
      expect(stdout).toContain('--auto-book');
      expect(stdout).toContain('--interval');
    });

    it('book --help shows examples', () => {
      const { stdout } = runCli('book --help');
      expect(stdout).toContain('Examples:');
      expect(stdout).toContain('--dry-run');
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
      const url = stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0];
      expect(url).toBeDefined();

      // URL uses + for spaces, decode and replace
      const decodedUrl = decodeURIComponent(url!).replace(/\+/g, ' ');
      expect(decodedUrl).toContain('ski-parker:');
      expect(decodedUrl).toContain('Node.js:');
      expect(decodedUrl).toContain('Platform:');
      expect(decodedUrl).toContain('Config exists:');
    });

    it('includes issue template sections', () => {
      const { stdout } = runCli('bug --no-open');
      const url = stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0];
      // URL uses + for spaces, decode and replace
      const decodedUrl = decodeURIComponent(url!).replace(/\+/g, ' ');

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
      const url = stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0];
      // URL uses + for spaces, decode and replace
      const decodedUrl = decodeURIComponent(url!).replace(/\+/g, ' ');

      // Should contain the current version
      expect(decodedUrl).toContain('ski-parker: 0.2.0');
    });

    it('includes Node.js version in system info', () => {
      const { stdout } = runCli('bug --no-open');
      const url = stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0];
      // URL uses + for spaces, decode and replace
      const decodedUrl = decodeURIComponent(url!).replace(/\+/g, ' ');

      // Should contain Node.js version (format: vX.Y.Z)
      expect(decodedUrl).toMatch(/Node\.js: v\d+\.\d+\.\d+/);
    });

    it('includes platform info', () => {
      const { stdout } = runCli('bug --no-open');
      const url = stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0];
      // URL uses + for spaces, decode and replace
      const decodedUrl = decodeURIComponent(url!).replace(/\+/g, ' ');

      // Should contain platform (darwin, linux, win32)
      expect(decodedUrl).toMatch(/Platform: (darwin|linux|win32)/);
    });
  });
});
