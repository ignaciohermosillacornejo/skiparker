# HONK Ski Parking Systems: Research & Edge Cases

> Research conducted January 2026. This document captures all known HONK ski resort implementations to inform architectural decisions.

## Overview

HONK powers parking reservations at **15 ski resorts** across North America (US and Canada only). All implementations share a common "Reserve 'N Ski" platform but vary significantly in pricing, lot structures, and booking rules.

**Geographic clusters:**
- Utah Wasatch canyons (5 resorts)
- California Lake Tahoe basin (4 resorts)
- Pacific Northwest Washington (3 resorts)
- Single implementations: Colorado, Vermont, British Columbia

---

## Complete Resort Table

| Resort | State | Portal URL | Standard Price | Carpool | Free After |
|--------|-------|------------|----------------|---------|------------|
| Stevens Pass | WA | reservenski.parkstevenspass.com | $20 | FREE (4+) | 10AM |
| Summit at Snoqualmie | WA | parking.honkmobile.com/hourly/zones/WA1403 | $55/$5 Ikon | FREE (3+) | 2PM |
| Crystal Mountain | WA | parking.honkmobile.com/hourly/zones/CRYSTAL | EV only | N/A | N/A |
| Northstar | CA | reservenski.parknorthstar.com | $20 | FREE (4+) | 12PM |
| Heavenly | CA/NV | reservenski.parkheavenly.com | $20 | FREE (4+) | 12PM |
| Kirkwood | CA | reservenski.parkkirkwood.com | $20 (Orange) | FREE (4+) | 11:30AM |
| Palisades Tahoe | CA | reservenski.parkpalisadestahoe.com | $30 adv / FREE Tue | FREE (4+) | 1PM |
| Breckenridge | CO | reservenski.breckpark.com | Variable | None | 3PM |
| Arapahoe Basin | CO | reservenski.parkabasin.com | $20/$40 Admin | FREE (4+) | 1PM |
| Park City Mountain | UT | reserve.parkatparkcitymountain.com | $29 surface | FREE (4+) | 12PM |
| Park City Garage | UT | reserve-garage.parkatparkcitymountain.com | $50 garage | None | 12PM |
| Solitude | UT | reservenski.parksolitude.com | Variable | FREE (4+) | 1PM |
| Brighton | UT | reservenski.parkbrightonresort.com | $20 | $10 (4+) | 12PM |
| Alta | UT | reserve.altaparking.com | $25 | FREE (pass) | 1PM |
| Stowe | VT | parking.honkmobile.com/hourly/zones/VT1101 | $30 | FREE (4+) | 2PM |
| Whistler Blackcomb | BC | reservenski.whistlerblackcombparking.com | FREE | FREE (4+) | 11AM |

---

## Booking Flow Variations

### 1. Standard Reserve 'N Ski (12 resorts)
Landing page → Date selection → Lot/option selection → HONK redirect → Login → Payment → Confirmation

**Resorts:** Stevens Pass, Northstar, Heavenly, Kirkwood, Palisades, Breckenridge, A-Basin, Park City, Solitude, Brighton, Alta, Whistler

### 2. Pay-on-Arrival (Stowe)
No advance booking. Users pay via QR code or kiosk on arrival. No "sold out" scenarios.

### 3. Hourly Zone System (Summit at Snoqualmie)
Standard hourly parking with kiosk-based day permits. Different from calendar-based Reserve 'N Ski flow.

### 4. EV Charging Only (Crystal Mountain)
Main parking uses SP+/ParkCrystal. HONK only for EV charging ($6/hr first 4 hours, $15/hr after).

---

## Lot Structure Variations

### Single Lot
Alta, Solitude, Heavenly - Simple flow, no lot selection step.

### Multi-Lot Same Type
Stevens Pass, Northstar - Multiple lots with same pricing/rules.

### Multi-Zone Color-Coded (Kirkwood)
- **Orange Zones** (15 lots): VIP, Village, Volcano, Chair lots - $20 paid or carpool
- **Blue Zones** (5 lots): Cross-Country, Inn Lot, Lower 7 - Free but reservation required

### Multi-Level Parkade (Whistler)
- Upper Lots 6, 7, 8 at Blackcomb Base II
- Creekside Parkade: P1 (carpool only), P2 (free), P3/P4 (FCFS)
- Municipal Day Lots 1-5 use PayByPhone (NOT HONK)

