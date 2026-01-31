# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-30

### Added
- npm package publishing with OIDC provenance
- CI pipeline with automated testing and coverage reporting
- Codecov integration for coverage tracking
- Support for `SKI_PARKER_BASE_URL` environment variable for testing
- Session validation before operations
- Dynamic coverage badge in README
- Selector validation script for testing against real HONK sites
- E2E test suite with mock HONK server
- Multi-lot support with `--lot` CLI option
- Multi-resort support for all 13 HONK Reserve 'N Ski portals
- Setup command with config fallback for `--type` and `--plate`
- MIT license

### Changed
- Default poll interval changed to 60s with 20s jitter
- Improved CLI help and config resolution consistency
- Extracted pure functions for better testability (100% coverage on testable code)

### Fixed
- Strip trailing slashes from resort URL
- Auto-select lot on multi-lot sites
- Environment variable precedence for base URL
- Skip session requirement when running against mock server
- Distinguish no-reservation dates from sold-out status
- Validate `--date` format before launching browser
- Alta URL correction

## [0.1.0] - 2026-01-28

### Added
- Initial release
- Core commands: `setup`, `auth`, `check`, `watch`, `book`
- Support for paid and carpool reservation types
- Desktop notifications when spots become available
- Headless browser automation with stealth plugin
- Configuration file support (`~/.ski-parker/config.json`)
- Session persistence for HONK authentication
- Dry-run mode for testing without booking
- Verbose logging option

[0.2.0]: https://github.com/ignaciohermosillacornejo/skiparker/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ignaciohermosillacornejo/skiparker/releases/tag/v0.1.0
