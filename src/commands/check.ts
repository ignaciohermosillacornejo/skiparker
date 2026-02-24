import ora from 'ora';
import chalk from 'chalk';
import type { CheckOptions, ReservationType } from '../types.js';
import { createBrowser, hasSession, closeBrowser, checkSessionStatus } from '../lib/browser.js';
import { checkAvailability } from '../lib/scraper.js';
import { log } from '../lib/utils.js';

export async function checkCommand(options: CheckOptions): Promise<void> {
  const spinner = ora(`Checking availability for ${options.date}...`).start();

  let context;
  try {
    if (!hasSession()) {
      spinner.warn('No saved session found. Run `ski-parker auth` first.');
    }

    context = await createBrowser({
      headed: options.headed,
      verbose: options.verbose
    });

    const page = await context.newPage();

    if (hasSession()) {
      // Check session expiration
      const sessionStatus = await checkSessionStatus(context);
      if (sessionStatus.warning) {
        spinner.warn(sessionStatus.warning);
      }
    }

    spinner.text = 'Checking availability...';
    const result = await checkAvailability(page, options.date, options.verbose, options.resortUrl, options.lotPreferences);

    spinner.stop();

    // Display results
    console.log();
    console.log(chalk.bold(`Availability for ${options.date}:`));
    console.log();

    if (result.status === 'no-reservation') {
      console.log(chalk.gray('  No reservation needed for this date.'));
    } else if (result.status === 'unavailable') {
      console.log(chalk.gray('  This date is unavailable.'));
    } else if (result.status === 'sold-out') {
      console.log(chalk.red('  Sold out.'));
    } else {
      const types: ReservationType[] = ['paid', 'carpool', 'free'];
      for (const type of types) {
        const available = result.available[type];
        // Skip types that aren't offered at this resort (undefined means not checked)
        if (available === undefined) continue;
        const status = available
          ? chalk.green('✓ Available')
          : chalk.red('✗ Sold Out');
        const label = type.charAt(0).toUpperCase() + type.slice(1);
        console.log(`  ${label.padEnd(10)} ${status}`);
      }
    }

    console.log();
    console.log(chalk.gray(`Checked at: ${result.timestamp.toLocaleTimeString()}`));

  } catch (error) {
    spinner.fail('Check failed');
    log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    if (context) {
      await closeBrowser(context);
    }
  }
}
