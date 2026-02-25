import ora from 'ora';
import chalk from 'chalk';
import type { WatchOptions } from '../types.js';
import { createBrowser, hasSession, closeBrowser, checkSessionStatus } from '../lib/browser.js';
import { checkAvailability } from '../lib/scraper.js';
import { notifyAvailable } from '../lib/notify.js';
import { log, sleep, jitter as jitterFn } from '../lib/utils.js';

export async function watchCommand(options: WatchOptions): Promise<void> {
  const {
    date,
    interval,
    jitter,
    notify,
    sound,
    headed,
    verbose,
    resortUrl,
    lotPreferences,
  } = options;

  log.info(`Watching for parking availability on ${date}`);
  log.info(`Checking every ${interval}s (±${jitter}s jitter)`);

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
    if (!hasSession()) {
      log.warn('No saved session. Run `ski-parker auth` first.');
    }

    context = await createBrowser({ headed, verbose });
    const page = await context.newPage();

    if (hasSession()) {
      // Check session expiration
      const sessionStatus = await checkSessionStatus(context);
      if (!sessionStatus.valid) {
        log.error(sessionStatus.warning || 'Session expired. Run `ski-parker auth` first.');
        process.exit(1);
      }
      if (sessionStatus.warning) {
        log.warn(sessionStatus.warning);
      }
    }

    while (isRunning) {
      checkCount++;
      const spinner = ora(`Check #${checkCount}...`).start();

      try {
        const result = await checkAvailability(page, date, verbose, resortUrl, lotPreferences);

        if (result.status === 'available') {
          spinner.succeed(`Parking AVAILABLE for ${date}!`);

          if (notify) {
            notifyAvailable(date, { desktop: true, sound });
          }

          log.info('Book now at the resort site.');
          break; // Exit loop on availability
        }

        spinner.info(`Check #${checkCount}: ${result.status} - ${result.timestamp.toLocaleTimeString()}`);

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
      await closeBrowser(context);
    }
    log.info(`Completed ${checkCount} checks`);
  }
}
