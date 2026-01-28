import readline from 'node:readline';
import { loadConfig, saveConfig } from '../lib/config.js';
import { log } from '../lib/utils.js';
import { RESERVATION_TYPES } from '../constants.js';
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
    const currentPlate = config.defaultPlate || 'none';
    const plateAnswer = await prompt(rl, `License plate [${currentPlate}]: `);
    if (plateAnswer) {
      config.defaultPlate = plateAnswer.toUpperCase();
    }

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
    console.log(`  Plate: ${config.defaultPlate || 'none'}`);
    console.log(`  Type:  ${config.defaultType || 'none'}`);
  } finally {
    rl.close();
  }
}
