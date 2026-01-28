import ora from 'ora';
import chalk from 'chalk';
import type { CheckOptions, ReservationType } from '../types.js';
import { createBrowser, loadSession } from '../lib/browser.js';
import { checkAvailability } from '../lib/scraper.js';
import { log } from '../lib/utils.js';

export async function checkCommand(options: CheckOptions): Promise<void> {
  const spinner = ora(`Checking availability for ${options.date}...`).start();

  let context;
  try {
    context = await createBrowser({
      headed: options.headed,
      verbose: options.verbose
    });

    const page = await context.newPage();

    spinner.text = 'Loading session...';
    const hasSession = await loadSession(context);

    if (!hasSession) {
      spinner.warn('No saved session found. Run `ski-parker auth` first.');
    }

    spinner.text = 'Checking availability...';
    const result = await checkAvailability(page, options.date, options.verbose);

    spinner.stop();

    // Display results
    console.log();
    console.log(chalk.bold(`Availability for ${options.date}:`));
    console.log();

    const types: ReservationType[] = ['paid', 'carpool'];
    for (const type of types) {
      const available = result.available[type];
      const status = available
        ? chalk.green('✓ Available')
        : chalk.red('✗ Sold Out');
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      console.log(`  ${label.padEnd(10)} ${status}`);
    }

    console.log();
    console.log(chalk.gray(`Checked at: ${result.timestamp.toLocaleTimeString()}`));

  } catch (error) {
    spinner.fail('Check failed');
    log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    if (context) {
      await context.close();
    }
  }
}
