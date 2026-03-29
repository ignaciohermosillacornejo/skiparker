import readline from 'node:readline';
import { loadConfig, saveConfig } from '../lib/config.js';
import { log } from '../lib/utils.js';
import { DEFAULT_RESORT_URL } from '../constants.js';
import { createBrowser, closeBrowser } from '../lib/browser.js';
import { ScraperEngine } from '../resorts/index.js';
import { resolveResort } from '../lib/resolve.js';
import { authCommand } from './auth.js';
import type { SetupOptions } from '../types.js';

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

export async function setupCommand(options: SetupOptions = {}): Promise<void> {
  const config = loadConfig();

  const rl = readline.createInterface({
    input: options.input ?? process.stdin,
    output: options.output ?? process.stdout,
  });

  try {
    const currentUrl = config.resortUrl || DEFAULT_RESORT_URL;
    const urlAnswer = await prompt(rl, `Resort URL [${currentUrl}]: `);
    if (urlAnswer) {
      if (!urlAnswer.startsWith('https://')) {
        log.warn('URL must start with https://. Keeping previous value.');
      } else {
        config.resortUrl = urlAnswer;
      }
    }

    const resortUrl = config.resortUrl || DEFAULT_RESORT_URL;

    let resort;
    try {
      resort = resolveResort({ ...config, resortUrl });
    } catch (e) {
      log.warn(e instanceof Error ? e.message : String(e));
      log.warn('Continuing setup with default settings.');
    }

    let discoveredLots: string[] = [];
    if (resort) {
      try {
        console.log();
        log.info('Discovering parking lots...');
        const context = await createBrowser({ headed: false });
        const page = await context.newPage();
        const engine = new ScraperEngine();
        discoveredLots = await engine.discoverLots(page, resort);
        await closeBrowser(context);
      } catch {
        log.warn('Could not complete discovery. Lot preferences may need manual configuration.');
      }
    }

    if (discoveredLots.length > 1) {
      console.log();
      console.log('Available lots:');
      discoveredLots.forEach((lot, i) => console.log(`  ${i + 1}. ${lot}`));
      console.log();
      const lotAnswer = await prompt(rl, 'Rank lots by preference (e.g. "2,1") [discovery order]: ');
      if (lotAnswer) {
        const indices = lotAnswer.split(',').map(s => parseInt(s.trim(), 10) - 1);
        const ranked = indices
          .filter(i => i >= 0 && i < discoveredLots.length)
          .map(i => discoveredLots[i]);
        if (ranked.length > 0) {
          config.lotPreferences = ranked;
        } else {
          log.warn('Invalid lot selection. Using discovery order.');
          config.lotPreferences = discoveredLots;
        }
      } else {
        config.lotPreferences = discoveredLots;
      }
    } else if (discoveredLots.length === 1) {
      config.lotPreferences = discoveredLots;
      log.info(`Single lot found: ${discoveredLots[0]}`);
    } else {
      config.lotPreferences = undefined;
    }

    saveConfig(config);

    console.log();
    log.success('Saved to ~/.ski-parker/config.json');
    console.log(`  Resort: ${resortUrl}`);
    if (config.lotPreferences?.length) {
      const lotList = config.lotPreferences.map((l, i) => `${i + 1}. ${l}`).join('  ');
      console.log(`  Lots:   ${lotList}`);
    }

    console.log();
    const authAnswer = await prompt(rl, 'Authenticate now? (Y/n): ');
    const shouldAuth = !authAnswer || authAnswer.toLowerCase() === 'y' || authAnswer.toLowerCase() === 'yes';

    rl.close();

    if (shouldAuth && resort) {
      console.log();
      await authCommand({ verbose: false, resort });
    } else {
      console.log();
      log.info('Run "ski-parker auth" later to authenticate.');
    }
  } catch (error) {
    rl.close();
    throw error;
  }
}
