#!/usr/bin/env node

import { Command } from 'commander';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import { authCommand } from './commands/auth.js';
import { watchCommand } from './commands/watch.js';
import { setupCommand } from './commands/setup.js';
import { loadConfig } from './lib/config.js';
import { resolveDate, resolveResortUrl } from './lib/resolve.js';
import { DEFAULTS, PATHS } from './constants.js';
import { log } from './lib/utils.js';

const VERSION = '0.4.0';
const config = loadConfig();
const program = new Command();

function fail(error: unknown): never {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

// Show beta warning on startup
log.warn('Beta software - report issues with: ski-parker bug');

program
  .name('ski-parker')
  .description('Ski resort parking availability monitor')
  .version(VERSION);

// Auth command
program
  .command('auth')
  .description('Authenticate with resort parking site (opens browser for manual login)')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    await authCommand({ verbose: opts.verbose, resortUrl: config.resortUrl });
  });

// Setup command
program
  .command('setup')
  .description('Configure default settings')
  .action(async () => {
    await setupCommand();
  });

// Bug report command
program
  .command('bug')
  .description('Report a bug (opens GitHub issue in browser)')
  .option('--no-open', 'Print URL instead of opening browser')
  .action((opts) => {
    const systemInfo = {
      version: VERSION,
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      osRelease: os.release(),
      configExists: fs.existsSync(PATHS.CONFIG_FILE),
    };

    const body = `## Description
<!-- Describe what happened -->

## Expected behavior
<!-- What did you expect to happen? -->

## Steps to reproduce
1.
2.
3.

## System information
\`\`\`
ski-parker: ${systemInfo.version}
Node.js: ${systemInfo.nodeVersion}
Platform: ${systemInfo.platform} (${systemInfo.arch})
OS: ${systemInfo.osRelease}
Config exists: ${systemInfo.configExists}
\`\`\`

## Additional context
<!-- Any other relevant information -->
`;

    const url = new URL('https://github.com/ignaciohermosillacornejo/skiparker/issues/new');
    url.searchParams.set('labels', 'bug');
    url.searchParams.set('body', body);

    if (opts.open) {
      const openCmd = os.platform() === 'darwin' ? 'open' :
                      os.platform() === 'win32' ? 'start' : 'xdg-open';
      try {
        execSync(`${openCmd} "${url.toString()}"`);
        log.info('Opening GitHub issue page in browser...');
      } catch {
        console.log('\nCould not open browser. Please visit:\n');
        console.log(url.toString());
      }
    } else {
      console.log('\nOpen this URL to report a bug:\n');
      console.log(url.toString());
    }
  });

// Watch command
program
  .command('watch')
  .description('Watch for parking availability and notify when a spot opens')
  .addHelpText('after', `
Examples:
  $ ski-parker watch --date 2026-02-15
  $ ski-parker watch -d 2026-02-15 --interval 60
  $ ski-parker watch -d 2026-02-15 --headed --verbose

Config defaults (from ~/.ski-parker/config.json):
  --interval defaults to config.pollInterval (${config.pollInterval || DEFAULTS.POLL_INTERVAL}s)
  --jitter defaults to config.jitter (${config.jitter || DEFAULTS.JITTER}s)`)
  .requiredOption('-d, --date <date>', 'Date to watch (YYYY-MM-DD)')
  .option('-l, --lot <lots...>', 'Lot preference(s) for multi-lot resorts')
  .option('-i, --interval <seconds>', 'Poll interval in seconds', String(config.pollInterval || DEFAULTS.POLL_INTERVAL))
  .option('-j, --jitter <seconds>', 'Random ± seconds added to interval', String(config.jitter || DEFAULTS.JITTER))
  .option('--no-notify', 'Disable desktop notifications')
  .option('--no-sound', 'Disable sound notifications')
  .option('--headed', 'Show browser window', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    let resortUrl;
    try {
      resolveDate(opts.date);
      resortUrl = resolveResortUrl(config);
    } catch (e) { fail(e); }

    await watchCommand({
      date: opts.date,
      interval: parseInt(opts.interval, 10),
      jitter: parseInt(opts.jitter, 10),
      notify: opts.notify,
      sound: opts.sound,
      headed: opts.headed,
      verbose: opts.verbose,
      resortUrl,
      lotPreferences: opts.lot || config.lotPreferences,
    });
  });

program.parse();
