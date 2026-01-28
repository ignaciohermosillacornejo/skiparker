# E2E Mock Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a React mock of the HONK booking site served by Vite+Bun, with full visual and structural fidelity, enabling E2E tests against localhost.

**Architecture:** A Vite+React app in `tests/mock-server/` that replicates the HONK site's DOM using the exact CSS from saved fixtures. The CLI's `URLS.BASE` becomes configurable via env var. React components handle state transitions (calendar → rate cards → checkout → confirm/error). Tests configure scenarios via `window.__MOCK_SCENARIO`.

**Tech Stack:** Bun, Vite, React 19, TypeScript, Playwright (existing), Vitest (existing)

---

### Task 1: Scaffold Vite+React app with Bun

**Files:**
- Create: `tests/mock-server/package.json`
- Create: `tests/mock-server/tsconfig.json`
- Create: `tests/mock-server/vite.config.ts`
- Create: `tests/mock-server/index.html`
- Create: `tests/mock-server/src/main.tsx`
- Create: `tests/mock-server/src/App.tsx`

**Step 1: Create package.json**

```json
{
  "name": "ski-parker-mock",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

**Step 2: Install dependencies with Bun**

Run: `cd tests/mock-server && bun add react react-dom react-router-dom && bun add -d @types/react @types/react-dom @vitejs/plugin-react vite typescript`
Expected: Dependencies installed

**Step 3: Create vite.config.ts**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3847,
    strictPort: true,
  },
});
```

**Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

**Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HONK Mock</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**Step 6: Create main.tsx with router**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

**Step 7: Create placeholder App.tsx**

```tsx
import { Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<div>Home</div>} />
      <Route path="/select-parking" element={<div>Select Parking</div>} />
      <Route path="/checkout/:id" element={<div>Checkout</div>} />
      <Route path="/post-purchase" element={<div>Post Purchase</div>} />
    </Routes>
  );
}
```

**Step 8: Verify it runs**

Run: `cd tests/mock-server && bun run dev &`
Then: `curl -s http://localhost:3847/ | head -20`
Expected: HTML with `<div id="root">`

**Step 9: Commit**

```bash
git add tests/mock-server/
git commit -m "feat: scaffold Vite+React mock server with Bun"
```

---

### Task 2: Copy fixture CSS for visual fidelity

**Files:**
- Create: `tests/mock-server/public/css/stevens-pass.css` (from fixtures 1-3)
- Create: `tests/mock-server/public/css/honk-app.css` (from fixtures 4-7)
- Create: `tests/mock-server/public/css/honk-vendor.css` (from fixtures 4-7)
- Modify: `tests/mock-server/index.html`

**Step 1: Copy CSS files from fixtures**

```bash
cp "/Users/nach/Downloads/park/2/Select Parking _ HONK_files/main.ef711c55.css" tests/mock-server/public/css/stevens-pass.css
cp "/Users/nach/Downloads/park/5/Checkout _ HONK_files/app.c9faf83ff70b48de9bca.css" tests/mock-server/public/css/honk-app.css
cp "/Users/nach/Downloads/park/5/Checkout _ HONK_files/vendor.c9faf83ff70b48de9bca.css" tests/mock-server/public/css/honk-vendor.css
```

**Step 2: Add CSS links to index.html**

Add inside `<head>`:
```html
<link rel="stylesheet" href="/css/stevens-pass.css" />
<link rel="stylesheet" href="/css/honk-app.css" />
<link rel="stylesheet" href="/css/honk-vendor.css" />
```

**Step 3: Verify CSS loads**

Run: `curl -s http://localhost:3847/css/stevens-pass.css | wc -c`
Expected: ~626905 bytes

**Step 4: Commit**

```bash
git add tests/mock-server/public/css/ tests/mock-server/index.html
git commit -m "feat: add fixture CSS for visual fidelity"
```

---

### Task 3: Create scenario state management

**Files:**
- Create: `tests/mock-server/src/scenario.ts`

**Step 1: Create scenario types and state**

```ts
export type CheckoutOutcome = 'confirm' | 'overlap' | 'limit';

export interface MockScenario {
  /** Map of YYYY-MM-DD to 'available' | 'sold-out' | 'no-reservation' */
  dates: Record<string, 'available' | 'sold-out' | 'no-reservation'>;
  /** What happens after clicking Continue on checkout */
  checkoutOutcome: CheckoutOutcome;
  /** Plate number to display */
  plate: string;
  /** Number of existing bookings (for limit scenario) */
  bookingCount: number;
}

const DEFAULT_SCENARIO: MockScenario = {
  dates: {},
  checkoutOutcome: 'confirm',
  plate: 'CFH2637',
  bookingCount: 0,
};

declare global {
  interface Window {
    __MOCK_SCENARIO?: Partial<MockScenario>;
  }
}

export function getScenario(): MockScenario {
  return { ...DEFAULT_SCENARIO, ...(window.__MOCK_SCENARIO ?? {}) };
}

export function getDateStatus(dateStr: string): 'available' | 'sold-out' | 'no-reservation' {
  const scenario = getScenario();
  return scenario.dates[dateStr] ?? 'available';
}
```

