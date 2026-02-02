#!/usr/bin/env node

import { Command } from 'commander';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import { authCommand } from './commands/auth.js';
import { checkCommand } from './commands/check.js';
import { watchCommand } from './commands/watch.js';
import { bookCommand } from './commands/book.js';
import { setupCommand } from './commands/setup.js';
import { loadConfig } from './lib/config.js';
import { resolveDate, resolveType, resolvePlate, resolveResortUrl } from './lib/resolve.js';
import { RESERVATION_TYPES, DEFAULTS, PATHS } from './constants.js';
import { log } from './lib/utils.js';

const VERSION = '0.3.0';
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
  .description('Automated HONK-based ski resort parking reservation CLI')
  .version(VERSION);

// Auth command
program
  .command('auth')
  .description('Authenticate with HONK (opens browser for manual login)')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    await authCommand({ verbose: opts.verbose, resortUrl: config.resortUrl });
  });

// Setup command
program
  .command('setup')
  .description('Configure default license plate and reservation type')
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

// Check command
program
  .command('check')
  .description('Check parking availability for a specific date')
  .addHelpText('after', `
Examples:
  $ ski-parker check --date 2026-02-15
  $ ski-parker check -d 2026-02-15 --lot "Zone A" "Zone B"
  $ ski-parker check -d 2026-02-15 --verbose`)
  .requiredOption('-d, --date <date>', 'Date to check (YYYY-MM-DD)')
  .option('-l, --lot <lots...>', 'Lot preference(s) for multi-lot resorts')
  .option('--headed', 'Show browser window', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    let resortUrl;
    try {
      resolveDate(opts.date);
      resortUrl = resolveResortUrl(config);
    } catch (e) { fail(e); }

    await checkCommand({
      date: opts.date,
      headed: opts.headed,
      verbose: opts.verbose,
      resortUrl,
      lotPreferences: opts.lot || config.lotPreferences,
    });
  });

// Watch command
program
  .command('watch')
  .description('Watch for parking availability and optionally auto-book')
  .addHelpText('after', `
Examples:
  $ ski-parker watch --date 2026-02-15 --type paid
  $ ski-parker watch -d 2026-02-15 -t carpool --auto-book
  $ ski-parker watch -d 2026-02-15 -t paid --interval 60 --auto-book --plate ABC1234

Config defaults (from ~/.ski-parker/config.json):
  --type defaults to config.defaultType
  --plate defaults to config.defaultPlate
  --interval defaults to config.pollInterval (${config.pollInterval || DEFAULTS.POLL_INTERVAL}s)
  --jitter defaults to config.jitter (${config.jitter || DEFAULTS.JITTER}s)`)
  .requiredOption('-d, --date <date>', 'Date to watch (YYYY-MM-DD)')
  .option('-t, --type <type>', `Reservation type: ${RESERVATION_TYPES.join(', ')} (default: config)`)
  .option('-l, --lot <lots...>', 'Lot preference(s) for multi-lot resorts')
  .option('-i, --interval <seconds>', 'Poll interval in seconds', String(config.pollInterval || DEFAULTS.POLL_INTERVAL))
  .option('-j, --jitter <seconds>', 'Random ± seconds added to interval', String(config.jitter || DEFAULTS.JITTER))
  .option('--no-notify', 'Disable desktop notifications')
  .option('--no-sound', 'Disable sound notifications')
  .option('--auto-book', 'Automatically book when available', false)
  .option('-p, --plate <plate>', 'License plate for booking (default: config)')
  .option('--headed', 'Show browser window', false)
  .option('--dry-run', 'Do not actually book', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    let type, plate, resortUrl;
    try {
      resolveDate(opts.date);
      resortUrl = resolveResortUrl(config);
      type = resolveType(opts.type, config);
      if (opts.autoBook) {
        plate = resolvePlate(opts.plate, config);
      }
    } catch (e) { fail(e); }

    await watchCommand({
      date: opts.date,
      type,
      interval: parseInt(opts.interval, 10),
      jitter: parseInt(opts.jitter, 10),
      notify: opts.notify,
      sound: opts.sound,
      autoBook: opts.autoBook,
      plate: plate || opts.plate,
      headed: opts.headed,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
      resortUrl,
      lotPreferences: opts.lot || config.lotPreferences,
    });
  });

// Book command
program
  .command('book')
  .description('Book a parking spot immediately')
  .addHelpText('after', `
Examples:
  $ ski-parker book --date 2026-02-15 --type paid --plate ABC1234
  $ ski-parker book -d 2026-02-15 -t carpool
  $ ski-parker book -d 2026-02-15 --dry-run

Config defaults (from ~/.ski-parker/config.json):
  --type defaults to config.defaultType
  --plate defaults to config.defaultPlate`)
  .requiredOption('-d, --date <date>', 'Date to book (YYYY-MM-DD)')
  .option('-t, --type <type>', `Reservation type: ${RESERVATION_TYPES.join(', ')} (default: config)`)
  .option('-l, --lot <lots...>', 'Lot preference(s) for multi-lot resorts')
  .option('-p, --plate <plate>', 'License plate number (default: config)')
  .option('--headed', 'Show browser window', false)
  .option('--dry-run', 'Stop before final confirmation', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    let type, plate, resortUrl;
    try {
      resolveDate(opts.date);
      resortUrl = resolveResortUrl(config);
      type = resolveType(opts.type, config);
      plate = resolvePlate(opts.plate, config);
    } catch (e) { fail(e); }

    await bookCommand({
      date: opts.date,
      type,
      plate,
      headed: opts.headed,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
      resortUrl,
      lotPreferences: opts.lot || config.lotPreferences,
    });
  });

program.parse();
