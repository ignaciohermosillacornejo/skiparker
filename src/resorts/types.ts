import type { Page, ElementHandle } from 'playwright-core';
import type { DateStatus } from '../types.js';

export interface ResortDescriptor {
  id: string;
  name: string;
  platform: string;
  urls: {
    base: string;
    login: string;
    reservations: string;
    promo?: string;
  };
  calendar: {
    container: string;
    dayCellTemplate: string;
    dateFormat: 'aria-label-long' | 'data-date-iso';
    navLeft?: string;
    navRight?: string;
    maxNavigationAttempts: number;
  };
  availability: {
    rules: AvailabilityRule[];
  };
  lots: {
    supported: boolean;
    discoverySelector?: string;
  };
  timing: {
    calendarLoadTimeout: number;
    calendarRenderDelay: number;
    spaRenderDelay: number;
    monthNavigationDelay: number;
    lotSelectDelay?: number;
  };
}

export interface AvailabilityRule {
  match: AvailabilityMatch;
  status: DateStatus;
}

export interface AvailabilityMatch {
  type: 'style-contains' | 'class-contains' | 'aria-disabled';
  value: string;
}

export interface ResortHooks {
  findDateElement?: (page: Page, selector: string) => Promise<ElementHandle | null>;
  parseAvailability?: (element: ElementHandle) => Promise<DateStatus>;
  afterNavigate?: (page: Page) => Promise<void>;
  buildLoginCheck?: (page: Page) => Promise<boolean>;
}

export type ResolvedResort = {
  descriptor: ResortDescriptor;
  hooks?: ResortHooks;
};
