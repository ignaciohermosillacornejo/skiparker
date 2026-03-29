# Multi-Platform Adapter Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace HONK-specific scraping code with a composition-based adapter system (descriptor + engine + hooks + registry), add Crystal Mountain support, and add platform awareness to the mock server for e2e tests.

**Architecture:** Resort descriptors (pure data) describe selectors, availability rules, and timing. A shared ScraperEngine interprets descriptors and drives Playwright. Optional hooks handle per-resort edge cases. A registry maps URLs to descriptors.

**Tech Stack:** TypeScript, Playwright, Vitest, Vite + React (mock server)

**Spec:** `docs/superpowers/specs/2026-03-28-multi-platform-adapter-architecture-design.md`

**Note:** The ingestion agent (spec Part 4) gets its own plan after this is complete.

**Spec deviations:**
- Mock server uses React components (not static HTML injection as spec describes) — the static HTML approach is tied to the ingestion agent which is deferred. React is simpler for now.
- `scripts/validate-selectors.ts` evolution is deferred to the ingestion agent plan.
- `nameAttribute` on `lots` is omitted (YAGNI — engine matches lots by textContent directly).

---

## File Structure

**Create:**
```
src/resorts/
  types.ts                          # ResortDescriptor, ResortHooks, AvailabilityRule, ResolvedResort
  engine.ts                         # ScraperEngine class + pure helper functions
  registry.ts                       # ResortRegistry (register, findByUrl, findById, list)
  stevens-pass/
    descriptor.ts                   # HONK descriptor (selectors, rules, timing)
    hooks.ts                        # findVisible hook for Mobiscroll duplicates
  crystal-mountain/
    descriptor.ts                   # Crystal descriptor
tests/resorts/
  engine.test.ts                    # Pure function tests (formatDateForSelector, evaluateAvailabilityRules, buildDayCellSelector)
  registry.test.ts                  # Registry unit tests
  stevens-pass.test.ts              # Descriptor + hooks tests
  crystal-mountain.test.ts          # Crystal descriptor tests
tests/e2e/
  watch-crystal.test.ts             # Crystal e2e tests (new)
tests/mock-server/src/
  components/CrystalCalendar.tsx    # Crystal Mountain calendar mock component
  pages/CrystalParking.tsx          # Crystal parking page (renders CrystalCalendar)
```

**Modify:**
```
src/types.ts                        # Delete unused ResortConfig, LotConfig, etc.
src/constants.ts                    # Remove getUrls, URLS, RESERVATION_TYPES; keep PATHS, DEFAULTS, DEFAULT_RESORT_URL
src/lib/resolve.ts                  # resolveResort() using registry, handle SKI_PARKER_BASE_URL
src/commands/watch.ts               # Use engine + registry
src/commands/auth.ts                # Use engine + registry
src/commands/setup.ts               # Use engine + registry
src/index.ts                        # Add `resorts` command, update auth description
src/lib/browser.ts                  # Remove getUrls import, update isLoggedIn to accept base URL
src/capture-fixtures.ts             # Update to use registry instead of URLS constant
tests/lib/resolve.test.ts           # Update for new resolveResort function
tests/e2e/watch.test.ts             # Rename to watch-honk.test.ts, add platform to scenarios
tests/e2e/helpers.ts                # Add platform to setScenarioViaApi type
tests/mock-server/src/scenario.ts   # Add platform field to MockScenario
tests/mock-server/src/App.tsx       # Platform-aware routing
```

**Delete:**
```
src/lib/scraper.ts                  # Replaced by engine.ts
src/lib/selectors.ts                # Absorbed into descriptors + engine
tests/lib/selectors.test.ts         # Replaced by descriptor tests + engine tests
tests/lib/constants.test.ts         # Replaced by registry tests (if it exists on current branch)
```

---

### Task 1: Resort Type Definitions

**Files:**
- Create: `src/resorts/types.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Create resort type definitions**

```typescript
// src/resorts/types.ts
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
```

- [ ] **Step 2: Delete unused types from src/types.ts**

Remove lines 46-115 from `src/types.ts` (the entire "Config-driven Resort System" section: `BookingFlowType`, `ReservationTypeConfig`, `LotConfig`, `ResortConfig`). Keep `DateStatus`, `AvailabilityResult`, `Config`, `WatchOptions`, `AuthOptions`, `SetupOptions`.

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors (deleted types are unused)

- [ ] **Step 4: Commit**

```bash
git add src/resorts/types.ts src/types.ts
git commit -m "feat: add resort descriptor type definitions, remove unused ResortConfig"
```

---

### Task 2: Engine Pure Functions (TDD)

**Files:**
- Create: `src/resorts/engine.ts` (partial — only pure functions)
- Create: `tests/resorts/engine.test.ts`

- [ ] **Step 1: Write failing tests for formatDateForSelector**

```typescript
// tests/resorts/engine.test.ts
import { describe, it, expect } from 'vitest';
import { formatDateForSelector, buildDayCellSelector, evaluateAvailabilityRules } from '../../src/resorts/engine.js';

describe('formatDateForSelector', () => {
  it('formats aria-label-long as full weekday date', () => {
    expect(formatDateForSelector('2026-02-15', 'aria-label-long'))
      .toBe('Sunday, February 15, 2026');
  });

  it('formats data-date-iso as YYYY-MM-DD passthrough', () => {
    expect(formatDateForSelector('2026-03-20', 'data-date-iso'))
      .toBe('2026-03-20');
  });

  it('handles leap year dates', () => {
    expect(formatDateForSelector('2028-02-29', 'aria-label-long'))
      .toBe('Tuesday, February 29, 2028');
  });

  it('handles different months', () => {
    expect(formatDateForSelector('2026-01-01', 'aria-label-long'))
      .toBe('Thursday, January 1, 2026');
    expect(formatDateForSelector('2026-12-25', 'aria-label-long'))
      .toBe('Friday, December 25, 2026');
  });
});

describe('buildDayCellSelector', () => {
  it('builds HONK selector with aria-label', () => {
    const calendar = {
      container: '.mbsc-calendar',
      dayCellTemplate: '.mbsc-calendar-day-text[aria-label="{date}"]',
      dateFormat: 'aria-label-long' as const,
      maxNavigationAttempts: 6,
    };
    expect(buildDayCellSelector(calendar, '2026-02-15'))
      .toBe('.mbsc-calendar-day-text[aria-label="Sunday, February 15, 2026"]');
  });

  it('builds Crystal selector with data-date prefix', () => {
    const calendar = {
      container: '#calendar',
      dayCellTemplate: '#calendar .calendar_day[data-date^="{date}"]',
      dateFormat: 'data-date-iso' as const,
      maxNavigationAttempts: 6,
    };
    expect(buildDayCellSelector(calendar, '2026-03-20'))
      .toBe('#calendar .calendar_day[data-date^="2026-03-20"]');
  });
});

