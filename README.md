# ski-parker

Automated Stevens Pass parking reservation CLI using Playwright stealth.

## Installation

```bash
npm install
npm run build
npm link  # Makes 'ski-parker' available globally
```

## Quick Start

```bash
# 1. Authenticate (one-time setup)
ski-parker auth

# 2. Check availability
ski-parker check --date 2025-02-15

# 3. Watch for availability
ski-parker watch --date 2025-02-15 --type paid

# 4. Book immediately
ski-parker book --date 2025-02-15 --type paid --plate ABC1234
```

## Commands

### `ski-parker auth`
Opens a browser window for manual login to HONK. Saves session for future use.

### `ski-parker check`
Check availability for a specific date.
```bash
ski-parker check --date 2025-02-15 [--headed] [--verbose]
```

### `ski-parker watch`
Poll for availability until a spot opens.
```bash
ski-parker watch --date 2025-02-15 --type paid \
  [--interval 300] [--jitter 60] \
  [--auto-book --plate ABC1234] \
  [--no-notify] [--no-sound] \
  [--headed] [--dry-run] [--verbose]
```

### `ski-parker book`
Book a spot immediately if available.
```bash
ski-parker book --date 2025-02-15 --type paid --plate ABC1234 \
  [--headed] [--dry-run] [--verbose]
```

## Reservation Types

- `paid` - Standard paid parking ($20)
- `carpool` - Free carpool parking
- `ada` - ADA accessible parking

## Configuration

Config file: `~/.ski-parker/config.json`

```json
{
  "defaultPlate": "ABC1234",
  "defaultType": "paid",
  "pollInterval": 300,
  "jitter": 60
}
```

## Troubleshooting

### Session expired
Run `ski-parker auth` again to re-authenticate.

### Selectors not working
The HONK site may have changed. Update selectors in `src/lib/scraper.ts`.
