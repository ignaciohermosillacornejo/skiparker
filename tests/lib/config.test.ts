import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Mock the fs module before importing config
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

import { loadConfig, saveConfig, getDefaultConfig, ensureConfigDir } from '../../src/lib/config.js';

describe('getDefaultConfig', () => {
  it('should return default configuration', () => {
    const config = getDefaultConfig();
    expect(config.pollInterval).toBe(300);
    expect(config.jitter).toBe(60);
    expect(config.notifications.desktop).toBe(true);
    expect(config.notifications.sound).toBe(true);
    expect(config.browser.headless).toBe(true);
  });
});
