#!/usr/bin/env node

import { Command } from 'commander';
import { authCommand } from './commands/auth.js';
import { checkCommand } from './commands/check.js';
import { watchCommand } from './commands/watch.js';
import { bookCommand } from './commands/book.js';
import { setupCommand } from './commands/setup.js';
import { loadConfig } from './lib/config.js';
import { resolveDate, resolveType, resolvePlate } from './lib/resolve.js';
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
  .requiredOption('-d, --date <date>', 'Date to check (YYYY-MM-DD)')
  .option('--headed', 'Show browser window', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    try {
      resolveDate(opts.date);
    } catch (e) { fail(e); }

    await checkCommand({
      date: opts.date,
      headed: opts.headed,
      verbose: opts.verbose,
      resortUrl: config.resortUrl,
      lotPreferences: config.lotPreferences,
    });
  });

// Watch command
program
  .command('watch')
  .description('Watch for parking availability and optionally auto-book')
  .requiredOption('-d, --date <date>', 'Date to watch (YYYY-MM-DD)')
  .option('-t, --type <type>', `Reservation type: ${RESERVATION_TYPES.join(', ')}`)
  .option('-i, --interval <seconds>', 'Poll interval in seconds', String(config.pollInterval || DEFAULTS.POLL_INTERVAL))
  .option('-j, --jitter <seconds>', 'Random ± seconds added to interval', String(config.jitter || DEFAULTS.JITTER))
  .option('--no-notify', 'Disable desktop notifications')
  .option('--no-sound', 'Disable sound notifications')
  .option('--auto-book', 'Automatically book when available', false)
  .option('-p, --plate <plate>', 'License plate (required for auto-book)', config.defaultPlate)
  .option('--headed', 'Show browser window', false)
  .option('--dry-run', 'Do not actually book', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    let type;
    try {
      resolveDate(opts.date);
      type = resolveType(opts.type, config);
    } catch (e) { fail(e); }

    await watchCommand({
      date: opts.date,
      type,
      interval: parseInt(opts.interval, 10),
      jitter: parseInt(opts.jitter, 10),
      notify: opts.notify,
      sound: opts.sound,
      autoBook: opts.autoBook,
      plate: opts.plate,
      headed: opts.headed,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
      resortUrl: config.resortUrl,
      lotPreferences: config.lotPreferences,
    });
  });

// Book command
program
  .command('book')
  .description('Book a parking spot immediately')
  .requiredOption('-d, --date <date>', 'Date to book (YYYY-MM-DD)')
  .option('-t, --type <type>', `Reservation type: ${RESERVATION_TYPES.join(', ')}`)
  .option('-p, --plate <plate>', 'License plate number')
  .option('--headed', 'Show browser window', false)
  .option('--dry-run', 'Stop before final confirmation', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    let type, plate;
    try {
      resolveDate(opts.date);
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
      resortUrl: config.resortUrl,
      lotPreferences: config.lotPreferences,
    });
  });

program.parse();