describe('evaluateAvailabilityRules', () => {
  const honkRules = [
    { match: { type: 'style-contains' as const, value: 'rgba(49, 200, 25' }, status: 'available' as const },
    { match: { type: 'style-contains' as const, value: 'rgb(247, 205, 212)' }, status: 'sold-out' as const },
    { match: { type: 'aria-disabled' as const, value: 'true' }, status: 'unavailable' as const },
  ];

  it('matches available by style', () => {
    expect(evaluateAvailabilityRules(honkRules, {
      style: 'background-color: rgba(49, 200, 25, 0.2); color: rgb(0, 0, 0);',
      className: '',
      ariaDisabled: null,
    })).toBe('available');
  });

  it('matches sold-out by style', () => {
    expect(evaluateAvailabilityRules(honkRules, {
      style: 'background-color: rgb(247, 205, 212); color: rgb(0, 0, 0);',
      className: '',
      ariaDisabled: null,
    })).toBe('sold-out');
  });

  it('matches unavailable by aria-disabled', () => {
    expect(evaluateAvailabilityRules(honkRules, {
      style: '',
      className: '',
      ariaDisabled: 'true',
    })).toBe('unavailable');
  });

  it('returns no-reservation when no rules match', () => {
    expect(evaluateAvailabilityRules(honkRules, {
      style: 'color: rgb(0, 0, 0);',
      className: '',
      ariaDisabled: null,
    })).toBe('no-reservation');
  });

  it('returns first matching rule (order matters)', () => {
    const rules = [
      { match: { type: 'class-contains' as const, value: 'fc-available' }, status: 'available' as const },
      { match: { type: 'class-contains' as const, value: 'fc' }, status: 'sold-out' as const },
    ];
    expect(evaluateAvailabilityRules(rules, {
      style: '',
      className: 'calendar_day fc-available',
      ariaDisabled: null,
    })).toBe('available');
  });

  it('matches Crystal classes', () => {
    const crystalRules = [
      { match: { type: 'aria-disabled' as const, value: 'true' }, status: 'unavailable' as const },
      { match: { type: 'class-contains' as const, value: 'calendar_disabled' }, status: 'unavailable' as const },
      { match: { type: 'class-contains' as const, value: 'no-reserve' }, status: 'no-reservation' as const },
      { match: { type: 'class-contains' as const, value: 'fc-available' }, status: 'available' as const },
      { match: { type: 'class-contains' as const, value: 'fc-unavailable' }, status: 'sold-out' as const },
    ];

    expect(evaluateAvailabilityRules(crystalRules, {
      style: '', className: 'calendar_day fc-available', ariaDisabled: null,
    })).toBe('available');

    expect(evaluateAvailabilityRules(crystalRules, {
      style: '', className: 'calendar_day fc-unavailable', ariaDisabled: null,
    })).toBe('sold-out');

    expect(evaluateAvailabilityRules(crystalRules, {
      style: '', className: 'calendar_day no-reserve', ariaDisabled: null,
    })).toBe('no-reservation');

    expect(evaluateAvailabilityRules(crystalRules, {
      style: '', className: 'calendar_day calendar_disabled', ariaDisabled: null,
    })).toBe('unavailable');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/resorts/engine.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the pure functions**

```typescript
// src/resorts/engine.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/resorts/engine.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/resorts/engine.ts tests/resorts/engine.test.ts
git commit -m "feat: add engine pure functions for date formatting and availability rule evaluation"
```

---

### Task 3: Resort Registry (TDD)

**Files:**
- Create: `src/resorts/registry.ts`
- Create: `tests/resorts/registry.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/resorts/registry.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ResortRegistry } from '../../src/resorts/registry.js';
import type { ResortDescriptor } from '../../src/resorts/types.js';

const makeDescriptor = (overrides: Partial<ResortDescriptor> = {}): ResortDescriptor => ({
  id: 'test-resort',
  name: 'Test Resort',
  platform: 'test',
  urls: { base: 'https://test.example.com', login: '/login', reservations: '/reserve' },
  calendar: {
    container: '.cal',
    dayCellTemplate: '.day[data-date="{date}"]',
    dateFormat: 'data-date-iso',
    maxNavigationAttempts: 3,
  },
  availability: { rules: [] },
  lots: { supported: false },
  timing: {
    calendarLoadTimeout: 5000,
    calendarRenderDelay: 200,
    spaRenderDelay: 500,
    monthNavigationDelay: 200,
  },
  ...overrides,
});

describe('ResortRegistry', () => {
  let registry: ResortRegistry;

  beforeEach(() => {
    registry = new ResortRegistry();
  });

  describe('register + findById', () => {
    it('registers and retrieves a resort by id', () => {
      const desc = makeDescriptor();
      registry.register(desc);
      const resort = registry.findById('test-resort');
      expect(resort.descriptor).toBe(desc);
      expect(resort.hooks).toBeUndefined();
    });

    it('registers with hooks', () => {
      const desc = makeDescriptor();
      const hooks = { afterNavigate: async () => {} };
      registry.register(desc, hooks);
      const resort = registry.findById('test-resort');
      expect(resort.hooks).toBe(hooks);
    });

    it('throws on unknown id', () => {
      expect(() => registry.findById('nope'))
        .toThrow(/no resort registered with id "nope"/i);
    });
  });

  describe('findByUrl', () => {
    it('matches by normalized hostname', () => {
      registry.register(makeDescriptor({
        id: 'sp',
        urls: { base: 'https://reservenski.parkstevenspass.com', login: '/login', reservations: '/select-parking' },
      }));
      const resort = registry.findByUrl('https://reservenski.parkstevenspass.com');
      expect(resort.descriptor.id).toBe('sp');
    });

    it('normalizes trailing slashes', () => {
      registry.register(makeDescriptor({
        id: 'sp',
        urls: { base: 'https://example.com', login: '/login', reservations: '/' },
      }));
      expect(registry.findByUrl('https://example.com/').descriptor.id).toBe('sp');
    });

    it('normalizes case', () => {
      registry.register(makeDescriptor({
        id: 'sp',
        urls: { base: 'https://Example.COM', login: '/login', reservations: '/' },
      }));
      expect(registry.findByUrl('https://example.com').descriptor.id).toBe('sp');
    });

    it('strips protocol for matching', () => {
      registry.register(makeDescriptor({
        id: 'sp',
        urls: { base: 'https://example.com', login: '/login', reservations: '/' },
      }));
      expect(registry.findByUrl('http://example.com').descriptor.id).toBe('sp');
    });

    it('throws on no match with helpful message', () => {
      registry.register(makeDescriptor({ id: 'sp', name: 'Stevens Pass', urls: { base: 'https://sp.com', login: '/l', reservations: '/r' } }));
      registry.register(makeDescriptor({ id: 'cm', name: 'Crystal Mountain', urls: { base: 'https://cm.com', login: '/l', reservations: '/r' } }));
      expect(() => registry.findByUrl('https://unknown.com'))
        .toThrow(/Stevens Pass.*Crystal Mountain/s);
    });
  });

  describe('list', () => {
    it('returns all registered resorts', () => {
      registry.register(makeDescriptor({ id: 'a', name: 'Resort A' }));
      registry.register(makeDescriptor({ id: 'b', name: 'Resort B' }));
      const list = registry.list();
      expect(list).toHaveLength(2);
      expect(list.map(r => r.id)).toEqual(['a', 'b']);
    });

    it('returns empty array when no resorts registered', () => {
      expect(registry.list()).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/resorts/registry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the registry**

```typescript
// src/resorts/registry.ts
import type { ResortDescriptor, ResortHooks, ResolvedResort } from './types.js';

function normalizeUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

export class ResortRegistry {
  private resorts = new Map<string, ResolvedResort>();

  register(descriptor: ResortDescriptor, hooks?: ResortHooks): void {
    this.resorts.set(descriptor.id, { descriptor, hooks });
  }

  findById(id: string): ResolvedResort {
    const resort = this.resorts.get(id);
    if (!resort) {
      throw new Error(
        `No resort registered with id "${id}". Available: ${this.listIds().join(', ') || '(none)'}`,
      );
    }
    return resort;
  }

  findByUrl(url: string): ResolvedResort {
    const normalized = normalizeUrl(url);
    for (const resort of this.resorts.values()) {
      if (normalizeUrl(resort.descriptor.urls.base) === normalized) {
        return resort;
      }
    }
    const available = this.list()
      .map(r => `  ${r.name} — ${r.urls.base}`)
      .join('\n');
    throw new Error(
      `No resort matches URL "${url}". Supported resorts:\n${available || '  (none registered)'}`,
    );
  }

  list(): ResortDescriptor[] {
    return Array.from(this.resorts.values()).map(r => r.descriptor);
  }

  private listIds(): string[] {
    return Array.from(this.resorts.keys());
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/resorts/registry.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/resorts/registry.ts tests/resorts/registry.test.ts
git commit -m "feat: add ResortRegistry with URL normalization and lookup"
```

---

### Task 4: Stevens Pass Descriptor + Hooks (TDD)

**Files:**
- Create: `src/resorts/stevens-pass/descriptor.ts`
- Create: `src/resorts/stevens-pass/hooks.ts`
- Create: `tests/resorts/stevens-pass.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/resorts/stevens-pass.test.ts
import { describe, it, expect } from 'vitest';
import { descriptor } from '../../src/resorts/stevens-pass/descriptor.js';
import { hooks } from '../../src/resorts/stevens-pass/hooks.js';
import { buildDayCellSelector, evaluateAvailabilityRules } from '../../src/resorts/engine.js';

describe('Stevens Pass descriptor', () => {
  it('has correct id and platform', () => {
    expect(descriptor.id).toBe('stevens-pass');
    expect(descriptor.platform).toBe('honk');
  });

  it('builds correct HONK calendar selector', () => {
    const selector = buildDayCellSelector(descriptor.calendar, '2026-02-15');
    expect(selector).toBe('.mbsc-calendar-day-text[aria-label="Sunday, February 15, 2026"]');
  });

  it('builds selector for different date', () => {
    const selector = buildDayCellSelector(descriptor.calendar, '2026-03-21');
    expect(selector).toBe('.mbsc-calendar-day-text[aria-label="Saturday, March 21, 2026"]');
  });

  it('detects available from green style', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: 'background-color: rgba(49, 200, 25, 0.2); color: rgb(0, 0, 0);',
      className: '',
      ariaDisabled: null,
    })).toBe('available');
  });

  it('detects sold-out from pink style', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: 'background-color: rgb(247, 205, 212); color: rgb(0, 0, 0);',
      className: '',
      ariaDisabled: null,
    })).toBe('sold-out');
  });

  it('detects unavailable from aria-disabled', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: '',
      className: '',
      ariaDisabled: 'true',
    })).toBe('unavailable');
  });

  it('returns no-reservation for unstyled dates', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: 'color: rgb(0, 0, 0);',
      className: '',
      ariaDisabled: null,
    })).toBe('no-reservation');
  });

  it('supports lot discovery', () => {
    expect(descriptor.lots.supported).toBe(true);
    expect(descriptor.lots.discoverySelector).toBeDefined();
  });

  it('has correct URLs', () => {
    expect(descriptor.urls.base).toBe('https://reservenski.parkstevenspass.com');
    expect(descriptor.urls.reservations).toBe('/select-parking');
    expect(descriptor.urls.login).toBe('/login');
    expect(descriptor.urls.promo).toBe('/code');
  });
});

