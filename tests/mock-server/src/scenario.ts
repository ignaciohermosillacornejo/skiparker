export type CheckoutOutcome = 'confirm' | 'overlap' | 'limit';

export interface MockScenario {
  dates: Record<string, 'available' | 'sold-out' | 'no-reservation'>;
  checkoutOutcome: CheckoutOutcome;
  plate: string;
  bookingCount: number;
  lots?: string[];
  platform: string;
}

// Realistic mix: weekends available/sold-out, some weekdays no-reservation, rest unavailable
const DEFAULT_DATES: Record<string, 'available' | 'sold-out' | 'no-reservation'> = {
  // January 2026 — mostly past, a few weekends
  '2026-01-31': 'available',
  // February 2026
  '2026-02-01': 'available',
  '2026-02-07': 'sold-out',
  '2026-02-08': 'available',
  '2026-02-14': 'available',
  '2026-02-15': 'sold-out',
  '2026-02-16': 'no-reservation',
  '2026-02-21': 'available',
  '2026-02-22': 'sold-out',
  '2026-02-28': 'available',
  // March 2026
  '2026-03-01': 'available',
  '2026-03-07': 'sold-out',
  '2026-03-08': 'available',
  '2026-03-14': 'available',
  '2026-03-15': 'no-reservation',
  '2026-03-21': 'sold-out',
  '2026-03-22': 'available',
  '2026-03-28': 'available',
  '2026-03-29': 'sold-out',
};

const DEFAULT_SCENARIO: MockScenario = {
  dates: DEFAULT_DATES,
  checkoutOutcome: 'confirm',
  plate: 'CFH2637',
  bookingCount: 0,
  platform: 'honk',
};

let cachedScenario: MockScenario | null = null;

export async function fetchScenario(): Promise<MockScenario> {
  try {
    const res = await fetch('/api/scenario');
    const data = await res.json();
    cachedScenario = {
      ...DEFAULT_SCENARIO,
      ...data,
      dates: { ...DEFAULT_SCENARIO.dates, ...(data.dates ?? {}) },
    };
  } catch {
    cachedScenario = DEFAULT_SCENARIO;
  }
  return cachedScenario;
}

export function getScenario(): MockScenario {
  return cachedScenario ?? DEFAULT_SCENARIO;
}

export function getDateStatus(dateStr: string): 'available' | 'sold-out' | 'no-reservation' | 'unavailable' {
  const scenario = getScenario();
  return scenario.dates[dateStr] ?? 'unavailable';
}

export function getScenarioPlatform(): string {
  return getScenario().platform ?? 'honk';
}
