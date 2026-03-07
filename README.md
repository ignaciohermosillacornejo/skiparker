# ski-parker

[![npm](https://img.shields.io/npm/v/ski-parker)](https://www.npmjs.com/package/ski-parker)
[![CI](https://github.com/ignaciohermosillacornejo/skiparker/actions/workflows/ci.yml/badge.svg)](https://github.com/ignaciohermosillacornejo/skiparker/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/ignaciohermosillacornejo/skiparker/graph/badge.svg?token=ef917b67-95c6-4703-b72c-b4938239a505)](https://codecov.io/gh/ignaciohermosillacornejo/skiparker)
![Beta](https://img.shields.io/badge/status-beta-yellow)

> **Beta Software**: This tool is under active development. Please report any issues using `ski-parker bug` or by [opening an issue](https://github.com/ignaciohermosillacornejo/skiparker/issues/new).

CLI tool that monitors ski resort parking availability on [HONK](https://parking.honkmobile.com/)-powered sites and notifies you when a spot opens up so you can book manually.

HONK is the parking reservation platform used by many ski resorts across North America. This tool watches the calendar for availability changes and sends desktop notifications when parking opens up.

## Supported Resorts

Validated against all 13 HONK Reserve 'N Ski portals:

| Resort | Location | URL | Type |
|--------|----------|-----|------|
| Stevens Pass | WA | reservenski.parkstevenspass.com | Single-lot |
| Northstar | CA | reservenski.parknorthstar.com | Multi-lot |
| Heavenly | CA/NV | reservenski.parkheavenly.com | Single-lot |
| Kirkwood | CA | reservenski.parkkirkwood.com | Single-lot |
| Palisades Tahoe | CA | reservenski.parkpalisadestahoe.com | Multi-lot |
| Breckenridge | CO | reservenski.breckpark.com | Multi-lot |
| A-Basin | CO | reservenski.parkabasin.com | Multi-lot |
| Park City Surface | UT | reserve.parkatparkcitymountain.com | Single-lot |
| Park City Garage | UT | reserve-garage.parkatparkcitymountain.com | Single-lot |
| Solitude | UT | reservenski.parksolitude.com | Single-lot |
| Brighton | UT | reservenski.parkbrightonresort.com | Single-lot |
| Alta | UT | reserve.altaparking.com | Single-lot |
| Whistler Blackcomb | BC | reservenski.whistlerblackcombparking.com | Multi-lot |

See [docs/honk-resorts-research.md](docs/honk-resorts-research.md) for detailed resort information including pricing, carpool rules, and edge cases.

## Installation

```bash
# Run directly with npx (no install needed)
npx ski-parker

# Or install globally
npm install -g ski-parker
```

## Quick Start

```bash
# 1. Configure your resort and lot preferences
ski-parker setup

# 2. Authenticate (one-time setup)
ski-parker auth

# 3. Watch for availability — get notified when a spot opens
ski-parker watch --date 2026-02-15
```

When a spot becomes available, you'll get a desktop notification. Then head to the resort's HONK site to book manually.

## Commands

### `ski-parker setup`
Interactive configuration for your resort URL and lot preferences.

### `ski-parker auth`
Opens a browser window for manual login to HONK. Saves session for future use.

### `ski-parker watch`
Monitor a date for parking availability. Sends a desktop notification when a spot opens.
```bash
ski-parker watch --date 2026-02-15 \
  [--lot "Zone A"] \
  [--interval 60] [--jitter 20] \
  [--no-notify] [--no-sound] \
  [--headed] [--verbose]
```

### `ski-parker bug`
Open a pre-filled GitHub issue to report a bug.
```bash
ski-parker bug              # Opens browser with issue form
ski-parker bug --no-open    # Prints URL instead
```

## Options

| Option | Description |
|--------|-------------|
| `-d, --date <date>` | Date to watch (YYYY-MM-DD) |
| `-l, --lot <lots...>` | Lot preference(s) for multi-lot resorts |
| `-i, --interval <sec>` | Poll interval in seconds (default: 60) |
| `-j, --jitter <sec>` | Random jitter added to interval (default: 20) |
| `--no-notify` | Disable desktop notifications |
| `--no-sound` | Disable sound notifications |
| `--headed` | Show browser window |
| `-v, --verbose` | Enable verbose logging |

## Multi-Lot Resorts

Some resorts (like Whistler) have multiple parking zones. Use `--lot` to specify your preference:

```bash
ski-parker watch --date 2026-02-15 --lot "CREEKSIDE" "UPPER LOTS"
```

The tool will check the preferred lot first.

## Configuration

Config file: `~/.ski-parker/config.json`

```json
{
  "resortUrl": "https://reservenski.parkstevenspass.com",
  "lotPreferences": ["CREEKSIDE", "UPPER LOTS"],
  "pollInterval": 60,
  "jitter": 20
}
```

## Troubleshooting

### Session expired
Run `ski-parker auth` again to re-authenticate.

### Selectors not working
The HONK site may have changed. Update selectors in `src/lib/scraper.ts`.

### Lot not found
Run `ski-parker setup` to discover available lots for your resort.

## Reporting Issues

Found a bug or have a feature request?

```bash
# Easiest way - opens browser with system info pre-filled
ski-parker bug
```

Or [open an issue](https://github.com/ignaciohermosillacornejo/skiparker/issues/new) directly on GitHub.

## Development

### Testing

```bash
# Unit tests
npm test

# E2E tests with mock HONK server
npm run test:e2e

# Validate selectors against all real HONK sites
npx tsx scripts/validate-selectors.ts
```

### Project Structure

```
src/
  lib/
    selectors.ts    # Pure selector functions (unit tested)
    scraper.ts      # Browser automation (e2e tested)
    config.ts       # Configuration management
    utils.ts        # Utility functions
tests/
  lib/              # Unit tests
  e2e/              # End-to-end tests
  mock-server/      # Mock HONK server for e2e
scripts/
  validate-selectors.ts  # Test selectors against real sites
```