describe('Stevens Pass hooks', () => {
  it('exports findDateElement hook', () => {
    expect(hooks.findDateElement).toBeDefined();
    expect(typeof hooks.findDateElement).toBe('function');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/resorts/stevens-pass.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Create the descriptor**

```typescript
// src/resorts/stevens-pass/descriptor.ts
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
```

- [ ] **Step 4: Create the hooks**

```typescript
// src/resorts/stevens-pass/hooks.ts
import type { Page, ElementHandle } from 'playwright-core';
import type { ResortHooks } from '../types.js';

/**
 * Mobiscroll renders duplicate calendar cells across month panels.
 * page.$() returns the first (often hidden) match. This hook
 * iterates all matches and returns the first visible one.
 */
async function findVisible(page: Page, selector: string): Promise<ElementHandle | null> {
  const elements = await page.$$(selector);
  for (const el of elements) {
    if (await el.isVisible()) return el;
  }
  return elements[0] ?? null;
}

export const hooks: ResortHooks = {
  findDateElement: findVisible,
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/resorts/stevens-pass.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/resorts/stevens-pass/ tests/resorts/stevens-pass.test.ts
git commit -m "feat: add Stevens Pass (HONK) descriptor and findVisible hook"
```

---

### Task 5: Crystal Mountain Descriptor (TDD)

**Files:**
- Create: `src/resorts/crystal-mountain/descriptor.ts`
- Create: `tests/resorts/crystal-mountain.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/resorts/crystal-mountain.test.ts
import { describe, it, expect } from 'vitest';
import { descriptor } from '../../src/resorts/crystal-mountain/descriptor.js';
import { buildDayCellSelector, evaluateAvailabilityRules } from '../../src/resorts/engine.js';

describe('Crystal Mountain descriptor', () => {
  it('has correct id and platform', () => {
    expect(descriptor.id).toBe('crystal-mountain');
    expect(descriptor.platform).toBe('crystal');
  });

  it('builds correct Crystal calendar selector', () => {
    const selector = buildDayCellSelector(descriptor.calendar, '2026-03-20');
    expect(selector).toBe('#calendar .calendar_day[data-date^="2026-03-20"]');
  });

  it('detects available from fc-available class', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: '', className: 'calendar_day fc-available', ariaDisabled: null,
    })).toBe('available');
  });

  it('detects sold-out from fc-unavailable class', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: '', className: 'calendar_day fc-unavailable', ariaDisabled: null,
    })).toBe('sold-out');
  });

  it('detects no-reservation from no-reserve class', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: '', className: 'calendar_day no-reserve', ariaDisabled: null,
    })).toBe('no-reservation');
  });

  it('detects unavailable from calendar_disabled class', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: '', className: 'calendar_day calendar_disabled', ariaDisabled: null,
    })).toBe('unavailable');
  });

  it('detects unavailable from aria-disabled', () => {
    expect(evaluateAvailabilityRules(descriptor.availability.rules, {
      style: '', className: 'calendar_day', ariaDisabled: 'true',
    })).toBe('unavailable');
  });

  it('does not support lots', () => {
    expect(descriptor.lots.supported).toBe(false);
  });

  it('has reservations at root path', () => {
    expect(descriptor.urls.reservations).toBe('/');
  });

  it('has correct URLs', () => {
    expect(descriptor.urls.base).toBe('https://parking.crystalmountainresort.com');
    expect(descriptor.urls.login).toBe('/login');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/resorts/crystal-mountain.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the descriptor**

```typescript
// src/resorts/crystal-mountain/descriptor.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/resorts/crystal-mountain.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/resorts/crystal-mountain/ tests/resorts/crystal-mountain.test.ts
git commit -m "feat: add Crystal Mountain descriptor (from PR #13 reference)"
```

---

### Task 6: ScraperEngine Class

**Files:**
- Modify: `src/resorts/engine.ts` (add the class below the existing pure functions)

- [ ] **Step 1: Add the ScraperEngine class to engine.ts**

Append to the existing `src/resorts/engine.ts` (after the pure functions):

```typescript
// --- ScraperEngine class ---

export class ScraperEngine {
  private verbose: boolean;

  constructor(options: { verbose?: boolean } = {}) {
    this.verbose = options.verbose ?? false;
  }

  async navigateToReservations(page: Page, resort: ResolvedResort): Promise<void> {
    const { descriptor, hooks } = resort;
    const url = descriptor.urls.base + descriptor.urls.reservations;
    log.verbose(`Navigating to ${url}`, this.verbose);
    await page.goto(url, { waitUntil: 'networkidle' });
    if (hooks?.afterNavigate) {
      await hooks.afterNavigate(page);
    }
    await sleep(descriptor.timing.spaRenderDelay);
  }

  async selectLotIfNeeded(
    page: Page,
    resort: ResolvedResort,
    lotPreferences?: string[],
  ): Promise<void> {
    const { descriptor } = resort;
    if (!descriptor.lots.supported || !descriptor.lots.discoverySelector) {
      log.verbose('No lot selection needed', this.verbose);
      return;
    }

    const lotCards = await page.$$(descriptor.lots.discoverySelector);
    if (lotCards.length === 0) {
      log.verbose('No lot cards found (single-lot site)', this.verbose);
      return;
    }

    if (lotPreferences?.length) {
      for (const pref of lotPreferences) {
        for (const card of lotCards) {
          const text = (await card.textContent())?.trim();
          if (text && text.includes(pref)) {
            log.verbose(`Selecting preferred lot: ${pref}`, this.verbose);
            await card.click();
            await sleep(descriptor.timing.lotSelectDelay ?? 1500);
            return;
          }
        }
      }
      log.verbose('No preferred lots found, selecting first available', this.verbose);
    }

    const firstLot = lotCards[0];
    const lotName = (await firstLot.textContent())?.trim() || 'first lot';
    log.verbose(`Auto-selecting lot: ${lotName}`, this.verbose);
    await firstLot.click();
    await sleep(descriptor.timing.lotSelectDelay ?? 1500);
  }

  async findDateElement(
    page: Page,
    resort: ResolvedResort,
    dateStr: string,
  ): Promise<ElementHandle | null> {
    const { descriptor, hooks } = resort;
    const selector = buildDayCellSelector(descriptor.calendar, dateStr);

    // Try to find the element (with hook if available)
    const find = hooks?.findDateElement
      ? (s: string) => hooks.findDateElement!(page, s)
      : (s: string) => page.$(s);

    let element = await find(selector);
    let attempts = 0;

    // Navigate months if needed
    while (!element && attempts < descriptor.calendar.maxNavigationAttempts) {
      const navSelector = descriptor.calendar.navRight;
      if (!navSelector) break;

      const nextBtn = await page.$(navSelector);
      if (!nextBtn) break;

      const isDisabled = await nextBtn.getAttribute('disabled');
      if (isDisabled) break;

      await nextBtn.click();
      await sleep(descriptor.timing.monthNavigationDelay);
      element = await find(selector);
      attempts++;
    }

    return element;
  }

  async evaluateElement(
    element: ElementHandle,
    resort: ResolvedResort,
  ): Promise<DateStatus> {
    const { descriptor, hooks } = resort;

    if (hooks?.parseAvailability) {
      return hooks.parseAvailability(element);
    }

    const style = (await element.getAttribute('style')) || '';
    const className = (await element.getAttribute('class')) || '';
    const ariaDisabled = await element.getAttribute('aria-disabled');

    return evaluateAvailabilityRules(descriptor.availability.rules, {
      style,
      className,
      ariaDisabled,
    });
  }

  async checkAvailability(
    page: Page,
    resort: ResolvedResort,
    dateStr: string,
    lotPreferences?: string[],
  ): Promise<AvailabilityResult> {
    const { descriptor } = resort;
    log.verbose(`Checking availability for ${dateStr}`, this.verbose);

    await this.navigateToReservations(page, resort);
    await this.selectLotIfNeeded(page, resort, lotPreferences);

    const result: AvailabilityResult = {
      date: dateStr,
      status: 'unknown',
      timestamp: new Date(),
    };

    // Wait for calendar
    await page.waitForSelector(descriptor.calendar.container, {
      timeout: descriptor.timing.calendarLoadTimeout,
    });
    await sleep(descriptor.timing.calendarRenderDelay);

    // Find date element
    const dateElement = await this.findDateElement(page, resort, dateStr);

    if (!dateElement) {
      result.status = 'unavailable';
      log.verbose(`Date ${dateStr} not found in calendar after navigation`, this.verbose);
      return result;
    }

    result.status = await this.evaluateElement(dateElement, resort);
    log.verbose(`Date status: ${result.status}`, this.verbose);

    return result;
  }

  async discoverLots(page: Page, resort: ResolvedResort): Promise<string[]> {
    const { descriptor } = resort;
    if (!descriptor.lots.supported || !descriptor.lots.discoverySelector) {
      log.verbose('No lots to discover (single-product site)', this.verbose);
      return [];
    }

    const url = descriptor.urls.base + descriptor.urls.reservations;
    await page.goto(url, { waitUntil: 'networkidle' });
    await sleep(descriptor.timing.spaRenderDelay);

    const lotCards = await page.$$(descriptor.lots.discoverySelector);
    const lots: string[] = [];
    for (const card of lotCards) {
      const text = await card.textContent();
      if (text) lots.push(text.trim());
    }
    log.verbose(`Discovered ${lots.length} lots: ${lots.join(', ')}`, this.verbose);
    return lots;
  }

  async waitForLogin(page: Page, resort: ResolvedResort): Promise<boolean> {
    const { descriptor } = resort;
    log.verbose('Waiting for login...', this.verbose);

    const loginUrl = descriptor.urls.base + descriptor.urls.login;
    await page.goto(loginUrl, { waitUntil: 'networkidle' });

    try {
      await page.waitForFunction(
        () => !window.location.href.includes('/login'),
        { timeout: 300000 },
      );
      return true;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run all existing tests to verify no regressions**

Run: `npm test`
Expected: All existing tests still PASS (new code is additive, nothing imports it yet)

- [ ] **Step 4: Commit**

```bash
git add src/resorts/engine.ts
git commit -m "feat: add ScraperEngine class with descriptor-driven availability checking"
```

---

### Task 7: Global Registry Instance + Resort Resolution

**Files:**
- Create: `src/resorts/index.ts`
- Modify: `src/lib/resolve.ts`

- [ ] **Step 1: Create the global registry with all resorts registered**

```typescript
// src/resorts/index.ts
import { ResortRegistry } from './registry.js';
import { descriptor as stevensPass } from './stevens-pass/descriptor.js';
import { hooks as stevensPassHooks } from './stevens-pass/hooks.js';
import { descriptor as crystalMountain } from './crystal-mountain/descriptor.js';

export const registry = new ResortRegistry();

registry.register(stevensPass, stevensPassHooks);
registry.register(crystalMountain);

export { ResortRegistry } from './registry.js';
export { ScraperEngine } from './engine.js';
export type { ResortDescriptor, ResortHooks, ResolvedResort } from './types.js';
```

- [ ] **Step 2: Update resolve.ts to use registry**

Replace the entire contents of `src/lib/resolve.ts`:

```typescript
// src/lib/resolve.ts
import { parseDate } from './utils.js';
import { registry } from '../resorts/index.js';
import type { Config } from '../types.js';
import type { ResolvedResort } from '../resorts/types.js';

export function resolveDate(dateStr: string): string {
  parseDate(dateStr);
  return dateStr;
}

export function resolveResort(config: Config): ResolvedResort {
  const baseUrlOverride = process.env.SKI_PARKER_BASE_URL;

  if (baseUrlOverride) {
    // Test mode: use platform env var to select descriptor, override base URL
    const platformId = process.env.SKI_PARKER_PLATFORM || 'stevens-pass';
    const resort = registry.findById(platformId);
    return {
      descriptor: {
        ...resort.descriptor,
        urls: { ...resort.descriptor.urls, base: baseUrlOverride },
      },
      hooks: resort.hooks,
    };
  }

  const url = config.resortUrl;
  if (!url) {
    throw new Error('No resort URL configured. Run `ski-parker setup` first.');
  }
  return registry.findByUrl(url);
}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/resorts/index.ts src/lib/resolve.ts
git commit -m "feat: add global resort registry and resolveResort function"
```

---

### Task 8: Wire Commands to Use Engine + Registry

**Files:**
- Modify: `src/commands/watch.ts`
- Modify: `src/commands/auth.ts`
- Modify: `src/commands/setup.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Update watch.ts**

Replace the entire contents of `src/commands/watch.ts`:

```typescript
import ora from 'ora';
import chalk from 'chalk';
import type { ResolvedResort } from '../resorts/types.js';
import { createBrowser, hasSession, closeBrowser, checkSessionStatus } from '../lib/browser.js';
import { ScraperEngine } from '../resorts/index.js';
import { notifyAvailable } from '../lib/notify.js';
import { log, sleep, jitter as jitterFn } from '../lib/utils.js';

export interface WatchCommandOptions {
  date: string;
  interval: number;
  jitter: number;
  notify: boolean;
  sound: boolean;
  headed: boolean;
  verbose: boolean;
  resort: ResolvedResort;
  lotPreferences?: string[];
}

export async function watchCommand(options: WatchCommandOptions): Promise<void> {
  const {
    date,
    interval,
    jitter,
    notify,
    sound,
    headed,
    verbose,
    resort,
    lotPreferences,
  } = options;

  log.info(`Watching for parking availability on ${date}`);
  log.info(`Checking every ${interval}s (±${jitter}s jitter)`);

  console.log();
  console.log(chalk.gray('Press Ctrl+C to stop'));
  console.log();

  let context;
  let checkCount = 0;
  let isRunning = true;

  process.on('SIGINT', () => {
    isRunning = false;
    log.info('Shutting down...');
  });

  try {
    if (!hasSession()) {
      log.warn('No saved session. Run `ski-parker auth` first.');
    }

    context = await createBrowser({ headed, verbose });
    const page = await context.newPage();

    if (hasSession()) {
      const sessionStatus = await checkSessionStatus(context);
      if (!sessionStatus.valid) {
        log.error(sessionStatus.warning || 'Session expired. Run `ski-parker auth` first.');
        process.exit(1);
      }
      if (sessionStatus.warning) {
        log.warn(sessionStatus.warning);
      }
    }

    const engine = new ScraperEngine({ verbose });

    while (isRunning) {
      checkCount++;
      const spinner = ora(`Check #${checkCount}...`).start();

      try {
        const result = await engine.checkAvailability(page, resort, date, lotPreferences);

        if (result.status === 'available') {
          spinner.succeed(`Parking AVAILABLE for ${date}!`);

          if (notify) {
            notifyAvailable(date, { desktop: true, sound });
          }

          log.info('Book now at the resort site.');
          break;
        }

        spinner.info(`Check #${checkCount}: ${result.status} - ${result.timestamp.toLocaleTimeString()}`);

      } catch (error) {
        spinner.fail(`Check #${checkCount} failed: ${error}`);
        log.verbose(String(error), verbose);
      }

      const waitMs = jitterFn(interval * 1000, jitter * 1000);
      log.verbose(`Next check in ${Math.round(waitMs / 1000)}s`, verbose);
      await sleep(waitMs);
    }

  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    if (context) {
      await closeBrowser(context);
    }
    log.info(`Completed ${checkCount} checks`);
  }
}
```

- [ ] **Step 2: Update auth.ts**

Replace the entire contents of `src/commands/auth.ts`:

```typescript
import ora from 'ora';
import type { ResolvedResort } from '../resorts/types.js';
import { createBrowser, saveSession, isLoggedIn } from '../lib/browser.js';
import { ScraperEngine } from '../resorts/index.js';
import { log } from '../lib/utils.js';

export interface AuthCommandOptions {
  verbose: boolean;
  resort: ResolvedResort;
}

export async function authCommand(options: AuthCommandOptions): Promise<void> {
  const spinner = ora('Launching browser for login...').start();

  let context;
  try {
    context = await createBrowser({ headed: true, verbose: options.verbose });
    const page = await context.newPage();

    spinner.text = 'Checking existing session...';

    if (await isLoggedIn(page, options.resort.descriptor.urls.base)) {
      spinner.succeed('Already logged in!');
      await saveSession(context);
      await context.close();
      return;
    }

    spinner.info('Please log in to the resort parking site in the browser window.');
    spinner.start('Waiting for login...');

    const engine = new ScraperEngine({ verbose: options.verbose });
    const loggedIn = await engine.waitForLogin(page, options.resort);

    if (loggedIn) {
      spinner.succeed('Login successful!');
      await saveSession(context);
      log.success('Session saved to ~/.ski-parker/session.json');
    } else {
      spinner.fail('Login timed out. Please try again.');
    }

  } catch (error) {
    spinner.fail('Authentication failed');
    log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    if (context) {
      await context.close();
    }
  }
}
```

- [ ] **Step 3: Update setup.ts**

Replace the entire contents of `src/commands/setup.ts`:

```typescript
import readline from 'node:readline';
import { loadConfig, saveConfig } from '../lib/config.js';
import { log } from '../lib/utils.js';
import { DEFAULT_RESORT_URL } from '../constants.js';
import { createBrowser, closeBrowser } from '../lib/browser.js';
import { ScraperEngine } from '../resorts/index.js';
import { resolveResort } from '../lib/resolve.js';
import { authCommand } from './auth.js';
import type { SetupOptions } from '../types.js';

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

export async function setupCommand(options: SetupOptions = {}): Promise<void> {
  const config = loadConfig();

  const rl = readline.createInterface({
    input: options.input ?? process.stdin,
    output: options.output ?? process.stdout,
  });

  try {
    const currentUrl = config.resortUrl || DEFAULT_RESORT_URL;
    const urlAnswer = await prompt(rl, `Resort URL [${currentUrl}]: `);
    if (urlAnswer) {
      if (!urlAnswer.startsWith('https://')) {
        log.warn('URL must start with https://. Keeping previous value.');
      } else {
        config.resortUrl = urlAnswer;
      }
    }

    const resortUrl = config.resortUrl || DEFAULT_RESORT_URL;

    // Resolve resort to validate URL against registry
    let resort;
    try {
      resort = resolveResort({ ...config, resortUrl });
    } catch (e) {
      log.warn(e instanceof Error ? e.message : String(e));
      log.warn('Continuing setup with default settings.');
    }

    // Lot discovery
    let discoveredLots: string[] = [];
    if (resort) {
      try {
        console.log();
        log.info('Discovering parking lots...');
        const context = await createBrowser({ headed: false });
        const page = await context.newPage();
        const engine = new ScraperEngine();
        discoveredLots = await engine.discoverLots(page, resort);
        await closeBrowser(context);
      } catch {
        log.warn('Could not complete discovery. Lot preferences may need manual configuration.');
      }
    }

    if (discoveredLots.length > 1) {
      console.log();
      console.log('Available lots:');
      discoveredLots.forEach((lot, i) => console.log(`  ${i + 1}. ${lot}`));
      console.log();
      const lotAnswer = await prompt(rl, 'Rank lots by preference (e.g. "2,1") [discovery order]: ');
      if (lotAnswer) {
        const indices = lotAnswer.split(',').map(s => parseInt(s.trim(), 10) - 1);
        const ranked = indices
          .filter(i => i >= 0 && i < discoveredLots.length)
          .map(i => discoveredLots[i]);
        if (ranked.length > 0) {
          config.lotPreferences = ranked;
        } else {
          log.warn('Invalid lot selection. Using discovery order.');
          config.lotPreferences = discoveredLots;
        }
      } else {
        config.lotPreferences = discoveredLots;
      }
    } else if (discoveredLots.length === 1) {
      config.lotPreferences = discoveredLots;
      log.info(`Single lot found: ${discoveredLots[0]}`);
    } else {
      config.lotPreferences = undefined;
    }

    saveConfig(config);

    console.log();
    log.success('Saved to ~/.ski-parker/config.json');
    console.log(`  Resort: ${resortUrl}`);
    if (config.lotPreferences?.length) {
      const lotList = config.lotPreferences.map((l, i) => `${i + 1}. ${l}`).join('  ');
      console.log(`  Lots:   ${lotList}`);
    }

    // Prompt for authentication
    console.log();
    const authAnswer = await prompt(rl, 'Authenticate now? (Y/n): ');
    const shouldAuth = !authAnswer || authAnswer.toLowerCase() === 'y' || authAnswer.toLowerCase() === 'yes';

    rl.close();

    if (shouldAuth && resort) {
      console.log();
      await authCommand({ verbose: false, resortUrl, resort });
    } else {
      console.log();
      log.info('Run "ski-parker auth" later to authenticate.');
    }
  } catch (error) {
    rl.close();
    throw error;
  }
}
```

- [ ] **Step 4: Update index.ts**

In `src/index.ts`, make these changes:

1. Replace the scraper/resolve imports and update the `auth` and `watch` actions to use `resolveResort`:

```typescript
// Replace import line:
// import { resolveDate, resolveResortUrl } from './lib/resolve.js';
// With:
import { resolveDate, resolveResort } from './lib/resolve.js';
import { registry } from './resorts/index.js';
```

2. Update the auth command action:

```typescript
// Auth command
program
  .command('auth')
  .description('Authenticate with resort parking site (opens browser for manual login)')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (opts) => {
    let resort;
    try {
      resort = resolveResort(config);
    } catch (e) { fail(e); }
    await authCommand({ verbose: opts.verbose, resort });
  });
```

3. Update the watch command action:

```typescript
  .action(async (opts) => {
    let resort;
    try {
      resolveDate(opts.date);
      resort = resolveResort(config);
    } catch (e) { fail(e); }

    await watchCommand({
      date: opts.date,
      interval: parseInt(opts.interval, 10),
      jitter: parseInt(opts.jitter, 10),
      notify: opts.notify,
      sound: opts.sound,
      headed: opts.headed,
      verbose: opts.verbose,
      lotPreferences: opts.lot || config.lotPreferences,
      resort,
    });
  });
```

4. Add the `resorts` command after the `bug` command:

```typescript
// Resorts command
program
  .command('resorts')
  .description('List supported resorts')
  .action(() => {
    const resorts = registry.list();
    if (resorts.length === 0) {
      console.log('No resorts registered.');
      return;
    }
    console.log('\nSupported resorts:\n');
    for (const r of resorts) {
      const lots = r.lots.supported ? 'multi-lot' : 'single';
      console.log(`  ${r.name.padEnd(20)} ${r.urls.base.padEnd(50)} (${r.platform}, ${lots})`);
    }
    console.log();
  });
```

- [ ] **Step 5: Build and verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors. If there are errors from the old `scraper.ts` imports being unused, that's fine — we fix those in the next task.

Note: At this point both old (`scraper.ts`) and new (`engine.ts`) code exist. Commands now use the new code. The old code is still present but no longer imported by commands.

- [ ] **Step 6: Commit**

```bash
git add src/commands/watch.ts src/commands/auth.ts src/commands/setup.ts src/index.ts
git commit -m "feat: wire commands to use ScraperEngine + ResortRegistry"
```

---

### Task 9: Delete Legacy Code + Fix Broken Imports

**Files:**
- Delete: `src/lib/scraper.ts`
- Delete: `src/lib/selectors.ts`
- Delete: `tests/lib/selectors.test.ts`
- Modify: `src/constants.ts`
- Modify: `src/lib/browser.ts`
- Modify: `src/capture-fixtures.ts`
- Modify: `tests/lib/resolve.test.ts`

- [ ] **Step 1: Delete old scraper and selectors**

```bash
rm src/lib/scraper.ts src/lib/selectors.ts tests/lib/selectors.test.ts
```

- [ ] **Step 2: Clean up constants.ts**

Replace `src/constants.ts` with:

```typescript
import path from 'node:path';
import os from 'node:os';

export const DEFAULT_RESORT_URL = 'https://reservenski.parkstevenspass.com';

export const PATHS = {
  CONFIG_DIR: path.join(os.homedir(), '.ski-parker'),
  CONFIG_FILE: path.join(os.homedir(), '.ski-parker', 'config.json'),
  SESSION_FILE: path.join(os.homedir(), '.ski-parker', 'session.json'),
  CHROME_PROFILE: path.join(os.homedir(), '.ski-parker', 'chrome-profile'),
} as const;

export const DEFAULTS = {
  POLL_INTERVAL: 60,
  JITTER: 20,
  SLOW_MO: 50,
  VIEWPORT_WIDTH: 1280,
  VIEWPORT_HEIGHT: 720,
} as const;
```

- [ ] **Step 3: Update browser.ts — remove getUrls import, fix isLoggedIn**

In `src/lib/browser.ts`:

1. Change the import from:
   ```typescript
   import { PATHS, DEFAULTS, getUrls } from '../constants.js';
   ```
   to:
   ```typescript
   import { PATHS, DEFAULTS } from '../constants.js';
   ```

2. Update the `isLoggedIn` function to accept a base URL directly (callers already pass `resort.descriptor.urls.base`):
   ```typescript
   export async function isLoggedIn(page: Page, baseUrl?: string): Promise<boolean> {
     try {
       const url = baseUrl || 'about:blank';
       await page.goto(url, { waitUntil: 'networkidle' });
       const currentUrl = page.url();
       return !currentUrl.includes('/login');
     } catch {
       return false;
     }
   }
   ```

   The auth.ts already passes `options.resort.descriptor.urls.base` which is the full base URL (e.g., `https://reservenski.parkstevenspass.com`), so this is a drop-in replacement.

- [ ] **Step 4: Update capture-fixtures.ts — remove URLS import, use registry**

Replace `src/capture-fixtures.ts`:

```typescript
#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createBrowser, closeBrowser } from './lib/browser.js';
import { registry } from './resorts/index.js';
import { log, sleep } from './lib/utils.js';
import { DEFAULT_RESORT_URL } from './constants.js';

const FIXTURES_DIR = path.join(process.cwd(), 'fixtures');

async function captureFixtures() {
  log.info('Capturing HTML fixtures from live site...');
  log.warn('This requires a valid session. Run `ski-parker auth` first.');

  const resort = registry.findByUrl(DEFAULT_RESORT_URL);
  const baseUrl = resort.descriptor.urls.base;

  const context = await createBrowser({ headed: true, verbose: true });
  const page = await context.newPage();

  try {
    log.info('Capturing reservation page...');
    await page.goto(baseUrl + resort.descriptor.urls.reservations, { waitUntil: 'networkidle' });
    await sleep(3000);

    const mainHtml = await page.content();
    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'html', 'reservation-page.html'),
      mainHtml
    );
    log.success('Saved: fixtures/html/reservation-page.html');

    log.info('Capturing login page...');
    await page.goto(baseUrl + resort.descriptor.urls.login, { waitUntil: 'networkidle' });
    await sleep(2000);

    const loginHtml = await page.content();
    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'html', 'login-page.html'),
      loginHtml
    );
    log.success('Saved: fixtures/html/login-page.html');

    log.success('Fixture capture complete!');

  } catch (error) {
    log.error(`Capture failed: ${error}`);
  } finally {
    await closeBrowser(context);
  }
}

captureFixtures();
```

- [ ] **Step 5: Update resolve.test.ts**

Replace `tests/lib/resolve.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { resolveDate, resolveResort } from '../../src/lib/resolve.js';
import type { Config } from '../../src/types.js';

const mockConfig = (overrides: Partial<Config> = {}): Config => ({
  pollInterval: 60,
  jitter: 20,
  notifications: { desktop: true, sound: true },
  browser: { headless: true, slowMo: 50 },
  ...overrides,
});

describe('resolveDate', () => {
  it('returns valid future date unchanged', () => {
    const futureDate = '2030-06-15';
    expect(resolveDate(futureDate)).toBe(futureDate);
  });

  it('throws on invalid date format', () => {
    expect(() => resolveDate('2026-0215')).toThrow('Invalid date format');
    expect(() => resolveDate('02-15-2026')).toThrow('Invalid date format');
    expect(() => resolveDate('2026/02/15')).toThrow('Invalid date format');
  });

  it('throws on past date', () => {
    expect(() => resolveDate('2020-01-01')).toThrow('in the past');
  });
});

describe('resolveResort', () => {
  const originalBaseUrl = process.env.SKI_PARKER_BASE_URL;
  const originalPlatform = process.env.SKI_PARKER_PLATFORM;

  afterEach(() => {
    if (originalBaseUrl === undefined) delete process.env.SKI_PARKER_BASE_URL;
    else process.env.SKI_PARKER_BASE_URL = originalBaseUrl;
    if (originalPlatform === undefined) delete process.env.SKI_PARKER_PLATFORM;
    else process.env.SKI_PARKER_PLATFORM = originalPlatform;
  });

  it('resolves Stevens Pass by URL', () => {
    const config = mockConfig({ resortUrl: 'https://reservenski.parkstevenspass.com' });
    const resort = resolveResort(config);
    expect(resort.descriptor.id).toBe('stevens-pass');
  });

  it('resolves Crystal Mountain by URL', () => {
    const config = mockConfig({ resortUrl: 'https://parking.crystalmountainresort.com' });
    const resort = resolveResort(config);
    expect(resort.descriptor.id).toBe('crystal-mountain');
  });

  it('throws on unknown URL', () => {
    const config = mockConfig({ resortUrl: 'https://unknown-resort.example.com' });
    expect(() => resolveResort(config)).toThrow(/no resort matches/i);
  });

  it('throws when no URL configured', () => {
    delete process.env.SKI_PARKER_BASE_URL;
    const config = mockConfig();
    expect(() => resolveResort(config)).toThrow('No resort URL configured');
  });

  it('uses SKI_PARKER_BASE_URL with default platform', () => {
    process.env.SKI_PARKER_BASE_URL = 'http://localhost:3847';
    delete process.env.SKI_PARKER_PLATFORM;
    const config = mockConfig();
    const resort = resolveResort(config);
    expect(resort.descriptor.id).toBe('stevens-pass');
    expect(resort.descriptor.urls.base).toBe('http://localhost:3847');
  });

  it('uses SKI_PARKER_PLATFORM to select descriptor', () => {
    process.env.SKI_PARKER_BASE_URL = 'http://localhost:3847';
    process.env.SKI_PARKER_PLATFORM = 'crystal-mountain';
    const config = mockConfig();
    const resort = resolveResort(config);
    expect(resort.descriptor.id).toBe('crystal-mountain');
    expect(resort.descriptor.urls.base).toBe('http://localhost:3847');
  });
});
```

- [ ] **Step 6: Verify no remaining broken imports**

Run: `grep -r "from.*\/selectors" src/ --include="*.ts"` and `grep -r "from.*\/scraper" src/ --include="*.ts"` and `grep -r "getUrls\|URLS\b" src/ --include="*.ts"`

Expected: No matches (all old imports are cleaned up)

- [ ] **Step 7: Update test script in package.json**

Change the `test` script to include the new test directory:

```json
"test": "vitest run tests/lib/ tests/resorts/"
```

- [ ] **Step 8: Build and run all unit tests**

Run: `npx tsc --noEmit && npm test`
Expected: Compilation succeeds. All unit tests pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: delete legacy scraper/selectors, update browser.ts and capture-fixtures.ts, clean up constants"
```

---

### Task 10: Mock Server — Add Platform Support + Crystal Calendar

**Files:**
- Modify: `tests/mock-server/src/scenario.ts`
- Modify: `tests/mock-server/src/App.tsx`
- Create: `tests/mock-server/src/components/CrystalCalendar.tsx`
- Create: `tests/mock-server/src/pages/CrystalParking.tsx`

- [ ] **Step 1: Add platform field to scenario**

In `tests/mock-server/src/scenario.ts`:

1. Add `platform: string` to the `MockScenario` interface
2. Add `platform: 'honk'` to `defaultScenario`
3. Add this exported function:

```typescript
export function getScenarioPlatform(): string {
  return getScenario().platform ?? 'honk';
}
```

- [ ] **Step 2: Create CrystalCalendar component**

```typescript
// tests/mock-server/src/components/CrystalCalendar.tsx
import { useState } from 'react';
import { getDateStatus } from '../scenario';

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function statusToClass(status: string): string {
  switch (status) {
    case 'available': return 'fc-available';
    case 'sold-out': return 'fc-unavailable';
    case 'no-reservation': return 'no-reserve';
    default: return 'calendar_disabled';
  }
}

interface Props {
  onDateSelect?: (dateStr: string) => void;
}

export default function CrystalCalendar({ onDateSelect }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const days = [];
  // Padding for first week
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`pad-${i}`} className="calendar_day calendar_disabled" />);
  }
  // Actual days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDateStr(year, month, d);
    const isoDate = `${dateStr}T07:00:00.000Z`;
    const status = getDateStatus(dateStr);
    const cls = statusToClass(status);
    const isDisabled = status === 'unavailable';

    days.push(
      <div
        key={dateStr}
        className={`calendar_day ${cls}`}
        data-date={isoDate}
        aria-disabled={isDisabled ? 'true' : undefined}
        onClick={() => status === 'available' && onDateSelect?.(dateStr)}
        style={{ cursor: status === 'available' ? 'pointer' : 'default' }}
      >
        {d}
      </div>
    );
  }

  const goNext = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else { setMonth(m => m + 1); }
  };
  const goPrev = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else { setMonth(m => m - 1); }
  };

  return (
    <div id="calendar" style={{ maxWidth: 400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button id="calendarNavLeft" onClick={goPrev}>&larr;</button>
        <strong>{monthName}</strong>
        <button id="calendarNavRight" onClick={goNext}>&rarr;</button>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4,
        textAlign: 'center',
      }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ fontWeight: 'bold', fontSize: 12 }}>{d}</div>
        ))}
        {days}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create CrystalParking page**

