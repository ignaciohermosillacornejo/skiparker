#!/usr/bin/env node

import { Command } from 'commander';
import { authCommand } from './commands/auth.js';
import { checkCommand } from './commands/check.js';
import { watchCommand } from './commands/watch.js';
import { bookCommand } from './commands/book.js';
import { setupCommand } from './commands/setup.js';
import { loadConfig } from './lib/config.js';
import { resolveDate, resolveType, resolvePlate, resolveResortUrl } from './lib/resolve.js';
import { RESERVATION_TYPES, DEFAULTS } from './constants.js';

const config = loadConfig();
const program = new Command();

function fail(error: unknown): never {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

program
  .name('ski-parker')
  .description('Automated HONK-based ski resort parking reservation CLI')
  .version('0.1.0');

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
