import { describe, it, expect, afterEach } from 'vitest';
import {
  getPlatform,
  getUrls,
  CRYSTAL_MOUNTAIN_URL,
  DEFAULT_RESORT_URL,
} from '../../src/constants.js';

describe('getPlatform', () => {
  it('returns crystal for Crystal Mountain URL', () => {
    expect(getPlatform(CRYSTAL_MOUNTAIN_URL)).toBe('crystal');
    expect(getPlatform('https://parking.crystalmountainresort.com')).toBe('crystal');
    expect(getPlatform('https://parking.crystalmountainresort.com/')).toBe('crystal');
  });

  it('returns honk for HONK resort URLs', () => {
    expect(getPlatform(DEFAULT_RESORT_URL)).toBe('honk');
    expect(getPlatform('https://reservenski.parkstevenspass.com')).toBe('honk');
    expect(getPlatform('https://reservenski.whistlerblackcombparking.com')).toBe('honk');
  });
});

describe('getUrls', () => {
  it('returns Crystal reservations on BASE for Crystal Mountain', () => {
    const urls = getUrls(CRYSTAL_MOUNTAIN_URL);
    expect(urls.BASE).toBe('https://parking.crystalmountainresort.com');
    expect(urls.LOGIN).toBe('https://parking.crystalmountainresort.com/login');
    expect(urls.RESERVATIONS).toBe('https://parking.crystalmountainresort.com');
  });

  it('returns HONK select-parking path for HONK resorts', () => {
    const urls = getUrls(DEFAULT_RESORT_URL);
    expect(urls.RESERVATIONS).toBe('https://reservenski.parkstevenspass.com/select-parking');
  });
});
