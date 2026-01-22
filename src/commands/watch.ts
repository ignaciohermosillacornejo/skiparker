import ora from 'ora';
import chalk from 'chalk';
import type { WatchOptions } from '../types.js';
import { createBrowser, loadSession } from '../lib/browser.js';
import { checkAvailability, bookSpot } from '../lib/scraper.js';
import { notifyAvailable, notifyBooked, notifyError } from '../lib/notify.js';
import { log, sleep, jitter as jitterFn } from '../lib/utils.js';

export async function watchCommand(options: WatchOptions): Promise<void> {
  const {
    date,
    type,
    interval,
    jitter,
    notify,
    sound,
    autoBook,
    headed,
    dryRun,
    verbose,
    plate,
  } = options;

  log.info(`Watching for ${type} parking on ${date}`);
  log.info(`Checking every ${interval}s (±${jitter}s jitter)`);

  if (autoBook) {
    if (!plate) {
      log.error('--plate is required when using --auto-book');
      process.exit(1);
    }
    log.info(`Auto-book enabled with plate: ${plate}`);
  }

  if (dryRun) {
    log.warn('Dry run mode - will not actually book');
  }

  console.log();
  console.log(chalk.gray('Press Ctrl+C to stop'));
  console.log();

  let context;
  let checkCount = 0;
  let isRunning = true;

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    isRunning = false;
    log.info('Shutting down...');
  });

  try {
    context = await createBrowser({ headed, verbose });
    const page = await context.newPage();

    const hasSession = await loadSession(context);
    if (!hasSession) {
      log.warn('No saved session. Run `ski-parker auth` first.');
    }

    while (isRunning) {
      checkCount++;
      const spinner = ora(`Check #${checkCount}...`).start();

      try {
        const result = await checkAvailability(page, date, verbose);
        const available = result.available[type];

        if (available) {
          spinner.succeed(`${type.toUpperCase()} parking AVAILABLE!`);

          if (notify) {
            notifyAvailable(date, type, { desktop: true, sound });
          }

          if (autoBook && plate) {
            log.info('Auto-booking...');
            const bookResult = await bookSpot(page, date, type, plate, dryRun, verbose);

            if (bookResult.success) {
              log.success(`Booked! Confirmation: ${bookResult.confirmationNumber}`);
              notifyBooked(date, type, bookResult.confirmationNumber);
            } else {
              log.error(`Booking failed: ${bookResult.error}`);
              notifyError(`Booking failed: ${bookResult.error}`);
            }
          }

          break; // Exit loop on availability
        }

        spinner.info(`Check #${checkCount}: ${type} not available - ${result.timestamp.toLocaleTimeString()}`);

      } catch (error) {
        spinner.fail(`Check #${checkCount} failed: ${error}`);
        log.verbose(String(error), verbose);
      }

      // Wait with jitter before next check
      const waitMs = jitterFn(interval * 1000, jitter * 1000);
      log.verbose(`Next check in ${Math.round(waitMs / 1000)}s`, verbose);
      await sleep(waitMs);
    }

  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    if (context) {
      await context.close();
    }
    log.info(`Completed ${checkCount} checks`);
  }
}