### Parallel Portal Systems (Park City)
- Surface lots: reserve.parkatparkcitymountain.com ($29)
- Garage: reserve-garage.parkatparkcitymountain.com ($50)
- Different URLs, different pricing, different carpool rules

---

## Reservation Type Variations

### Model 1: Paid Standard + Free Carpool (Most Common)
Stevens Pass, Northstar, Heavenly, Kirkwood, A-Basin, Solitude
- ~$20 for 1-3 occupants
- FREE for 4+ occupants (still requires reservation)

### Model 2: Free Reservations + Paid Advance
Palisades Tahoe
- Free reservations released Tuesdays 12PM and 7PM
- $30 advance reservations for guaranteed access
- Free sells out in 1-2 minutes

### Model 3: Tiered Pricing by Lot
- Park City: $29 surface vs $50 garage
- A-Basin: $20 standard vs $40 Admin lot
- Kirkwood: Orange (paid) vs Blue (free) zones

### Season Pass Holder Benefits
- Summit at Snoqualmie: FREE all season (2 vehicles)
- Brighton: Free reusable vouchers
- Alta: Free parking codes via email
- Solitude: 5 reservations (vs 3 for day passes)

---

## Carpool Threshold Variations

| Threshold | Resorts |
|-----------|---------|
| 3+ occupants | Summit at Snoqualmie |
| 4+ occupants | All others |
| 1 adult + 2 kids ≤12 | Stevens Pass (alternative) |

---

## Inventory Release Schedules

| Resort | Release Time | For |
|--------|--------------|-----|
| Palisades Tahoe | Tue 12PM & 7PM | Upcoming weekend |
| Solitude | Sun 6PM MST | Following week |
| Solitude | Daily 6AM | Day-of |
| Brighton | Monday | Upcoming weekend |
| Brighton | Day-prior 8AM & 2PM | Next day |
| Alta | Sun 3PM MST | Following weekend/holiday |
| A-Basin | Monday | Upcoming weekend |

---

## Account Limits (Max Active Reservations)

| Limit | Resorts |
|-------|---------|
| 2 | Whistler |
| 3 | Solitude (day pass) |
| 4 | A-Basin |
| 5 | Kirkwood, Northstar, Park City, Solitude (season pass) |
| 10 | Palisades Tahoe |

---

## Technical Considerations

### JavaScript-Rendered Pages
All reservenski.* portals are React/Angular SPAs requiring full browser rendering. Direct fetch calls return empty shells.

### Login Flow Quirk
HONK defaults to "Create Account" not "Login" after selecting a reservation. Automation must handle this.

### Payment Per-Resort
HONK treats each resort as separate payment entity. Same card must be added multiple times for multi-resort users.

### Phone Verification
Park City and A-Basin require phone verification. Accounts unused since November may trigger re-verification.

### Session Timeouts
High-demand releases (Palisades Tuesday) consistently crash HONK. Sessions may timeout during peak load.

### No Public API
HONK offers operator APIs but no public consumer endpoints. Web scraping is the only automation path.

---

## Enforcement & Penalties

### License Plate Verification
All implementations use LPR (License Plate Recognition). Reservations tied to plates at booking time.

### No-Show Penalties
- Palisades Tahoe: $100 initial, $200 after 10 days, season pass suspension
- Alta: $250 per violation ($125 if paid within 10 days)
- Brighton: May pause passholder benefits

### Carpool Verification
Manual in-person verification at lot entry. Attendant counts occupants. Cannot be automated.

---

## Architectural Implications

Based on this research, our abstractions must support:

1. **Multiple booking flows** - Standard, hourly, pay-on-arrival
2. **Config-driven reservation types** - Not hardcoded paid/carpool
3. **Variable carpool thresholds** - 3+ or 4+ depending on resort
4. **Multi-lot with zones** - Kirkwood Orange/Blue pattern
5. **Parallel portal systems** - Park City surface vs garage
6. **Per-resort account limits** - 2-10 reservations
7. **Time-based free parking** - After 10AM, 12PM, etc.
8. **Inventory release monitoring** - For high-demand Tuesday releases

---

## Resorts NOT Using HONK

- **Snowbird (UT):** ParkWhiz
- **Crystal Mountain (WA):** SP+/ParkCrystal (main parking)
- **Vail (CO):** VIP Parking Solutions
- **Winter Park (CO):** Free parking
- **Oregon resorts:** State Sno-Park permits
- **Most Northeast resorts:** No reservation systems

---

## References

- Research date: January 2026
- No documented cases of resorts switching away from HONK
- Platform appears to be gaining market share in ski industry
