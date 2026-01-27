#!/usr/bin/env node

import { Command } from 'commander';
import { authCommand } from './commands/auth.js';
import { checkCommand } from './commands/check.js';
import { watchCommand } from './commands/watch.js';
import { bookCommand } from './commands/book.js';
import { loadConfig } from './lib/config.js';
import { RESERVATION_TYPES, DEFAULTS } from './constants.js';
import type { ReservationType } from './types.js';

const config = loadConfig();
const program = new Command();

program
  .name('ski-parker')
  .description('Automated Stevens Pass parking reservation CLI')
  .version('0.1.0');

// Auth command
program
  .command('auth')
  .description('Authenticate with HONK (opens browser for manual login)')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    await authCommand({ verbose: opts.verbose });
  });

// Check command
program
  .command('check')
  .description('Check parking availability for a specific date')
  .requiredOption('-d, --date <date>', 'Date to check (YYYY-MM-DD)')
  .option('--headed', 'Show browser window', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    await checkCommand({
      date: opts.date,
      headed: opts.headed,
      verbose: opts.verbose,
    });
  });

// Watch command
program
  .command('watch')
  .description('Watch for parking availability and optionally auto-book')
  .requiredOption('-d, --date <date>', 'Date to watch (YYYY-MM-DD)')
  .requiredOption('-t, --type <type>', `Reservation type: ${RESERVATION_TYPES.join(', ')}`)
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
    // Validate type
    if (!RESERVATION_TYPES.includes(opts.type as ReservationType)) {
      console.error(`Invalid type: ${opts.type}. Must be one of: ${RESERVATION_TYPES.join(', ')}`);
      process.exit(1);
    }

    await watchCommand({
      date: opts.date,
      type: opts.type as ReservationType,
      interval: parseInt(opts.interval, 10),
      jitter: parseInt(opts.jitter, 10),
      notify: opts.notify,
      sound: opts.sound,
      autoBook: opts.autoBook,
      plate: opts.plate,
      headed: opts.headed,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
    });
  });

// Book command
program
  .command('book')
  .description('Book a parking spot immediately')
  .requiredOption('-d, --date <date>', 'Date to book (YYYY-MM-DD)')
  .requiredOption('-t, --type <type>', `Reservation type: ${RESERVATION_TYPES.join(', ')}`)
  .requiredOption('-p, --plate <plate>', 'License plate number')
  .option('--headed', 'Show browser window', false)
  .option('--dry-run', 'Stop before final confirmation', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    // Validate type
    if (!RESERVATION_TYPES.includes(opts.type as ReservationType)) {
      console.error(`Invalid type: ${opts.type}. Must be one of: ${RESERVATION_TYPES.join(', ')}`);
      process.exit(1);
    }

    await bookCommand({
      date: opts.date,
      type: opts.type as ReservationType,
      plate: opts.plate,
      headed: opts.headed,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
    });
  });

program.parse();
