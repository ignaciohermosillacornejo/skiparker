import readline from 'node:readline';
import { loadConfig, saveConfig } from '../lib/config.js';
import { log } from '../lib/utils.js';
import { DEFAULT_RESORT_URL, RESERVATION_TYPES } from '../constants.js';
import { createBrowser } from '../lib/browser.js';
import { discoverLots } from '../lib/scraper.js';
import type { ReservationType, SetupOptions } from '../types.js';

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
    // Resort URL
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

    // Lot discovery
    let discoveredLots: string[] = [];
    try {
      console.log();
      log.info('Discovering parking lots...');
      const context = await createBrowser({ headed: false });
      const page = await context.newPage();
      discoveredLots = await discoverLots(page, resortUrl);
      await context.close();
    } catch {
      log.warn('Could not discover lots. Skipping lot configuration.');
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

    // License plate
    const currentPlate = config.defaultPlate || 'none';
    const plateAnswer = await prompt(rl, `License plate [${currentPlate}]: `);
    if (plateAnswer) {
      config.defaultPlate = plateAnswer.toUpperCase();
    }

    // Reservation type
    const currentType = config.defaultType || 'none';
    const typeAnswer = await prompt(rl, `Preferred type (${RESERVATION_TYPES.join('/')}) [${currentType}]: `);
    if (typeAnswer) {
      if (!RESERVATION_TYPES.includes(typeAnswer as ReservationType)) {
        log.warn(`Invalid type: "${typeAnswer}". Keeping previous value.`);
      } else {
        config.defaultType = typeAnswer as ReservationType;
      }
    }

    saveConfig(config);

    console.log();
    log.success('Saved to ~/.ski-parker/config.json');
    console.log(`  Resort: ${resortUrl}`);
    if (config.lotPreferences?.length) {
      const lotList = config.lotPreferences.map((l, i) => `${i + 1}. ${l}`).join('  ');
      console.log(`  Lots:   ${lotList}`);
    }
    console.log(`  Plate:  ${config.defaultPlate || 'none'}`);
    console.log(`  Type:   ${config.defaultType || 'none'}`);
  } finally {
    rl.close();
  }
}