**Step 2: Commit**

```bash
git add tests/mock-server/src/scenario.ts
git commit -m "feat: add scenario state management for mock server"
```

---

### Task 4: Build Calendar component

This is the most complex component. Must render Mobiscroll-compatible DOM with correct classes, aria-labels, and inline styles.

**Files:**
- Create: `tests/mock-server/src/components/Calendar.tsx`

**Step 1: Create Calendar component**

The CLI selects dates using: `.mbsc-calendar-day-text[aria-label="Saturday, February 14, 2026"]`
It checks availability via inline `style` attribute containing `rgba(49, 200, 25` (available) or `rgb(247, 205, 212)` (sold-out).
It navigates months via `.custom-next` and `.custom-prev`.

```tsx
import { useState } from 'react';
import { getDateStatus } from '../scenario';

interface CalendarProps {
  onDateSelect: (dateStr: string) => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatAriaLabel(year: number, month: number, day: number): string {
  const date = new Date(year, month, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const STYLE_AVAILABLE = { backgroundColor: 'rgba(49, 200, 25, 0.2)', color: 'rgb(0, 0, 0)' };
const STYLE_SOLD_OUT = { backgroundColor: 'rgb(247, 205, 212)', color: 'rgb(0, 0, 0)' };

export default function Calendar({ onDateSelect }: CalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  function handleDayClick(dateStr: string) {
    const status = getDateStatus(dateStr);
    if (status === 'available') {
      onDateSelect(dateStr);
    }
  }

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  return (
    <div className="mbsc-datepicker mbsc-flex-col mbsc-datepicker-inline mbsc-ios mbsc-datepicker-control-calendar">
      <div className="mbsc-calendar mbsc-ios mbsc-calendar-width-md">
        <div className="mbsc-calendar-wrapper">
          <div className="mbsc-calendar-header">
            <div className="mbsc-calendar-controls mbsc-flex mbsc-ios">
              <button className="custom-prev" onClick={prevMonth} type="button">&lt;</button>
              <div className="mbsc-calendar-title mbsc-ios">
                {MONTH_NAMES[month]} {year}
              </div>
              <button className="custom-next" onClick={nextMonth} type="button">&gt;</button>
            </div>
            <div className="mbsc-calendar-week-days mbsc-flex mbsc-ios">
              {DAY_NAMES.map((d, i) => (
                <div key={i} className="mbsc-calendar-week-day mbsc-flex-1-0-0 mbsc-ios">{d}</div>
              ))}
            </div>
          </div>
          <div className="mbsc-calendar-body">
            <div className="mbsc-calendar-body-inner mbsc-ios">
              <div className="mbsc-calendar-slide mbsc-flex-col mbsc-ios">
                <div className="mbsc-calendar-table mbsc-flex-col mbsc-flex-1-1 mbsc-ios">
                  {weeks.map((w, wi) => (
                    <div key={wi} className="mbsc-calendar-row mbsc-flex mbsc-ios">
                      {w.map((day, di) => {
                        if (day === null) {
                          return (
                            <div key={di} className="mbsc-calendar-cell mbsc-flex-1-0-0 mbsc-calendar-day mbsc-ios mbsc-ltr mbsc-calendar-day-empty">
                              <div className="mbsc-calendar-cell-inner mbsc-calendar-day-inner mbsc-ios">
                                <div className="mbsc-calendar-cell-text mbsc-calendar-day-text mbsc-ios"></div>
                              </div>
                            </div>
                          );
                        }

                        const dateStr = formatDateStr(year, month, day);
                        const status = getDateStatus(dateStr);
                        const ariaLabel = formatAriaLabel(year, month, day);

                        let dayStyle: React.CSSProperties = {};
                        if (status === 'available') dayStyle = STYLE_AVAILABLE;
                        else if (status === 'sold-out') dayStyle = STYLE_SOLD_OUT;

                        const isDisabled = status === 'no-reservation';

                        return (
                          <div
                            key={di}
                            className={`mbsc-calendar-cell mbsc-flex-1-0-0 mbsc-calendar-day mbsc-ios mbsc-ltr${isDisabled ? ' mbsc-disabled' : ''}`}
                          >
                            <div className="mbsc-calendar-cell-inner mbsc-calendar-day-inner mbsc-ios">
                              <div
                                aria-label={ariaLabel}
                                aria-pressed="false"
                                className="mbsc-calendar-cell-text mbsc-calendar-day-text mbsc-ios"
                                style={dayStyle}
                                role="button"
                                onClick={() => handleDayClick(dateStr)}
                              >
                                {day}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify it renders**

Temporarily render `<Calendar onDateSelect={console.log} />` in App.tsx and check browser at http://localhost:3847.

**Step 3: Commit**

```bash
git add tests/mock-server/src/components/Calendar.tsx
git commit -m "feat: add Calendar component with Mobiscroll-compatible DOM"
```

---

### Task 5: Build SelectParking page (fixtures 2+3)

**Files:**
- Create: `tests/mock-server/src/pages/SelectParking.tsx`
- Create: `tests/mock-server/src/components/RateCards.tsx`

**Step 1: Create RateCards component**

```tsx
import { useNavigate } from 'react-router-dom';

