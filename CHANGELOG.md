# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Cross-platform AYAB knitting UI (macOS, web, Android) built on Valdi
- Serial port discovery with Web Serial polyglot for browser
- Image loading, transforms, and DAK `.pat` import
- Zoomable preview viewport with machine bed visualization
- Knit progress, stitch selection, and simulation mode
- Preferences screen, settings modal, and hardware test mode
- Unit tests across all modules and Puppeteer E2E tests for web
- CI workflows for Bazel tests (macOS) and web E2E (Ubuntu)
- Contributor documentation (README, CONTRIBUTING, setup scripts)
- Pinned Valdi dependency SHAs for reproducible CI (`.github/valdi-deps.env`)

### Changed

- Refactored `App.tsx` into focused modules (`AppSidebar`, `AppKnitFooter`, `AppSessions`, `AppImageHandlers`, `AppImageLogic`)
- Scoped knit/hardware-test UI updates via `ValueNotifier` to avoid full-app re-renders
- Extracted image settings field controls and transform section components
- `HardwareTestModal` command buttons use a single `onCommand(token)` callback

## [0.1.0-dev] - 2026-07-04

Initial development release. Not yet tagged.

[Unreleased]: https://github.com/clholgat/ayab-valdi/compare/main...HEAD
[0.1.0-dev]: https://github.com/clholgat/ayab-valdi
