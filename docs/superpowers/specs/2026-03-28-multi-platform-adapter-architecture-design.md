# Multi-Platform Adapter Architecture + Ingestion Agent

**Date:** 2026-03-28
**Status:** Draft
**Context:** PR #13 (Crystal Mountain support) revealed the need for a proper multi-platform architecture. This spec designs both the adapter system and the ingestion agent that populates it.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture style | Composition (descriptor + engine + hooks) | Easiest to auto-generate and test in isolation |
| Adapter interface | Hybrid: descriptor for data, code hooks for edge cases | Most sites are "calendar with colored dates"; hooks handle quirks |
| Number of platforms (now) | HONK + Crystal Mountain | Extensible but grounded in real needs |
| Resort watching | One at a time, flat config | Simple UX, matches real usage |
| Mock server | One server, multi-personality | Platform-specific HTML/CSS served based on scenario config |
| Contributor relationship (PR #13) | We implement everything; PR is reference material | Ensures architectural consistency |
| Ingestion agent | Claude Code skill producing descriptors + mock assets | Automates resort onboarding and maintenance |

---

## Part 1: Adapter Architecture

### 1.1 Resort Descriptor

A TypeScript object that describes how to interact with a resort's parking site. Primarily declarative data, with one pragmatic exception noted below.

#### Relationship to existing `ResortConfig`

The existing `ResortConfig` interface in `types.ts` (along with `LotConfig`, `ReservationTypeConfig`, `BookingFlowType`) was designed speculatively and is currently unused. `ResortDescriptor` replaces it entirely. During implementation, delete `ResortConfig`, `LotConfig`, `ReservationTypeConfig`, and `BookingFlowType` from `types.ts`. Any fields from those types that prove useful (e.g., `carpoolThreshold`, `requiresPhoneVerification`) can be added to `ResortDescriptor` later when a resort actually needs them.

```typescript
interface ResortDescriptor {
  id: string;                    // 'stevens-pass', 'crystal-mountain'
  name: string;                  // 'Stevens Pass'
  platform: string;              // 'honk', 'crystal' — informational
  urls: {
    base: string;                // 'https://reservenski.parkstevenspass.com'
    login: string;               // '/login'
    reservations: string;        // '/select-parking' or '/'
    promo?: string;              // '/code' (HONK-specific)
  };
  calendar: {
    container: string;           // CSS selector for calendar root
    dayCellTemplate: string;     // selector template with {date} placeholder
    dateFormat: 'aria-label-long' | 'data-date-iso' | 'data-date-ymd';
    navLeft?: string;
    navRight?: string;
    maxNavigationAttempts: number;
  };
  availability: {
    rules: AvailabilityRule[];   // ordered — first match wins
  };
  lots: {
    supported: boolean;          // false for Crystal (single product)
    discoverySelector?: string;
    nameAttribute?: string;
  };
  timing: {
    calendarLoadTimeout: number;
    calendarRenderDelay: number;
    spaRenderDelay: number;
    monthNavigationDelay: number;
    lotSelectDelay?: number;
  };
}

interface AvailabilityRule {
  match: AvailabilityMatch;
  status: DateStatus;
}

interface AvailabilityMatch {
  type: 'style-contains' | 'class-contains' | 'aria-disabled' | 'attribute' | 'element-absent';
  value: string;  // ignored for 'element-absent'
}

type ResolvedResort = { descriptor: ResortDescriptor; hooks?: ResortHooks };
```

#### Calendar date selector strategy

Rather than putting a function on the descriptor (which would complicate auto-generation by the ingestion agent), the calendar uses two declarative fields:

- `dayCellTemplate` — a CSS selector with a `{date}` placeholder, e.g.:
  - HONK: `.mbsc-calendar-day-text[aria-label="{date}"]`
  - Crystal: `#calendar .calendar_day[data-date^="{date}"]`
- `dateFormat` — tells the engine how to format the `YYYY-MM-DD` date string before substituting it into the template:
  - `'aria-label-long'`: `"Sunday, March 20, 2026"` (HONK/Mobiscroll)
  - `'data-date-iso'`: `"2026-03-20"` (Crystal, ISO prefix match)
  - `'data-date-ymd'`: `"2026-03-20"` (same as ISO, but available if a site uses a different prefix format)

The engine's `buildDayCellSelector(descriptor, dateStr)` handles the formatting and substitution. This keeps descriptors as pure data that the ingestion agent can generate without producing executable code.

If a future resort uses a date format not covered by the enum, add a new variant to `dateFormat` and a corresponding formatter in the engine — a one-line addition to each.

### 1.2 Resort Hooks

Optional per-resort behavioral overrides. Each hook replaces one step of the engine's default behavior.

```typescript
interface ResortHooks {
  findDateElement?: (page: Page, selector: string) => Promise<ElementHandle | null>;
  parseAvailability?: (element: ElementHandle) => Promise<DateStatus>;
  afterNavigate?: (page: Page) => Promise<void>;
  buildLoginCheck?: (page: Page) => Promise<boolean>;
}
```

Example: HONK needs a `findDateElement` hook because Mobiscroll renders hidden duplicate elements across month panels — the hook iterates elements and returns the first visible one.

### 1.3 Resort Registry

Manages resort lookup by URL. Replaces the `getPlatform()` function and `if/else` branching.

```typescript
// Registration
ResortRegistry.register('stevens-pass', descriptor, hooks?);
ResortRegistry.register('crystal-mountain', crystalDescriptor);

// Lookup (replaces getPlatform)
const resort = ResortRegistry.findByUrl('https://reservenski.parkstevenspass.com');
// Returns: { descriptor, hooks } or throws with list of supported resorts
```

#### URL matching strategy

URL matching normalizes both sides before comparing: lowercase, strip trailing slashes, strip protocol (`https://`), then compare hostnames. For example, `https://ReserveNSki.ParkStevensPass.com/` and `https://reservenski.parkstevenspass.com` both normalize to `reservenski.parkstevenspass.com` and match.

If no match is found, the error message lists all registered resorts with their URLs.

### 1.4 File Structure

```
src/
  resorts/
    registry.ts              # ResortRegistry class
    types.ts                 # ResortDescriptor, ResortHooks, AvailabilityRule interfaces
    stevens-pass/
      descriptor.ts          # export const descriptor: ResortDescriptor
      hooks.ts               # export const hooks: ResortHooks (findVisible override)
    crystal-mountain/
      descriptor.ts          # export const descriptor: ResortDescriptor
```

---

## Part 2: Scraper Engine

A single shared engine that reads a descriptor, applies hooks, and drives Playwright. Replaces both `scraper.ts` and `scraper-crystal.ts`.

### 2.1 Core Flow

```
ScraperEngine.checkAvailability(page, resort, dateStr, lotPreferences?)
  │
  ├── 1. navigateToReservations
  │     → goto resort.urls.base + resort.urls.reservations
  │     → hooks.afterNavigate?.(page)
  │     → sleep(resort.timing.spaRenderDelay)
  │
  ├── 2. selectLotIfNeeded
  │     → if !resort.lots.supported → skip
  │     → find lot cards via resort.lots.discoverySelector
  │     → click preferred lot or first available
  │
  ├── 3. waitForCalendar
  │     → waitForSelector(resort.calendar.container, timeout)
  │     → sleep(resort.timing.calendarRenderDelay)
  │
  ├── 4. findDateElement
  │     → build selector via buildDayCellSelector(descriptor, dateStr)
  │     → hooks.findDateElement?.(page, selector)
  │     → OR default: page.$(selector)
  │     → if not found: navigate months via navRight, retry up to maxNavigationAttempts
  │     → if still not found after max attempts: return 'element-absent' status
  │
  └── 5. evaluateAvailability
        → hooks.parseAvailability?.(element)
        → OR default: iterate resort.availability.rules, first match wins
        → extract style/class/aria from element, test against each rule
        → return DateStatus
```

### 2.2 Engine Interface

```typescript
export class ScraperEngine {
  constructor(options: { verbose?: boolean });

  async checkAvailability(
    page: Page,
    resort: ResolvedResort,
    dateStr: string,
    lotPreferences?: string[]
  ): Promise<AvailabilityResult>;

  async discoverLots(page: Page, resort: ResolvedResort): Promise<string[]>;
  async waitForLogin(page: Page, resort: ResolvedResort): Promise<boolean>;
  async navigateToReservations(page: Page, resort: ResolvedResort): Promise<void>;
}
```

### 2.3 Command Integration

Commands resolve the resort from the registry, then use the engine:

```typescript
// watch.ts (before)
const result = await checkAvailability(page, dateStr, verbose, resortUrl, lotPreferences);

// watch.ts (after)
const resort = ResortRegistry.findByUrl(resortUrl);
const engine = new ScraperEngine({ verbose });
const result = await engine.checkAvailability(page, resort, dateStr, lotPreferences);
```

### 2.4 What Gets Deleted

- `src/lib/scraper-crystal.ts` — absorbed into Crystal descriptor + engine
- `src/lib/selectors-crystal.ts` — becomes Crystal descriptor
- `getPlatform()` and all `if (platform === 'crystal')` branching in `scraper.ts`
- `CALENDAR_COLORS` and `parseAvailabilityFromStyle` from `selectors.ts` — becomes HONK availability rules
- `selectors.ts` helper functions move into HONK descriptor's `dayCell` implementation

---

## Part 3: Mock Server Evolution

The single Vite mock server becomes platform-aware, serving different HTML/CSS based on scenario configuration.

### 3.1 Architecture

```
Mock Server (single Vite app, port 3847)
  │
  ├── /api/scenario           # POST — set test scenario (extended with platform)
  │     { platform: "honk", dates: { "2026-03-20": "available" }, ... }
  │
  ├── /api/platforms           # GET — list available mock platforms
  │
  └── /* (catch-all)           # Serves the active platform's HTML/CSS
        → injects scenario-driven availability states into the DOM
```

### 3.2 Platform Mock Assets

Each resort's mock assets are stored as static snapshots produced by the ingestion agent:

```
tests/mock-server/
  platforms/
    honk/
      index.html              # snapshot of select-parking page
      login.html              # snapshot of login page
      styles/                 # downloaded CSS files
      assets/                 # images, fonts
      scenario-map.json       # maps scenario states to DOM mutations
    crystal/
      index.html
      login.html
      styles/
      assets/
      scenario-map.json
  src/
    server.ts                 # Vite middleware, serves platform assets
    scenario.ts               # Scenario state management (extended)
    injector.ts               # Reads scenario + scenario-map, mutates served HTML
```

### 3.3 Scenario Map

The bridge between "real site snapshot" and "controllable test." Produced by the ingestion agent.

```json
{
  "platform": "honk",
  "dateElement": ".mbsc-calendar-day-text[aria-label=\"{dateLabel}\"]",
  "stateInjection": {
    "available": { "style": "background: rgba(49, 200, 25, 0.6)" },
    "sold-out": { "style": "background: rgb(247, 205, 212)" },
    "no-reservation": { "attribute": "aria-disabled", "value": "true" },
    "unavailable": { "remove": true }
  }
}
```

The injector reads this map and the current scenario, modifies the HTML before serving — swapping date elements' styles/classes/attributes to match the requested test state.

### 3.4 Migration

The existing HONK mock is a full Vite + React application (`App.tsx`, `components/`, `pages/`) that dynamically renders calendar state via React. This is a meaningful rewrite, not a rename:

1. **Capture static snapshots** — run the existing React mock server, use Playwright to navigate to each page state, save the rendered HTML. This produces the `platforms/honk/` HTML files with real Mobiscroll markup.
2. **Extract CSS** — the existing `public/css/` fixtures (stevens-pass.css, honk-app.css, honk-vendor.css) move directly into `platforms/honk/styles/`.
3. **Replace React rendering with server-side injection** — the new `injector.ts` reads the static HTML and mutates date elements based on the scenario, replacing what the React components did dynamically.
4. **Keep the existing mock server running during transition** — don't delete it until the new static-serving approach passes all existing e2e tests.

Scenario API keeps the same contract, extended with `platform` field (defaults to `"honk"` for backward compatibility). E2e tests add `platform` to scenario setup.

---

## Part 4: Ingestion Agent

A Claude Code skill (`/ingest-resort`) that automates resort discovery, descriptor generation, and mock asset download.

### 4.1 Pipeline

```
/ingest-resort https://parking.crystalmountainresort.com
  │
  ├── Phase 1: Discovery (Playwright + LLM observation)
  │     ├── Visit site, screenshot each key page
  │     ├── Identify calendar technology (Mobiscroll, custom div, FullCalendar, etc.)
  │     ├── Find date elements, extract selector patterns
  │     ├── Click dates across states, observe style/class/aria changes
  │     ├── Identify: available vs sold-out vs unavailable vs no-reservation
  │     ├── Check for lot selection (multi-lot vs single product)
  │     ├── Map URL structure (login, reservations, promo pages)
  │     └── Detect quirks (hidden duplicates, SPAs, Turnstile, iframes)
  │
  ├── Phase 2: Asset Download
  │     ├── Download HTML of key pages (calendar, login, lot selection)
  │     ├── Download CSS files (linked stylesheets + inline styles)
  │     ├── Download static assets (images, fonts referenced by CSS)
  │     └── Rewrite asset URLs to relative paths for local serving
  │
  ├── Phase 3: Report (human-reviewable)
  │     └── Structured markdown report:
  │           - Screenshots of each state observed
  │           - "I believe green (#31c819) = available because..."
  │           - "Calendar uses Mobiscroll with aria-label dates"
  │           - "Detected quirk: hidden duplicate elements across month panels"
  │           - "Confidence: high/medium/low" per finding
  │           - Flags anything that likely needs a hook
  │
  └── Phase 4: Generate Artifacts
        ├── src/resorts/<id>/descriptor.ts
        ├── src/resorts/<id>/hooks.ts         (only if quirks detected)
        ├── tests/mock-server/platforms/<id>/  (HTML/CSS/assets)
        ├── tests/mock-server/platforms/<id>/scenario-map.json
        └── Register in ResortRegistry
```

### 4.2 Human-in-the-Loop Checkpoints

1. **After Phase 3 (Report)** — "Here's what I found. Does this look right before I generate code?" Human validates availability interpretations, confirms quirk detection, decides if hooks are needed.

2. **After Phase 4 (Artifacts)** — Standard code review of generated descriptor, hooks, and mock assets.

### 4.3 Constraints & Authentication

- **Read-only observation** — never books anything
- **No bot detection bypass** — if it hits Turnstile/CAPTCHA, notes it in the report as a constraint
- **Resort-level artifacts only** — does not modify commands, engine, or other shared code

**Authentication handling:** Many parking sites (including most HONK portals) require login before showing the calendar. The agent handles this by:
1. Launching a **headed browser** so the operator can manually log in if prompted
2. Checking if the calendar page is accessible without auth first (some sites show calendars publicly)
3. If login is required, pausing with: "This site requires authentication. Please log in in the browser window, then press Enter to continue discovery."
4. After the operator logs in, the agent continues discovery with the authenticated session

The agent does **not** create accounts or store credentials. It uses the operator's existing session for the duration of discovery only.

### 4.4 Re-ingestion for Maintenance

Same skill, same URL. Detects existing resort in registry, re-runs discovery, diffs findings against current descriptor:

```
/ingest-resort https://reservenski.parkstevenspass.com
  → "Stevens Pass already registered. Re-running discovery..."
  → "Changes detected: calendar container selector changed from
     .mbsc-calendar to .mbsc-calendar-wrapper"
  → "Update descriptor? [Y/n]"
```

---

## Part 5: Config & CLI Changes

### 5.1 Config File

No structural changes. Flat `~/.ski-parker/config.json` stays as-is:

```json
{
  "resortUrl": "https://reservenski.parkstevenspass.com",
  "lotPreferences": ["Gold Lot"],
  "pollInterval": 60,
  "jitter": 20
}
```

`resortUrl` resolves through the registry. Unknown URLs produce a helpful error listing supported resorts.

### 5.2 New CLI Command

```
ski-parker resorts    # List supported resorts with URLs and platform info
```

All existing commands unchanged in interface. Internally they resolve resort via registry and use the engine.

### 5.3 Test Environment (`SKI_PARKER_BASE_URL`)

The existing `SKI_PARKER_BASE_URL` env var overrides the resort URL for e2e tests (pointing to the mock server at `localhost:3847`). In the new architecture, registry lookup must handle this:

- When `SKI_PARKER_BASE_URL` is set, the registry skips URL matching and instead uses a `platform` field from the scenario API response (or a `SKI_PARKER_PLATFORM` env var) to select the correct descriptor.
- This allows the mock server to serve HONK or Crystal HTML at the same localhost URL while the engine applies the correct descriptor.

### 5.4 Validation

On startup, `watch` and `auth` validate:
- `resortUrl` matches a registered resort (or clear error)
- `lotPreferences` only set if the resort supports lots (warn if not)

### 5.5 Unchanged

- All existing CLI flags (`--verbose`, `--notify`, `--sound`, `--headed`)
- Session management (`browser.ts`)
- Notification system (`notify.ts`)

---

## Part 6: Testing Strategy

### 6.1 Unit Tests

**Descriptors** — each descriptor produces correct selectors and availability rule matches:

```
tests/resorts/stevens-pass.test.ts
tests/resorts/crystal-mountain.test.ts
```

**Hooks** — tested in isolation. DOM hooks tested with minimal Playwright fixtures.

**Registry** — URL matching, lookup, error on unknown URL:

```
tests/resorts/registry.test.ts
```

**ScraperEngine** — tested against a mock page with a synthetic descriptor. Validates engine flow independent of any real resort:

```
tests/engine/scraper-engine.test.ts
```

### 6.2 E2e Tests

Per-platform scenarios using the multi-personality mock server:

```typescript
// tests/e2e/watch-honk.test.ts
await setScenarioViaApi({
  platform: 'honk',
  dates: { '2026-04-15': 'available' },
});

// tests/e2e/watch-crystal.test.ts
await setScenarioViaApi({
  platform: 'crystal',
  dates: { '2026-04-15': 'sold-out' },
});
```

### 6.3 Selector Validation Against Real Sites

`scripts/validate-selectors.ts` evolves to iterate registered resorts:

```
npx tsx scripts/validate-selectors.ts                   # all resorts
npx tsx scripts/validate-selectors.ts --resort crystal   # specific resort
```

Visits real site, confirms descriptor selectors still find elements, reports mismatches. Run periodically or in CI.

### 6.4 Test Migration

| Before | After |
|--------|-------|
| `tests/lib/selectors.test.ts` | `tests/resorts/stevens-pass.test.ts` |
| `tests/lib/constants.test.ts` | `tests/resorts/registry.test.ts` |
| `tests/e2e/watch.test.ts` | `tests/e2e/watch-honk.test.ts` |
| (new) | `tests/e2e/watch-crystal.test.ts` |
| (new) | `tests/engine/scraper-engine.test.ts` |

---

## Sequencing

1. **Adapter architecture** — descriptor types, registry, engine, HONK refactor
2. **Crystal Mountain adapter** — Crystal descriptor (from PR #13 reference), register
3. **Mock server evolution** — multi-personality serving, scenario map injection
4. **E2e tests** — HONK migration + Crystal tests
5. **Ingestion agent skill** — discovery, asset download, artifact generation
6. **CLI additions** — `ski-parker resorts` command, validation

Steps 1-4 are the adapter architecture. Step 5 is the ingestion agent. Step 6 is polish.
