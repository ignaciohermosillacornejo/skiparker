# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in ski-parker, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email the maintainer directly at: hello@ignaciohermosilla.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

You can expect:
- Acknowledgment within 48 hours
- Status update within 7 days
- Credit in the security advisory (unless you prefer to remain anonymous)

## Security Considerations

### Session Storage
- Authentication sessions are stored locally in `~/.ski-parker/session.json`
- This file contains cookies that grant access to your HONK account
- Keep this file secure and do not share it

### License Plate Data
- Your license plate is stored in `~/.ski-parker/config.json`
- This is stored in plaintext for CLI convenience
- The config directory should have user-only read permissions

### Browser Automation
- ski-parker uses Playwright with a stealth plugin
- No credentials are transmitted to third parties
- All automation happens locally on your machine
