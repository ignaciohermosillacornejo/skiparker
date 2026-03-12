import ora from 'ora';
import type { AuthOptions } from '../types.js';
import { createBrowser, saveSession, isLoggedIn } from '../lib/browser.js';
import { waitForLogin } from '../lib/scraper.js';
import { log } from '../lib/utils.js';

export async function authCommand(options: AuthOptions): Promise<void> {
  const spinner = ora('Launching browser for login...').start();

  let context;
  try {
    // Always headed for auth
    context = await createBrowser({ headed: true, verbose: options.verbose });
    const page = await context.newPage();

    spinner.text = 'Checking existing session...';

    // Check if already logged in
    if (await isLoggedIn(page, options.resortUrl)) {
      spinner.succeed('Already logged in!');
      await saveSession(context);
      await context.close();
      return;
    }

    spinner.info('Please log in to the resort parking site in the browser window.');
    spinner.start('Waiting for login...');

    const loggedIn = await waitForLogin(page, options.verbose, options.resortUrl);

    if (loggedIn) {
      spinner.succeed('Login successful!');
      await saveSession(context);
      log.success('Session saved to ~/.ski-parker/session.json');
    } else {
      spinner.fail('Login timed out. Please try again.');
    }

  } catch (error) {
    spinner.fail('Authentication failed');
    log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    if (context) {
      await context.close();
    }
  }
}
