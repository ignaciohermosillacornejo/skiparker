/**
 * Selectors for Crystal Mountain Resort parking (parking.crystalmountainresort.com).
 *
 * Crystal's calendar is a custom div-based calendar, not Mobiscroll. Day cells are
 * `.calendar_day` elements inside `#calendar` and include a `data-date` ISO string
 * like `2026-03-20T07:00:00.000Z`.
 */

export const CRYSTAL_SELECTORS = {
  calendar: '#calendar',
  navLeft: '#calendarNavLeft',
  navRight: '#calendarNavRight',
  /** Day cell for a specific YYYY-MM-DD. */
  dayCell: (dateStr: string) => `#calendar .calendar_day[data-date^="${dateStr}"]`,
} as const;

export function buildCrystalCalendarDaySelectors(dateStr: string): string[] {
  return [
    CRYSTAL_SELECTORS.dayCell(dateStr),
  ];
}

/**
 * Parse availability from a calendar day element.
 * Crystal may use inline styles (green = available, red/pink = sold out) or classes.
 */
export function parseCrystalAvailability(
  style: string,
  className: string,
  ariaDisabled: string | null
): 'available' | 'sold-out' | 'no-reservation' | 'unavailable' | 'unknown' {
  // Crystal uses class names:
  // - fc-available: reservable / available
  // - fc-unavailable: sold out
  // - no-reserve: no reservation required
  // - calendar_disabled: disabled (past / padding cells)
  if (ariaDisabled === 'true') return 'unavailable';

  if (className.includes('calendar_disabled')) return 'unavailable';
  if (className.includes('no-reserve')) return 'no-reservation';
  if (className.includes('fc-available')) return 'available';
  if (className.includes('fc-unavailable')) return 'sold-out';

  // Fallbacks (rare; keep for resilience)
  if (style.includes('fc-available') || /available|open/i.test(className)) return 'available';
  if (style.includes('fc-unavailable') || /sold|full|unavailable/i.test(className)) return 'sold-out';

  return 'unknown';
}
