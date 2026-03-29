import ora from 'ora';
import type { ResolvedResort } from '../resorts/types.js';
import { createBrowser, saveSession, isLoggedIn } from '../lib/browser.js';
import { ScraperEngine } from '../resorts/index.js';
import { log } from '../lib/utils.js';

export interface AuthCommandOptions {
  verbose: boolean;
  resort: ResolvedResort;
}

export async function authCommand(options: AuthCommandOptions): Promise<void> {
  const spinner = ora('Launching browser for login...').start();

  let context;
  try {
    context = await createBrowser({ headed: true, verbose: options.verbose });
    const page = await context.newPage();

    spinner.text = 'Checking existing session...';

    if (await isLoggedIn(page, options.resort.descriptor.urls.base)) {
      spinner.succeed('Already logged in!');
      await saveSession(context);
      await context.close();
      return;
    }

    spinner.info('Please log in to the resort parking site in the browser window.');
    spinner.start('Waiting for login...');

    const engine = new ScraperEngine({ verbose: options.verbose });
    const loggedIn = await engine.waitForLogin(page, options.resort);

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
