import type { ResortDescriptor } from '../types.js';

export const descriptor: ResortDescriptor = {
  id: 'crystal-mountain',
  name: 'Crystal Mountain',
  platform: 'crystal',
  urls: {
    base: 'https://parking.crystalmountainresort.com',
    login: '/login',
    reservations: '/',
  },
  calendar: {
    container: '#calendar',
    dayCellTemplate: '#calendar .calendar_day[data-date^="{date}"]',
    dateFormat: 'data-date-iso',
    navLeft: '#calendarNavLeft',
    navRight: '#calendarNavRight',
    maxNavigationAttempts: 6,
  },
  availability: {
    rules: [
      { match: { type: 'aria-disabled', value: 'true' }, status: 'unavailable' },
      { match: { type: 'class-contains', value: 'calendar_disabled' }, status: 'unavailable' },
      { match: { type: 'class-contains', value: 'no-reserve' }, status: 'no-reservation' },
      { match: { type: 'class-contains', value: 'fc-available' }, status: 'available' },
      { match: { type: 'class-contains', value: 'fc-unavailable' }, status: 'sold-out' },
    ],
  },
  lots: {
    supported: false,
  },
  timing: {
    calendarLoadTimeout: 15000,
    calendarRenderDelay: 500,
    spaRenderDelay: 1500,
    monthNavigationDelay: 500,
  },
};