```typescript
// tests/mock-server/src/pages/CrystalParking.tsx
import CrystalCalendar from '../components/CrystalCalendar';

export default function CrystalParking() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Crystal Mountain Parking</h1>
      <CrystalCalendar />
    </div>
  );
}
```

- [ ] **Step 4: Add Crystal CSS to mock server index.html**

Add a `<style>` block (or add to existing one) in `tests/mock-server/index.html` for Crystal calendar styling:

```css
/* Crystal Mountain calendar styles */
.calendar_day {
  padding: 8px;
  border-radius: 4px;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
.calendar_day.fc-available {
  background-color: #4CAF50;
  color: white;
}
.calendar_day.fc-unavailable {
  background-color: #f44336;
  color: white;
}
.calendar_day.no-reserve {
  background-color: #fff;
  color: #333;
}
.calendar_day.calendar_disabled {
  background-color: #eee;
  color: #aaa;
}
```

- [ ] **Step 5: Update App.tsx for platform-aware routing**

In `tests/mock-server/src/App.tsx`, import `getScenarioPlatform` from scenario and `CrystalParking`. Update the root route to render `CrystalParking` when platform is `'crystal'`:

```typescript
import CrystalParking from './pages/CrystalParking';
import { getScenarioPlatform } from './scenario';

// In the Routes:
<Route path="/" element={getScenarioPlatform() === 'crystal' ? <CrystalParking /> : <Home />} />
```

