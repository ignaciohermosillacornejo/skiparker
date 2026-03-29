import type { Page, ElementHandle } from 'playwright-core';
import type { ResortHooks } from '../types.js';

async function findVisible(page: Page, selector: string): Promise<ElementHandle | null> {
  const elements = await page.$$(selector);
  for (const el of elements) {
    if (await el.isVisible()) return el;
  }
  return elements[0] ?? null;
}

export const hooks: ResortHooks = {
  findDateElement: findVisible,
};
