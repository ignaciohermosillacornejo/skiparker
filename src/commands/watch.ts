import ora from 'ora';
import chalk from 'chalk';
import type { ResolvedResort } from '../resorts/types.js';
import { createBrowser, hasSession, closeBrowser, checkSessionStatus } from '../lib/browser.js';
import { ScraperEngine } from '../resorts/index.js';
import { notifyAvailable } from '../lib/notify.js';
import { log, sleep, jitter as jitterFn } from '../lib/utils.js';

export interface WatchCommandOptions {
  date: string;
  interval: number;
  jitter: number;
  notify: boolean;
  sound: boolean;
  headed: boolean;
  verbose: boolean;
  resort: ResolvedResort;
  lotPreferences?: string[];
}

export async function watchCommand(options: WatchCommandOptions): Promise<void> {
  const {
    date,
    interval,
    jitter,
    notify,
    sound,
    headed,
    verbose,
    resort,
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
      const sessionStatus = await checkSessionStatus(context);
      if (!sessionStatus.valid) {
        log.error(sessionStatus.warning || 'Session expired. Run `ski-parker auth` first.');
        process.exit(1);
      }
      if (sessionStatus.warning) {
        log.warn(sessionStatus.warning);
      }
    }

    const engine = new ScraperEngine({ verbose });

    while (isRunning) {
      checkCount++;
      const spinner = ora(`Check #${checkCount}...`).start();

      try {
        const result = await engine.checkAvailability(page, resort, date, lotPreferences);

        if (result.status === 'available') {
          spinner.succeed(`Parking AVAILABLE for ${date}!`);

          if (notify) {
            notifyAvailable(date, { desktop: true, sound });
          }

          log.info('Book now at the resort site.');
          break;
        }

        spinner.info(`Check #${checkCount}: ${result.status} - ${result.timestamp.toLocaleTimeString()}`);

      } catch (error) {
        spinner.fail(`Check #${checkCount} failed: ${error}`);
        log.verbose(String(error), verbose);
      }

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