Note: Since `getScenarioPlatform()` reads from the cached scenario, and the page is loaded after the test sets the scenario via API, this will render the correct platform.

- [ ] **Step 6: Verify mock server starts**

Run: `cd tests/mock-server && bun run dev` (then Ctrl+C to stop)
Expected: Server starts on port 3847 without errors

- [ ] **Step 7: Commit**

```bash
git add tests/mock-server/
git commit -m "feat: add platform support to mock server with Crystal Mountain calendar"
```

---

### Task 11: E2e Test Migration + Crystal Tests

**Files:**
- Modify: `tests/e2e/helpers.ts`
- Rename: `tests/e2e/watch.test.ts` → `tests/e2e/watch-honk.test.ts`
- Create: `tests/e2e/watch-crystal.test.ts`
- Modify: `tests/e2e/cli.test.ts`

- [ ] **Step 1: Update helpers to support platform in scenario**

In `tests/e2e/helpers.ts`, update `setScenarioViaApi` type hint comment to note the `platform` field:

```typescript
// No code change needed — setScenarioViaApi already accepts Record<string, unknown>.
// Just add platform when calling it in new tests.
```

- [ ] **Step 2: Rename watch.test.ts and add platform to scenarios**

Rename the file:
```bash
mv tests/e2e/watch.test.ts tests/e2e/watch-honk.test.ts
```

