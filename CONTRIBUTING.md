# Contributing to ski-parker

Thanks for your interest in contributing to ski-parker!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/ignaciohermosillacornejo/skiparker.git
cd skiparker

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## Project Structure

```
src/
  commands/       # CLI command implementations
  lib/
    selectors.ts  # Pure selector functions (unit tested)
    scraper.ts    # Browser automation (e2e tested)
    config.ts     # Configuration management
    utils.ts      # Utility functions
tests/
  lib/            # Unit tests
  e2e/            # End-to-end tests
  mock-server/    # Mock HONK server for e2e
```

## Testing

We maintain high test coverage. Please include tests for any new functionality.

```bash
# Unit tests (fast, mocked)
npm test

# E2E tests (slower, uses mock server)
npm run test:e2e

# All tests with coverage
npm run test:coverage

# Validate selectors against real HONK sites
npx tsx scripts/validate-selectors.ts
```

## Code Style

- TypeScript strict mode is enabled
- Use meaningful variable and function names
- Keep functions small and focused
- Add JSDoc comments for public APIs

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes
4. Run tests (`npm test && npm run test:e2e`)
5. Commit with a descriptive message using conventional commits:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `test:` for test changes
   - `chore:` for maintenance
6. Push to your fork
7. Open a Pull Request

## Reporting Issues

When reporting bugs, please include:

- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Any error messages

## Adding Resort Support

ski-parker supports HONK-powered parking sites. To add a new resort:

1. Verify the site uses HONK (look for `honkmobile.com` in the URL or page source)
2. Test with the existing selectors using `--headed --verbose`
3. If selectors need adjustment, update `src/lib/selectors.ts`
4. Add the resort to the supported resorts table in README.md
5. Document any edge cases in `docs/honk-resorts-research.md`

## Questions?

Open an issue for any questions about contributing.
