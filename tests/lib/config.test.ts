import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import { loadConfig, saveConfig, getDefaultConfig, ensureConfigDir } from '../../src/lib/config.js';

describe('getDefaultConfig', () => {
  it('returns default configuration', () => {
    const config = getDefaultConfig();
    expect(config.pollInterval).toBe(60);
    expect(config.jitter).toBe(20);
    expect(config.notifications.desktop).toBe(true);
    expect(config.notifications.sound).toBe(true);
    expect(config.browser.headless).toBe(true);
  });
});

describe('ensureConfigDir', () => {
  let existsSyncSpy: ReturnType<typeof vi.spyOn>;
  let mkdirSyncSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    existsSyncSpy = vi.spyOn(fs, 'existsSync');
    mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates directory if it does not exist', () => {
    existsSyncSpy.mockReturnValue(false);
    ensureConfigDir();
    expect(mkdirSyncSpy).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it('does not create directory if it exists', () => {
    existsSyncSpy.mockReturnValue(true);
    ensureConfigDir();
    expect(mkdirSyncSpy).not.toHaveBeenCalled();
  });
});

describe('loadConfig', () => {
  let existsSyncSpy: ReturnType<typeof vi.spyOn>;
  let readFileSyncSpy: ReturnType<typeof vi.spyOn>;
  let mkdirSyncSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    existsSyncSpy = vi.spyOn(fs, 'existsSync');
    readFileSyncSpy = vi.spyOn(fs, 'readFileSync');
    mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns default config when file does not exist', () => {
    existsSyncSpy.mockImplementation((p) => {
      if (String(p).endsWith('config.json')) return false;
      return true;
    });

    const config = loadConfig();
    expect(config.pollInterval).toBe(60);
    expect(readFileSyncSpy).not.toHaveBeenCalled();
  });

  it('loads and merges config from file', () => {
    existsSyncSpy.mockReturnValue(true);
    readFileSyncSpy.mockReturnValue(JSON.stringify({
      resortUrl: 'https://example.com',
      defaultPlate: 'ABC123',
    }));

    const config = loadConfig();
    expect(config.resortUrl).toBe('https://example.com');
    expect(config.defaultPlate).toBe('ABC123');
    expect(config.pollInterval).toBe(60);
  });

  it('returns default config on JSON parse error', () => {
    existsSyncSpy.mockReturnValue(true);
    readFileSyncSpy.mockReturnValue('invalid json');

    const config = loadConfig();
    expect(config.pollInterval).toBe(60);
  });
});

describe('saveConfig', () => {
  let existsSyncSpy: ReturnType<typeof vi.spyOn>;
  let writeFileSyncSpy: ReturnType<typeof vi.spyOn>;
  let mkdirSyncSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    existsSyncSpy = vi.spyOn(fs, 'existsSync');
    writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes config to file', () => {
    existsSyncSpy.mockReturnValue(true);

    const config = getDefaultConfig();
    config.defaultPlate = 'XYZ789';
    saveConfig(config);

    expect(writeFileSyncSpy).toHaveBeenCalledWith(
      expect.stringContaining('config.json'),
      expect.stringContaining('XYZ789')
    );
  });

  it('ensures config directory exists before saving', () => {
    existsSyncSpy.mockReturnValue(false);

    saveConfig(getDefaultConfig());

    expect(mkdirSyncSpy).toHaveBeenCalled();
    expect(writeFileSyncSpy).toHaveBeenCalled();
  });
});
