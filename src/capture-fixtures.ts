#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createBrowser, closeBrowser } from './lib/browser.js';
import { registry } from './resorts/index.js';
import { log, sleep } from './lib/utils.js';
import { DEFAULT_RESORT_URL } from './constants.js';

const FIXTURES_DIR = path.join(process.cwd(), 'fixtures');

async function captureFixtures() {
  log.info('Capturing HTML fixtures from live site...');
  log.warn('This requires a valid session. Run `ski-parker auth` first.');

  const resort = registry.findByUrl(DEFAULT_RESORT_URL);
  const baseUrl = resort.descriptor.urls.base;

  const context = await createBrowser({ headed: true, verbose: true });
  const page = await context.newPage();

  try {
    log.info('Capturing reservation page...');
    await page.goto(baseUrl + resort.descriptor.urls.reservations, { waitUntil: 'networkidle' });
    await sleep(3000);

    const mainHtml = await page.content();
    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'html', 'reservation-page.html'),
      mainHtml
    );
    log.success('Saved: fixtures/html/reservation-page.html');

    log.info('Capturing login page...');
    await page.goto(baseUrl + resort.descriptor.urls.login, { waitUntil: 'networkidle' });
    await sleep(2000);

    const loginHtml = await page.content();
    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'html', 'login-page.html'),
      loginHtml
    );
    log.success('Saved: fixtures/html/login-page.html');

    log.success('Fixture capture complete!');

  } catch (error) {
    log.error(`Capture failed: ${error}`);
  } finally {
    await closeBrowser(context);
  }
}

captureFixtures();
