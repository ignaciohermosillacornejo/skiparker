import type { Page, ElementHandle } from 'playwright-core';
import type { DateStatus, AvailabilityResult } from '../types.js';
import type { ResortDescriptor, AvailabilityRule, ResolvedResort, ResortHooks } from './types.js';
import { sleep, log } from '../lib/utils.js';

// --- Pure functions (exported for unit testing) ---

export function formatDateForSelector(
  dateStr: string,
  format: ResortDescriptor['calendar']['dateFormat'],
): string {
  switch (format) {
    case 'aria-label-long': {
      const date = new Date(dateStr + 'T12:00:00');
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
    case 'data-date-iso':
      return dateStr;
  }
}

export function buildDayCellSelector(
  calendar: Pick<ResortDescriptor['calendar'], 'dayCellTemplate' | 'dateFormat'>,
  dateStr: string,
): string {
  const formatted = formatDateForSelector(dateStr, calendar.dateFormat);
  return calendar.dayCellTemplate.replace('{date}', formatted);
}

export function evaluateAvailabilityRules(
  rules: AvailabilityRule[],
  element: { style: string; className: string; ariaDisabled: string | null },
): DateStatus {
  for (const rule of rules) {
    switch (rule.match.type) {
      case 'style-contains':
        if (element.style.includes(rule.match.value)) return rule.status;
        break;
      case 'class-contains':
        if (element.className.includes(rule.match.value)) return rule.status;
        break;
      case 'aria-disabled':
        if (element.ariaDisabled === rule.match.value) return rule.status;
        break;
    }
  }
  return 'no-reservation';
}