In `tests/e2e/watch-honk.test.ts`, update the `beforeEach` and scenario calls to include `platform: 'honk'`:

```typescript
beforeEach(async () => {
  await setScenarioViaApi({
    platform: 'honk',
    dates: {
      [AVAILABLE_DATE]: 'available',
    },
  });
});
```

And in the "detects availability change" test:

```typescript
await setScenarioViaApi({
  platform: 'honk',
  dates: {},
});
// ...
await setScenarioViaApi({ platform: 'honk', dates: { [UNAVAILABLE_DATE]: 'available' } });
```

Also add `SKI_PARKER_PLATFORM: 'stevens-pass'` to the env in each spawn call:

```typescript
env: { ...process.env, SKI_PARKER_BASE_URL: getMockUrl(), SKI_PARKER_PLATFORM: 'stevens-pass' },
```

- [ ] **Step 3: Update cli.test.ts**

In `tests/e2e/cli.test.ts`, update the expected auth description:

```typescript
expect(stdout).toContain('Authenticate with resort parking site');
```

(If this was already changed, verify it matches the current `index.ts` description.)

- [ ] **Step 4: Create Crystal e2e test**

```typescript
// tests/e2e/watch-crystal.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { startMockServer, stopMockServer, getMockUrl, setScenarioViaApi, futureDate } from './helpers';

const CLI = path.resolve('dist/index.js');
const AVAILABLE_DATE = futureDate(7);

describe('watch command - Crystal Mountain (E2E)', () => {
  beforeAll(async () => {
    await startMockServer();
  }, 20000);

  afterAll(() => {
    stopMockServer();
  });

  beforeEach(async () => {
    await setScenarioViaApi({
      platform: 'crystal',
      dates: {
        [AVAILABLE_DATE]: 'available',
      },
    });
  });

  it('detects availability on Crystal Mountain', async () => {
    const proc = spawn('node', [CLI, 'watch', '--date', AVAILABLE_DATE, '--interval', '3', '--jitter', '0', '--verbose'], {
      env: {
        ...process.env,
        SKI_PARKER_BASE_URL: getMockUrl(),
        SKI_PARKER_PLATFORM: 'crystal-mountain',
      },
    });

    let stdout = '';
    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stdout += data.toString(); });

    const exitCode = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error(`watch did not exit in time. stdout: ${stdout}`));
      }, 30000);
      proc.on('close', (code) => {
        clearTimeout(timeout);
        resolve(code ?? 1);
      });
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('AVAILABLE');
  }, 60000);
});
```

