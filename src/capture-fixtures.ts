#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createBrowser, loadSession } from './lib/browser.js';
import { URLS } from './constants.js';
import { log, sleep } from './lib/utils.js';

const FIXTURES_DIR = path.join(process.cwd(), 'fixtures');

async function captureFixtures() {
  log.info('Capturing HTML fixtures from live site...');
  log.warn('This requires a valid session. Run `ski-parker auth` first.');

  const context = await createBrowser({ headed: true, verbose: true });
  const page = await context.newPage();

  await loadSession(context);

  try {
    // Capture main reservation page
    log.info('Capturing reservation page...');
    await page.goto(URLS.BASE, { waitUntil: 'networkidle' });
    await sleep(3000);

    const mainHtml = await page.content();
    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'html', 'reservation-page.html'),
      mainHtml
    );
    log.success('Saved: fixtures/html/reservation-page.html');

    // Capture login page
    log.info('Capturing login page...');
    await page.goto(URLS.LOGIN, { waitUntil: 'networkidle' });
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
    await context.close();
  }
}

captureFixtures();
