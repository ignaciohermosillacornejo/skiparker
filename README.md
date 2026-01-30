# ski-parker

Automated CLI for booking ski resort parking on [HONK](https://parking.honkmobile.com/)-powered sites.

HONK is the parking reservation platform used by many ski resorts across North America. This tool automates the process of checking availability, watching for openings, and booking spots.

## Supported Resorts

Any ski resort using HONK for parking reservations should work. Configure the resort URL in your config file or via the `setup` command.

## Installation

```bash
npm install
npm run build
npm link  # Makes 'ski-parker' available globally
```

## Quick Start

```bash
# 1. Configure your resort and preferences
ski-parker setup

# 2. Authenticate (one-time setup)
ski-parker auth

# 3. Check availability
ski-parker check --date 2026-02-15

# 4. Watch for availability
ski-parker watch --date 2026-02-15 --type paid

# 5. Book immediately
ski-parker book --date 2026-02-15 --type paid --plate ABC1234
```

## Commands

### `ski-parker setup`
Interactive configuration for your resort URL, default plate, and reservation type.

### `ski-parker auth`
Opens a browser window for manual login to HONK. Saves session for future use.

### `ski-parker check`
Check availability for a specific date.
```bash
ski-parker check --date 2026-02-15 [--lot "Zone A"] [--headed] [--verbose]
```

### `ski-parker watch`
Poll for availability until a spot opens.
```bash
ski-parker watch --date 2026-02-15 --type paid \
  [--lot "Zone A"] \
  [--interval 300] [--jitter 60] \
  [--auto-book --plate ABC1234] \
  [--no-notify] [--no-sound] \
  [--headed] [--dry-run] [--verbose]
```

### `ski-parker book`
Book a spot immediately if available.
```bash
ski-parker book --date 2026-02-15 --type paid --plate ABC1234 \
  [--lot "Zone A"] \
  [--headed] [--dry-run] [--verbose]
```

## Options

| Option | Description |
|--------|-------------|
| `-d, --date <date>` | Date to check/book (YYYY-MM-DD) |
| `-t, --type <type>` | Reservation type: `paid` or `carpool` |
| `-l, --lot <lots...>` | Lot preference(s) for multi-lot resorts |
| `-p, --plate <plate>` | License plate number |
| `-i, --interval <sec>` | Poll interval in seconds (default: 300) |
| `-j, --jitter <sec>` | Random jitter added to interval (default: 60) |
| `--auto-book` | Automatically book when available |
| `--headed` | Show browser window |
| `--dry-run` | Stop before final confirmation |
| `-v, --verbose` | Enable verbose logging |

## Multi-Lot Resorts

Some resorts (like Whistler) have multiple parking zones. Use `--lot` to specify your preference:

```bash
ski-parker book --date 2026-02-15 --type paid --plate ABC1234 --lot "CREEKSIDE" "UPPER LOTS"
```

The tool will try lots in order until one has availability.

## Configuration

Config file: `~/.ski-parker/config.json`

```json
{
  "resortUrl": "https://parking.honkmobile.com/zones/stevens-pass",
  "defaultPlate": "ABC1234",
  "defaultType": "paid",
  "lotPreferences": ["CREEKSIDE", "UPPER LOTS"],
  "pollInterval": 300,
  "jitter": 60
}
```

## Troubleshooting

### Session expired
Run `ski-parker auth` again to re-authenticate.

### Selectors not working
The HONK site may have changed. Update selectors in `src/lib/scraper.ts`.

### Lot not found
Run `ski-parker setup` to discover available lots for your resort.
