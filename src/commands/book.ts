import ora from 'ora';
import type { BookOptions } from '../types.js';
import { createBrowser, loadSession, validateSession } from '../lib/browser.js';
import { checkAvailability, bookSpot } from '../lib/scraper.js';
import { notifyBooked, notifyError } from '../lib/notify.js';
import { log } from '../lib/utils.js';

export async function bookCommand(options: BookOptions): Promise<void> {
  const { date, type, plate, headed, dryRun, verbose } = options;

  if (dryRun) {
    log.warn('Dry run mode - will stop before final confirmation');
  }

  const spinner = ora(`Booking ${type} parking for ${date}...`).start();

  let context;
  try {
    context = await createBrowser({ headed, verbose });
    const page = await context.newPage();

    spinner.text = 'Loading session...';
    const hasSession = await loadSession(context);

    if (!hasSession) {
      spinner.fail('No saved session found. Run `ski-parker auth` first.');
      process.exit(1);
    }

    // Validate session is still active
    spinner.text = 'Validating session...';
    const { resortUrl, lotPreferences } = options;
    const sessionStatus = await validateSession(context, resortUrl, verbose);
    if (!sessionStatus.valid) {
      spinner.fail(sessionStatus.warning || 'Session expired. Run `ski-parker auth` first.');
      process.exit(1);
    }

    spinner.text = 'Checking availability...';
    const availability = await checkAvailability(page, date, verbose, resortUrl, lotPreferences);

    if (!availability.available[type]) {
      spinner.fail(`${type} parking is not available for ${date}`);
      process.exit(1);
    }

    spinner.succeed(`${type} parking is available!`);
    spinner.start('Booking...');

    const result = await bookSpot(page, date, type, plate, dryRun, verbose, resortUrl, lotPreferences);

    if (result.success) {
      spinner.succeed('Booking successful!');
      console.log();
      log.success(`Date: ${result.date}`);
      log.success(`Type: ${result.type}`);
      log.success(`Plate: ${result.plate}`);
      if (result.confirmationNumber) {
        log.success(`Confirmation: ${result.confirmationNumber}`);
      }

      notifyBooked(date, type, result.confirmationNumber);
    } else {
      spinner.fail('Booking failed');
      log.error(result.error || 'Unknown error');
      notifyError(result.error || 'Booking failed');
      process.exit(1);
    }

  } catch (error) {
    spinner.fail('Booking failed');
    log.error(error instanceof Error ? error.message : String(error));
    notifyError(error instanceof Error ? error.message : 'Booking failed');
    process.exit(1);
  } finally {
    if (context) {
      await context.close();
    }
  }
}