export default function RateCards() {
  const navigate = useNavigate();

  function handleCardClick(type: string) {
    navigate(`/checkout/${Date.now()}?type=${type}`);
  }

  return (
    <div className="SelectRate_wrapper__v6wva">
      <div className="SelectRate_card__AT83w" onClick={() => handleCardClick('carpool')}>
        <div className="SelectRate_rateCopy__yfcwz">
          <div>Carpool 4+ Arrival 7am - 10am, valid for all day parking</div>
        </div>
        <div className="SelectRate_priceArrowWrapper__lX7gS">
          <div className="SelectRate_ratePrice__r2+hE">$0</div>
        </div>
      </div>
      <div className="SelectRate_card__AT83w" onClick={() => handleCardClick('paid')}>
        <div className="SelectRate_rateCopy__yfcwz">
          <div>Advanced Paid Reservations 7am - 10am, valid for all day parking ($20 flat rate plus taxes &amp; fees)</div>
        </div>
        <div className="SelectRate_priceArrowWrapper__lX7gS">
          <div className="SelectRate_ratePrice__r2+hE">$23.41</div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create SelectParking page**

```tsx
import { useState } from 'react';
import Calendar from '../components/Calendar';
import RateCards from '../components/RateCards';

export default function SelectParking() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  function handleDateSelect(dateStr: string) {
    setSelectedDate(dateStr);
  }

  const formattedDate = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).toUpperCase()
    : null;

  return (
    <div className="d-flex flex-column h-100">
      <div className="flex-1 Layout_body__aaMuJ">
        <div className="h-100">
          <nav className="Nav_navbar__TXHws">
            <div className="Nav_leftButtonContainer__h-ayJ">
              <button type="button" className="Nav_leftButton__CgBNa">Back</button>
            </div>
            <a className="Nav_title__veio4" href="/">Park Stevens Pass</a>
            <div className="Nav_rightButtonContainer__cl3Yp">
              <a className="Nav_loginProfileLink__LO94z" href="/settings">
                <i className="bi-list Nav_hamburgerIcon__AToZp"></i>
              </a>
            </div>
          </nav>
          <div className="ParkingSelection_container__FGMbo">
            <div className="ParkingSelection_title__4oBPN">Reserve a parking spot</div>

            {/* 1. Location - always disabled/collapsed */}
            <div className="h-100">
              <div>
                <div className="ExpandableCard_titleBox__5k2mD ExpandableCard_disabled__w5wtI">
                  <div>
                    <div>1. Parking location</div>
                    <div className="ExpandableCard_subtitle__s0l-O">STEVENS PASS</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Date - shows calendar or selected date */}
            <div className="h-100">
              <div>
                <div className={`ExpandableCard_titleBox__5k2mD ${selectedDate ? 'ExpandableCard_disabled__w5wtI' : 'ExpandableCard_active__hfFDY'}`}>
                  <div>
                    <div>2. Date</div>
                    {formattedDate && (
                      <div className="ExpandableCard_subtitle__s0l-O">{formattedDate}</div>
                    )}
                  </div>
                  {selectedDate && (
                    <button
                      className="ExpandableCard_button__dLT0V"
                      type="button"
                      onClick={() => setSelectedDate(null)}
                    >
                      Change Date
                    </button>
                  )}
                </div>
                {!selectedDate && (
                  <div className="ExpandableCard_animatedContainer__wWkUk ExpandableCard_containerActive__4XZKA">
                    <Calendar onDateSelect={handleDateSelect} />
                    <div className="SelectDate_availability__IccV4">
                      <div className="SelectDate_available__FuxXF">Available</div>
                      <div className="SelectDate_soldOut__4YEX8">Sold out</div>
                      <div className="SelectDate_unavailable__buZj7">Unavailable</div>
                      <div className="SelectDate_noReservation__C7oHz">No reservation needed</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Prev/Next day buttons */}
            <div className="ParkingSelection_changeDay__432Cj">
              <button type="button">&lt; Previous Day</button>
              <button type="button">Next Day &gt;</button>
            </div>

            {/* 3. Parking rate - shows rate cards when date selected */}
            <div className="h-100">
              <div>
                <div className={`ExpandableCard_titleBox__5k2mD ${selectedDate ? 'ExpandableCard_active__hfFDY' : ''}`}>
                  <div>
                    <div>3. Parking rate</div>
                  </div>
                </div>
                {selectedDate && (
                  <div className="ExpandableCard_animatedContainer__wWkUk ExpandableCard_containerActive__4XZKA">
                    <RateCards />
                  </div>
                )}
              </div>
            </div>

            <div className="ParkingSelection_redeemCodeWrapper__tjsBv">
              Got a parking code?
              <a className="ParkingSelection_redeemCodeLink__-b3s4" href="/code">Redeem your code</a>
            </div>
          </div>
        </div>
      </div>
      <footer className="Footer_footer__HSC7C">
        <div className="d-flex flex-column align-items-center">
          <span>Powered by HONK</span>
        </div>
      </footer>
    </div>
  );
}
```

**Step 3: Wire into App.tsx**

Replace the placeholder route:
```tsx
import SelectParking from './pages/SelectParking';
// ...
<Route path="/select-parking" element={<SelectParking />} />
```

**Step 4: Verify in browser**

Open http://localhost:3847/select-parking, click a date, verify rate cards appear.

**Step 5: Commit**

```bash
git add tests/mock-server/src/pages/SelectParking.tsx tests/mock-server/src/components/RateCards.tsx tests/mock-server/src/App.tsx
git commit -m "feat: add SelectParking page with calendar and rate cards"
```

---

### Task 6: Build Checkout page (fixtures 4-7)

**Files:**
- Create: `tests/mock-server/src/pages/Checkout.tsx`
- Create: `tests/mock-server/src/components/ConfirmModal.tsx`
- Create: `tests/mock-server/src/components/ConflictModal.tsx`
- Create: `tests/mock-server/src/components/ErrorPage.tsx`

**Step 1: Create ConfirmModal (fixture 5)**

```tsx
import { useNavigate } from 'react-router-dom';
import { getScenario } from '../scenario';

interface Props {
  onClose: () => void;
}

export default function ConfirmModal({ onClose }: Props) {
  const navigate = useNavigate();
  const scenario = getScenario();

  function handleConfirm() {
    navigate('/post-purchase');
  }

  return (
    <div className="ui page modals dimmer transition visible active" style={{ display: 'flex' }}>
      <div className="ui modal transition visible active ui modal small PurchaseConfirm basic ModalWithClose">
        <div role="dialog" aria-modal="true" aria-labelledby="purchaseConfirm-title">
          <div className="ModalWithClose--listFrame ui segment" role="dialog" aria-modal="true" aria-labelledby="purchaseConfirm-title">
            <button className="PlainButton--noStyle ModalWithClose--iconWrapper" type="button" aria-label="Close dialog" onClick={onClose}>
              <img alt="Close dialog" aria-hidden="true" className="ModalWithClose--closeIcon PurchaseConfirm" />
            </button>
            <div className="PurchaseConfirm--content">
              <h1 id="purchaseConfirm-title" className="PurchaseConfirm--header">Does this look right?</h1>
              <div className="Plate">
                <div className="Plate--decoration"><span></span><span></span></div>
                <div className="Plate--number">
                  <h4>Plate #</h4>
                  <h1>{scenario.plate}</h1>
                </div>
                <div className="Plate--decoration"><span></span><span></span></div>
              </div>
              <div className="PurchaseConfirm--detailsRow">Stevens Pass (Zone STEVENSPASS)</div>
              <div className="PurchaseConfirm--detailsRow">Park until Feb 14/26 at 10:05 AM</div>
            </div>
            <button className="oGMkMQAoYbD7f3oxRBJI ButtonComponent" type="button" onClick={handleConfirm}>Confirm</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create ConflictModal (fixture 7)**

```tsx
interface Props {
  onGoBack: () => void;
}

export default function ConflictModal({ onGoBack }: Props) {
  return (
    <div className="ui page modals dimmer transition visible active" style={{ display: 'flex' }}>
      <div className="ui modal transition visible active ui modal small ConflictConfirm">
        <div role="dialog" aria-modal="true" aria-labelledby="conflictConfirmModal-title">
          <div className="ConflictConfirm--content">
            <span id="conflictConfirmModal-title" aria-hidden="true" className="ConflictConfirm--content sr-only">
              Parking Session Overlap Detected
            </span>
            <h1 className="ConflictConfirm--header">
              This session overlaps the following previously-purchased session:
            </h1>
            <div className="ConflictConfirm-parkingSessionsList">
              <div>
                <div className="CommonParkingSessionDetails--panel ui segment">
                  <div className="CommonParkingSessionDetails--container">
                    <div className="CommonParkingSessionDetails--main">
                      <div className="CommonParkingSessionDetails--location">
                        <div className="CommonParkingSessionDetails--zoneId">Zone STEVENSPASS</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="ConflictConfirm--buttons">
              <button className="PlainButton--noStyle ui button fluid ConflictConfirm--button" type="button" aria-label="Exit parking conflict confirmation" onClick={onGoBack}>
                Go Back
              </button>
              <button className="PlainButton--noStyle ui button fluid ConflictConfirm--button ConflictConfirm--continue" type="button" aria-label="Continue with purchase">
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create ErrorPage (fixture 6)**

```tsx
export default function ErrorPage() {
  return (
    <div className="TransactionProcessing">
      <div className="TransactionProcessing--wrapper">
        <div className="TransactionProcessing--errorBox">
          <div className="TransactionProcessing--content">
            <img src="" alt="" />
            <div className="TransactionProcessing--errorCopy">
              You've reached the reservation limit for this account and/or plate number.
            </div>
          </div>
        </div>
      </div>
      <div className="TransactionProcessing--checkoutLink">Back to Checkout</div>
    </div>
  );
}
```

**Step 4: Create Checkout page**

```tsx
import { useState } from 'react';
import { getScenario } from '../scenario';
import ConfirmModal from '../components/ConfirmModal';
import ConflictModal from '../components/ConflictModal';
import ErrorPage from '../components/ErrorPage';

export default function Checkout() {
  const scenario = getScenario();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showModal, setShowModal] = useState<'confirm' | 'overlap' | 'limit' | null>(null);

  function handleContinue() {
    setShowModal(scenario.checkoutOutcome);
  }

  if (showModal === 'limit') {
    return <ErrorPage />;
  }

  return (
    <>
      <div className="CheckoutRoute">
        <div className="CheckoutZoneDetails">
          <h2 className="CheckoutZoneDetails--address">Stevens Pass, Stevens Pass, WA</h2>
          Zone STEVENSPASS
        </div>
        <div className="CheckoutRoute--operatorBanner center">
          <p>Operated by Stevens Pass</p>
        </div>
        <div className="ui padded centered grid">
          <div className="CheckoutRoute--container eight wide computer sixteen wide mobile column">
            <div className="ui basic segment CheckoutRoute--purchaseSummary">
              <button className="PlainButton--noStyle CheckoutSummaryItem" type="button" aria-label="Edit vehicle">
                <div className="CheckoutSummaryItem--left">
                  <div className="CheckoutSummaryItem--image"></div>
                  <div className="CheckoutSummaryItem--copyBlock">
                    <div className="CheckoutSummaryItem--label">Plate Number</div>
                    <div className="CheckoutSummaryItem--content">
                      <div className="CheckoutVehicleComponent--plate">{scenario.plate}</div>
                    </div>
                  </div>
                </div>
              </button>
              <div>
                <div className="CheckoutSummaryItem">
                  <div className="CheckoutSummaryItem--left">
                    <div className="CheckoutSummaryItem--copyBlock">
                      <div className="CheckoutSummaryItem--label">Start</div>
                      <div className="CheckoutSummaryItem--content">
                        <div className="DateTimeDisplayComponent--dateContent">
                          Sat Feb 14, 2026 (<span className="DateTimeDisplayComponent--timeContent">6:00AM </span>PST)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="CheckoutSummaryItem">
                  <div className="CheckoutSummaryItem--left">
                    <div className="CheckoutSummaryItem--copyBlock">
                      <div className="CheckoutSummaryItem--label">End</div>
                      <div className="CheckoutSummaryItem--content">
                        <div className="DateTimeDisplayComponent--dateContent">
                          Sat Feb 14, 2026 (<span className="DateTimeDisplayComponent--timeContent">10:05AM </span>PST)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <hr className="CheckoutRoute--rule" />
            <div className="CheckoutPriceBreakdown">
              <div className="CheckoutPriceBreakdown--row">
                <div>Parking<span>(Tax Incl)</span></div>
                <div>$0.00</div>
              </div>
              <div className="CheckoutPriceBreakdown--row">
                <div>Service Fee</div>
                <div>$0.00</div>
              </div>
              <div className="CheckoutPriceBreakdown--row">
                <div className="CheckoutPriceBreakdown--total">Total</div>
                <div className="CheckoutPriceBreakdown--total">$0.00</div>
              </div>
            </div>
            <div className="AcceptTermsCheckBox--wrapper">
              <div className="AcceptTermsCheckBox--inner-wrapper text">
                <p>This parking location requires a credit card to secure this reservation. All credit card information will be processed securely. No-shows may be subject to a charge of $50 per reservation. <a href="#">Terms and Conditions</a></p>
              </div>
              <hr />
              <div className="AcceptTermsCheckBox--inner-wrapper">
                <div className="CheckboxComponent field">
                  <div className="ui checkbox">
                    <input
                      id="terms"
                      className="CheckboxComponent--input"
                      name="terms"
                      aria-label="Accept terms and conditions checkbox"
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                    />
                    <label htmlFor="terms" className="CheckboxComponent--label">
                      <div className="AcceptTermsCheckBox--label">
                        <span>I accept Terms and Conditions</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <button className="PlainButton--noStyle SelectPaymentMethodButton--wrapper" type="button">
              <div className="dimmable">
                <div className="SelectPaymentMethodButton--container">
                  <div className="SelectPaymentMethodButton--body">Pay with Visa 5559</div>
                </div>
              </div>
            </button>
            <button
              className={`PlainButton--noStyle CtaButton--container CtaButton--container__shadow${termsAccepted ? '' : ' CtaButton--container__disabled'}`}
              type="button"
              onClick={termsAccepted ? handleContinue : undefined}
            >
              <div className="ui basic center aligned segment">
                <div className="ui inverted loader"></div>
                <div>Continue</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {showModal === 'confirm' && (
        <ConfirmModal onClose={() => setShowModal(null)} />
      )}
      {showModal === 'overlap' && (
        <ConflictModal onGoBack={() => setShowModal(null)} />
      )}
    </>
  );
}
```

**Step 5: Wire into App.tsx**

```tsx
import Checkout from './pages/Checkout';
// ...
<Route path="/checkout/:id" element={<Checkout />} />
```

**Step 6: Verify in browser**

Navigate through full flow: `/select-parking` → click date → click rate card → checkout page renders.

**Step 7: Commit**

```bash
git add tests/mock-server/src/pages/Checkout.tsx tests/mock-server/src/components/
git commit -m "feat: add Checkout page with confirm, conflict, and error modals"
```

---

### Task 7: Build Home and PostPurchase pages

**Files:**
- Create: `tests/mock-server/src/pages/Home.tsx`
- Create: `tests/mock-server/src/pages/PostPurchase.tsx`
- Modify: `tests/mock-server/src/App.tsx`

**Step 1: Create Home page (fixture 1)**

```tsx
export default function Home() {
  return (
    <div className="d-flex flex-column h-100">
      <div className="flex-1 Layout_body__aaMuJ">
        <div className="Home_container__MjOfV">
          <nav className="Nav_navbar__TXHws">
            <div className="Nav_leftButtonContainer__h-ayJ"></div>
            <a className="Nav_title__veio4" href="/">Park Stevens Pass</a>
            <div className="Nav_rightButtonContainer__cl3Yp">
              <a className="Nav_loginProfileLink__LO94z" href="/settings">
                <i className="bi-list Nav_hamburgerIcon__AToZp"></i>
              </a>
            </div>
          </nav>
          <div className="Home_headline__5RAL9">
            <div className="Home_text__2cS-W">Reserve Parking Before Arriving</div>
          </div>
          <div className="container-sm">
            <div className="row justify-content-center">
              <div className="col-md-8 col-xl-6">
                <div className="Home_cardsContainer__rPYfW">
                  <div className="Home_cardWrapper__Twt3k">
                    <a className="text-decoration-none" href="/select-parking">
                      <div className="Card_card__rnNS7">
                        <div className="Home_cardBody__Mv7DP">
                          <div className="Home_cardHeader__KgMtL">
                            <div className="Home_headerText__8rxXz">Reserve a Parking Spot</div>
                          </div>
                        </div>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create PostPurchase page**

```tsx
export default function PostPurchase() {
  return (
    <div>
      <h1>Booking Confirmed</h1>
      <p>Your parking reservation has been confirmed.</p>
    </div>
  );
}
```

**Step 3: Wire all routes into App.tsx**

```tsx
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import SelectParking from './pages/SelectParking';
import Checkout from './pages/Checkout';
import PostPurchase from './pages/PostPurchase';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/select-parking" element={<SelectParking />} />
      <Route path="/checkout/:id" element={<Checkout />} />
      <Route path="/post-purchase" element={<PostPurchase />} />
    </Routes>
  );
}
```

**Step 4: Verify full flow in browser**

Open http://localhost:3847/, click "Reserve a Parking Spot", select date, click rate card, see checkout.

**Step 5: Commit**

```bash
git add tests/mock-server/src/
git commit -m "feat: add Home and PostPurchase pages, complete routing"
```

---

### Task 8: Make CLI base URL configurable

**Files:**
- Modify: `src/constants.ts`
- Modify: `src/lib/scraper.ts`

**Step 1: Add env var override to constants.ts**

Replace the URLS object:

```ts
const BASE = process.env.SKI_PARKER_BASE_URL || 'https://reservenski.parkstevenspass.com';

export const URLS = {
  BASE,
  LOGIN: `${BASE}/login`,
  PROMO: `${BASE}/code`,
} as const;
```

**Step 2: Update scraper to use BASE for checkout wait**

In `scraper.ts`, the `bookSpot` function waits for `.CheckoutRoute` after clicking a rate card. Since the checkout is now on the same domain (localhost), the existing `page.waitForSelector(SELECTORS.checkoutContainer)` should work without changes. But the `page.waitForURL('**/post-purchase**')` also needs to work — verify that the glob pattern matches `http://localhost:3847/post-purchase`.

The `**/post-purchase**` glob should match any URL containing `/post-purchase` — no changes needed.

**Step 3: Build and verify**

Run: `npm run build`
Run: `SKI_PARKER_BASE_URL=http://localhost:3847 node dist/index.js check --date 2026-02-14 --verbose --headed`
Expected: CLI navigates to localhost mock server

**Step 4: Commit**

```bash
git add src/constants.ts
git commit -m "feat: make base URL configurable via SKI_PARKER_BASE_URL env var"
```

---

### Task 9: Write E2E test helpers

**Files:**
- Create: `tests/e2e/helpers.ts`

**Step 1: Create test helper for starting/stopping mock server**

```ts
import { type ChildProcess, spawn } from 'node:child_process';
import { chromium, type BrowserContext, type Page } from 'playwright';
import path from 'node:path';

const MOCK_PORT = 3847;
const MOCK_URL = `http://localhost:${MOCK_PORT}`;
const MOCK_DIR = path.join(import.meta.dirname, '../mock-server');

let mockProcess: ChildProcess | null = null;

export async function startMockServer(): Promise<void> {
  mockProcess = spawn('bun', ['run', 'dev'], {
    cwd: MOCK_DIR,
    stdio: 'pipe',
    env: { ...process.env },
  });

  // Wait for server to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Mock server did not start')), 15000);
    mockProcess!.stdout?.on('data', (data: Buffer) => {
      if (data.toString().includes('localhost')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    mockProcess!.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export function stopMockServer(): void {
  if (mockProcess) {
    mockProcess.kill();
    mockProcess = null;
  }
}

export function getMockUrl(): string {
  return MOCK_URL;
}

export interface TestContext {
  context: BrowserContext;
  page: Page;
}

export async function createTestBrowser(headed = false): Promise<TestContext> {
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  return { context, page };
}

export async function setScenario(page: Page, scenario: Record<string, unknown>): Promise<void> {
  await page.evaluate((s) => {
    (window as any).__MOCK_SCENARIO = s;
  }, scenario);
}
```

**Step 2: Commit**

```bash
git add tests/e2e/helpers.ts
git commit -m "feat: add E2E test helpers for mock server lifecycle"
```

---

### Task 10: Write E2E tests for check command

**Files:**
- Create: `tests/e2e/check.test.ts`

**Step 1: Create check command E2E tests**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { startMockServer, stopMockServer, getMockUrl } from './helpers';

const CLI = 'node dist/index.js';

function runCli(args: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`${CLI} ${args}`, {
      env: { ...process.env, SKI_PARKER_BASE_URL: getMockUrl() },
      encoding: 'utf-8',
      timeout: 30000,
    });
    return { stdout, exitCode: 0 };
  } catch (e: any) {
    return { stdout: e.stdout ?? '', exitCode: e.status ?? 1 };
  }
}

describe('check command', () => {
  beforeAll(async () => {
    await startMockServer();
  }, 20000);

  afterAll(() => {
    stopMockServer();
  });

  it('shows available types for an available date', () => {
    // Default scenario: all dates available
    const { stdout, exitCode } = runCli('check --date 2026-02-14 --verbose');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Available');
  });

  it('rejects a past date before launching browser', () => {
    const { stdout, exitCode } = runCli('check --date 2020-01-01');
    expect(exitCode).toBe(1);
    expect(stdout).toContain('in the past');
  });

  it('rejects invalid date format', () => {
    const { stdout, exitCode } = runCli('check --date 2026-0214');
    expect(exitCode).toBe(1);
    expect(stdout).toContain('Invalid date format');
  });
});
```

Note: For tests that need specific scenarios (sold-out, no-reservation), the CLI currently doesn't set `window.__MOCK_SCENARIO` because it uses its own Playwright browser. We need the mock server to also accept scenario configuration via an HTTP API endpoint. Add a `/api/scenario` route (Task 11 addresses this).

**Step 2: Commit**

```bash
git add tests/e2e/check.test.ts
git commit -m "test: add E2E tests for check command"
```

---

### Task 11: Add HTTP scenario API to mock server

Since the CLI spawns its own Playwright browser (not the test's browser), tests can't use `page.evaluate()` to set scenarios. Instead, add a simple API endpoint.

**Files:**
- Modify: `tests/mock-server/src/scenario.ts`
- Modify: `tests/mock-server/vite.config.ts`
- Create: `tests/mock-server/src/api-server.ts` (or use Vite middleware)

**Step 1: Add scenario API via Vite plugin**

Modify `vite.config.ts`:

```ts
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function scenarioApi(): Plugin {
  let currentScenario: Record<string, unknown> = {};

  return {
    name: 'scenario-api',
    configureServer(server) {
      server.middlewares.use('/api/scenario', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            currentScenario = JSON.parse(body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          });
        } else if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(currentScenario));
        } else {
          res.writeHead(405);
          res.end();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), scenarioApi()],
  server: {
    port: 3847,
    strictPort: true,
  },
});
```

**Step 2: Update scenario.ts to fetch from API**

Replace the `window.__MOCK_SCENARIO` approach with fetching from the API on page load:

```ts
export type CheckoutOutcome = 'confirm' | 'overlap' | 'limit';

export interface MockScenario {
  dates: Record<string, 'available' | 'sold-out' | 'no-reservation'>;
  checkoutOutcome: CheckoutOutcome;
  plate: string;
  bookingCount: number;
}

const DEFAULT_SCENARIO: MockScenario = {
  dates: {},
  checkoutOutcome: 'confirm',
  plate: 'CFH2637',
  bookingCount: 0,
};

let cachedScenario: MockScenario | null = null;

export async function fetchScenario(): Promise<MockScenario> {
  try {
    const res = await fetch('/api/scenario');
    const data = await res.json();
    cachedScenario = { ...DEFAULT_SCENARIO, ...data };
  } catch {
    cachedScenario = DEFAULT_SCENARIO;
  }
  return cachedScenario;
}

export function getScenario(): MockScenario {
  return cachedScenario ?? DEFAULT_SCENARIO;
}

export function getDateStatus(dateStr: string): 'available' | 'sold-out' | 'no-reservation' {
  const scenario = getScenario();
  return scenario.dates[dateStr] ?? 'available';
}
```

**Step 3: Call fetchScenario on page load in App.tsx**

```tsx
import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { fetchScenario } from './scenario';
import Home from './pages/Home';
import SelectParking from './pages/SelectParking';
import Checkout from './pages/Checkout';
import PostPurchase from './pages/PostPurchase';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchScenario().then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/select-parking" element={<SelectParking />} />
      <Route path="/checkout/:id" element={<Checkout />} />
      <Route path="/post-purchase" element={<PostPurchase />} />
    </Routes>
  );
}
```

**Step 4: Update test helper**

Add to `helpers.ts`:

```ts
export async function setScenarioViaApi(scenario: Record<string, unknown>): Promise<void> {
  await fetch(`${MOCK_URL}/api/scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
  });
}
```

**Step 5: Commit**

```bash
git add tests/mock-server/vite.config.ts tests/mock-server/src/scenario.ts tests/mock-server/src/App.tsx tests/e2e/helpers.ts
git commit -m "feat: add HTTP scenario API for E2E test configuration"
```

---

### Task 12: Write E2E tests for book command

**Files:**
- Create: `tests/e2e/book.test.ts`

**Step 1: Create book command E2E tests**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import { startMockServer, stopMockServer, getMockUrl, setScenarioViaApi } from './helpers';

const CLI = 'node dist/index.js';

function runCli(args: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`${CLI} ${args}`, {
      env: { ...process.env, SKI_PARKER_BASE_URL: getMockUrl() },
      encoding: 'utf-8',
      timeout: 60000,
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (e: any) {
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: e.status ?? 1 };
  }
}

describe('book command', () => {
  beforeAll(async () => {
    await startMockServer();
  }, 20000);

  afterAll(() => {
    stopMockServer();
  });

  beforeEach(async () => {
    // Reset scenario to defaults
    await setScenarioViaApi({});
  });

  it('books successfully with confirm modal', async () => {
    await setScenarioViaApi({
      dates: { '2026-02-14': 'available' },
      checkoutOutcome: 'confirm',
    });

    const { stdout, exitCode } = runCli('book --date 2026-02-14 --type carpool --plate CFH2637 --verbose');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Booking successful');
  });

  it('reports overlap error', async () => {
    await setScenarioViaApi({
      dates: { '2026-02-14': 'available' },
      checkoutOutcome: 'overlap',
    });

    const { stdout, exitCode } = runCli('book --date 2026-02-14 --type carpool --plate CFH2637 --verbose');
    expect(exitCode).toBe(1);
    expect(stdout).toContain('overlap');
  });

  it('reports reservation limit error', async () => {
    await setScenarioViaApi({
      dates: { '2026-02-14': 'available' },
      checkoutOutcome: 'limit',
    });

    const { stdout, exitCode } = runCli('book --date 2026-02-14 --type carpool --plate CFH2637 --verbose');
    expect(exitCode).toBe(1);
    expect(stdout).toContain('reservation limit');
  });

  it('dry run stops before confirmation', async () => {
    await setScenarioViaApi({
      dates: { '2026-02-14': 'available' },
    });

    const { stdout, exitCode } = runCli('book --date 2026-02-14 --type carpool --plate CFH2637 --dry-run --verbose');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Dry run');
    expect(stdout).toContain('DRY-RUN');
  });
});
```

**Step 2: Commit**

```bash
git add tests/e2e/book.test.ts
git commit -m "test: add E2E tests for book command"
```

---

### Task 13: Run all E2E tests and fix issues

**Step 1: Build the CLI**

Run: `npm run build`

**Step 2: Start mock server and run tests**

Run: `npx vitest run tests/e2e/ --timeout 60000`

**Step 3: Debug and fix any selector mismatches**

Compare CLI verbose output against mock server DOM. Fix any class names, aria-labels, or structural issues.

**Step 4: Verify all tests pass**

Run: `npx vitest run tests/e2e/ --timeout 60000`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "test: all E2E tests passing against mock server"
```
