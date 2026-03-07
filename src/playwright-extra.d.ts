declare module 'playwright-extra' {
  import type { BrowserType, Browser, BrowserContext, LaunchOptions } from 'playwright-core';

  interface PersistentContextOptions extends LaunchOptions {
    headless?: boolean;
    channel?: string;
    args?: string[];
    viewport?: { width: number; height: number };
    slowMo?: number;
  }

  interface PlaywrightExtra extends BrowserType {
    use(plugin: unknown): void;
    launchPersistentContext(
      userDataDir: string,
      options?: PersistentContextOptions
    ): Promise<BrowserContext>;
  }

  export const chromium: PlaywrightExtra;
}

declare module 'puppeteer-extra-plugin-stealth' {
  function stealth(): unknown;
  export default stealth;
}