- [ ] **Step 5: Build the project**

Run: `npm run build`
Expected: Clean compilation

- [ ] **Step 6: Run HONK e2e tests**

Run: `npx vitest run tests/e2e/watch-honk.test.ts --no-file-parallelism --test-timeout 90000`
Expected: All HONK e2e tests PASS

- [ ] **Step 7: Run Crystal e2e tests**

Run: `npx vitest run tests/e2e/watch-crystal.test.ts --no-file-parallelism --test-timeout 90000`
Expected: Crystal e2e test PASSES

- [ ] **Step 8: Run all tests**

Run: `npm run test:all`
Expected: All tests PASS (unit + e2e)

- [ ] **Step 9: Commit**

```bash
git add tests/e2e/
git commit -m "test: migrate HONK e2e tests, add Crystal Mountain e2e test"
```

---

## Summary

| Task | What | Key Files |
|------|------|-----------|
| 1 | Resort type definitions | `src/resorts/types.ts`, `src/types.ts` |
| 2 | Engine pure functions (TDD) | `src/resorts/engine.ts`, `tests/resorts/engine.test.ts` |
| 3 | Resort Registry (TDD) | `src/resorts/registry.ts`, `tests/resorts/registry.test.ts` |
| 4 | Stevens Pass descriptor + hooks (TDD) | `src/resorts/stevens-pass/`, `tests/resorts/stevens-pass.test.ts` |
| 5 | Crystal Mountain descriptor (TDD) | `src/resorts/crystal-mountain/`, `tests/resorts/crystal-mountain.test.ts` |
| 6 | ScraperEngine class | `src/resorts/engine.ts` |
| 7 | Registry instance + resolve | `src/resorts/index.ts`, `src/lib/resolve.ts` |
| 8 | Wire commands | `src/commands/*.ts`, `src/index.ts` |
| 9 | Delete legacy code | Remove `scraper.ts`, `selectors.ts`, clean `constants.ts` |
| 10 | Mock server platform support | `tests/mock-server/` |
| 11 | E2e test migration | `tests/e2e/` |

**Total commits:** 11
**Prerequisite for next plan:** Ingestion Agent skill (`/ingest-resort`)
