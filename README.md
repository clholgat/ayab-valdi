# AYAB Valdi

[![Tests](https://github.com/clholgat/ayab-valdi/actions/workflows/tests.yml/badge.svg)](https://github.com/clholgat/ayab-valdi/actions/workflows/tests.yml)
[![E2E](https://github.com/clholgat/ayab-valdi/actions/workflows/e2e.yml/badge.svg)](https://github.com/clholgat/ayab-valdi/actions/workflows/e2e.yml)

An experimental cross-platform port of [ayab-desktop](https://github.com/AllYarnsAreBeautiful/ayab-desktop) built with [Valdi](https://github.com/Snapchat/Valdi). One TypeScript codebase targets **macOS**, **web** (via Web Serial), and **Android**. iOS is not supported because Apple restricts USB serial access.

## What is AYAB?

[AYAB](https://ayab-knitting.com/) (All Yarns Are Beautiful) is a hardware retrofit that lets you control vintage Brother knitting machines from a computer. This app implements the desktop side of the AYAB protocol: serial discovery, image loading, knit settings, and the knitting state machine.

This project is an **experimental port** — not an official AYAB release. For production knitting today, use [ayab-desktop](https://github.com/AllYarnsAreBeautiful/ayab-desktop).

## Features

- Serial port discovery (native + Web Serial in the browser)
- Image loading (PNG, JPG, BMP, GIF, TIFF) and DAK `.pat` import
- Image transforms (rotate, flip, invert, repeat)
- Knit settings (mode, colors, needles, alignment, inf repeat)
- Zoomable preview with machine bed visualization
- Knit progress and stitch selection
- Simulation mode for development without hardware
- Preferences and hardware test mode
- Broad unit and E2E test coverage

See [PORT_AUDIT_AND_PLAN.md](PORT_AUDIT_AND_PLAN.md) for parity details vs. ayab-desktop.

## Platform support

| Platform | Status | Notes |
|----------|--------|-------|
| **Web** | Supported | Web Serial API; run locally at `http://localhost:3030` |
| **macOS** | Supported | Native serial via IOKit |
| **Android** | Experimental | USB serial |
| **iOS** | Not supported | No USB serial access |

## Prerequisites

- **Bazelisk** — installed automatically by `valdi dev_setup`, or [install manually](https://github.com/bazelbuild/bazelisk)
- **Node.js 20+** — for the web dev server and E2E tests
- **Valdi CLI** — `npm install -g @snap/valdi` ([install guide](https://github.com/Snapchat/Valdi/blob/main/docs/INSTALL.md))
- **macOS only:** Xcode (for native macOS builds)
- **Android only:** Android SDK (installed by `valdi dev_setup`)

## Repository layout

All Valdi dependencies are **upstream tarballs at pinned SHAs** plus local patches in `src/patches/`:

- **`src/MODULE.bazel`** — `archive_override` for Valdi and Valdi_Widgets sources
- **`src/patches/`** — patches applied on top of those tarballs
- **Bazel registry** — fetched from the same Valdi pin by `./scripts/ensure-valdi-registry.sh` (cached in `src/.valdi-registry/`, not committed)

```
ayab-valdi/
└── src/                   # Bazel workspace root
    ├── MODULE.bazel       # upstream pins + archive_override
    └── patches/           # local patches on Valdi / Valdi_Widgets
```

## Quick start

### 1. Clone and install the Valdi toolchain

```bash
git clone https://github.com/clholgat/ayab-valdi.git
cd ayab-valdi

npm install -g @snap/valdi
valdi dev_setup
valdi doctor
```

### 2. Fetch the Bazel registry and sync

```bash
./scripts/ensure-valdi-registry.sh
cd src && valdi projectsync
```

### 3. Run

**Web** (easiest for development):

```bash
cd ayab-valdi/src/web
npm start
# Open http://localhost:3030
```

**macOS native:**

```bash
cd ayab-valdi/src
valdi install macos
```

**Android:**

```bash
cd ayab-valdi/src
valdi install android
```

**Hot reload** (after a native install):

```bash
cd ayab-valdi/src
valdi hotreload
```

## Running tests

All commands run from the `src/` directory (the Bazel workspace root).

```bash
cd ayab-valdi/src

# All module unit tests
bazel test //modules/serial:test \
  //modules/state_machine:test \
  //modules/ayab_valdi:test \
  //modules/preview:test \
  //modules/app_settings:test \
  //modules/image_settings:test \
  //modules/process_image:test \
  //modules/constants:test \
  --test_output=errors

# Or from the repo root:
./scripts/run-tests.sh

# Web E2E (Puppeteer)
cd web
npm ci
npm run e2e
```

CI runs these automatically on push and pull request.

### Valdi version pinning

Pinned SHAs live in [`.github/valdi-deps.env`](.github/valdi-deps.env) and [`src/MODULE.bazel`](src/MODULE.bazel). Local changes not yet upstream live in [`src/patches/`](src/patches/). After bumping pins, re-check patches apply, then run `./scripts/pin-valdi-deps.sh <valdi-sha> <widgets-sha>`. See [CONTRIBUTING.md](CONTRIBUTING.md#upgrading-valdi-dependencies).

## Project structure

```
ayab-valdi/
├── src/                       # Bazel workspace
│   ├── modules/
│   │   ├── ayab_valdi/        # Main app UI, knit/hardware-test sessions
│   │   ├── serial/            # Serial communication, Web Serial polyglot
│   │   ├── state_machine/     # AYAB protocol state machine
│   │   ├── preview/           # Image preview, transforms, zoom viewport
│   │   ├── image_settings/    # Knit settings UI
│   │   ├── app_settings/      # Preferences storage and screen
│   │   ├── process_image/     # Image loading, .pat/.stp/.cut import
│   │   └── constants/         # Shared types, tokens, UI theme
│   ├── patches/               # Local patches applied to upstream Valdi/Widgets
│   └── web/                   # Webpack dev server for ayab_web
├── scripts/                   # ensure-valdi-registry.sh, run-tests.sh, pin-valdi-deps.sh
├── .github/workflows/         # CI (tests + E2E)
├── PORT_AUDIT_AND_PLAN.md     # Feature parity vs ayab-desktop (living doc)
├── TDD_GAP_PLAN.md            # Test-driven gap closure plan (living doc)
└── CONTRIBUTING.md            # Dev setup, conventions, Valdi pin upgrades
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and pull requests are welcome.

## License

MIT — see [LICENSE](LICENSE).

## Links

- [ayab-desktop](https://github.com/AllYarnsAreBeautiful/ayab-desktop) — official AYAB desktop app
- [AYAB website](https://ayab-knitting.com/)
- [Valdi framework](https://github.com/Snapchat/Valdi)
- [Valdi Discord](https://discord.gg/uJyNEeYX2U)
