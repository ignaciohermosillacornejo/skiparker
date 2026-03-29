import type { ResortDescriptor } from '../types.js';

export const descriptor: ResortDescriptor = {
  id: 'stevens-pass',
  name: 'Stevens Pass',
  platform: 'honk',
  urls: {
    base: 'https://reservenski.parkstevenspass.com',
    login: '/login',
    reservations: '/select-parking',
    promo: '/code',
  },
  calendar: {
    container: '.mbsc-calendar',
    dayCellTemplate: '.mbsc-calendar-day-text[aria-label="{date}"]',
    dateFormat: 'aria-label-long',
    navRight: '.custom-next',
    maxNavigationAttempts: 6,
  },
  availability: {
    rules: [
      { match: { type: 'style-contains', value: 'rgba(49, 200, 25' }, status: 'available' },
      { match: { type: 'style-contains', value: 'rgb(247, 205, 212)' }, status: 'sold-out' },
      { match: { type: 'aria-disabled', value: 'true' }, status: 'unavailable' },
    ],
  },
  lots: {
    supported: true,
    discoverySelector: '[class*="SelectZone"] [class*="card"]',
  },
  timing: {
    calendarLoadTimeout: 15000,
    calendarRenderDelay: 500,
    spaRenderDelay: 1500,
    monthNavigationDelay: 500,
    lotSelectDelay: 1500,
  },
};
