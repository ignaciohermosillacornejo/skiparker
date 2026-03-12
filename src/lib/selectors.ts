/**
 * Pure functions for building CSS selectors and formatting dates.
 * These are extracted from scraper.ts for testability.
 */

// Calendar colors used by HONK to indicate availability
export const CALENDAR_COLORS = {
  available: 'rgba(49, 200, 25',  // Green tint
  soldOut: 'rgb(247, 205, 212)',   // Pink/red tint
} as const;

export type CalendarColors = typeof CALENDAR_COLORS;

/**
 * Escape a string for safe use inside a CSS attribute selector [attr="value"].
 * Commas and other special chars would otherwise break the selector.
 */
function escapeCssAttrValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/,/g, '\\,');
}

/**
 * Format a date string for use in HONK calendar aria-labels.
 * HONK uses Mobiscroll calendar which sets aria-label to full date format.
 *
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns Formatted string like "Sunday, February 15, 2026"
 */
export function formatDateForAriaLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Parse calendar day inline style to determine availability status.
 * HONK uses inline background-color styles to indicate date status.
 *
 * @param style - The inline style string from the calendar day element
 * @param colors - Color configuration (defaults to CALENDAR_COLORS)
 * @returns Availability status based on color matching
 */
export function parseAvailabilityFromStyle(
  style: string,
  colors: CalendarColors = CALENDAR_COLORS
): 'available' | 'sold-out' | 'unknown' {
  if (style.includes(colors.available)) return 'available';
  if (style.includes(colors.soldOut)) return 'sold-out';
  return 'unknown';
}

/**
 * Build CSS selector for a specific date in the Mobiscroll calendar.
 *
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns CSS selector targeting the calendar day element
 */
export function buildCalendarDaySelector(dateStr: string): string {
  const label = formatDateForAriaLabel(dateStr);
  return `.mbsc-calendar-day-text[aria-label="${escapeCssAttrValue(label)}"]`;
}

/**
 * Build CSS selector for a rate card by its label text.
 * Matches cards within the active expandable container.
 *
 * @param labelText - Text to match (e.g., "Carpool", "Paid")
 * @returns CSS selector for the rate card
 */
export function buildRateCardSelector(labelText: string): string {
  return `[class*="containerActive"] [class*="card"]:has-text("${labelText}")`;
}

/**
 * Build CSS selector for a lot/zone card by name.
 * Matches cards within the active expandable container.
 *
 * @param lotName - Lot name to match (e.g., "CREEKSIDE")
 * @returns CSS selector for the lot card
 */
export function buildLotCardSelector(lotName: string): string {
  return `[class*="containerActive"] [class*="card"]:has-text("${lotName}")`;
}

/**
 * Build CSS selector for lot cards in the SelectZone container.
 * Used for discovering available lots on multi-lot sites.
 *
 * @returns CSS selector for all lot cards in the zone selector
 */
export function buildLotDiscoverySelector(): string {
  return '[class*="SelectZone"] [class*="card"]';
}
