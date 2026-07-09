# Contributing to AYAB Valdi

Thank you for your interest in contributing! This project is an experimental port of [ayab-desktop](https://github.com/AllYarnsAreBeautiful/ayab-desktop) to [Valdi](https://github.com/Snapchat/Valdi).

## Before you start

1. Read the [README](README.md) for setup instructions.
2. Run `valdi doctor` to verify your toolchain.
3. Check [PORT_AUDIT_AND_PLAN.md](PORT_AUDIT_AND_PLAN.md) for known gaps vs. ayab-desktop.

## Development setup

```bash
git clone https://github.com/clholgat/ayab-valdi.git
cd ayab-valdi

npm install -g @snap/valdi
valdi dev_setup

./scripts/ensure-valdi-registry.sh
cd src && valdi projectsync
```

All Bazel commands run from the `src/` directory.

## Running tests

```bash
cd src

# Single module
bazel test //modules/serial:test --test_output=errors

# All modules (same as CI)
bazel test //modules/serial:test \
  //modules/state_machine:test \
  //modules/ayab_valdi:test \
  //modules/preview:test \
  //modules/app_settings:test \
  //modules/image_settings:test \
  //modules/process_image:test \
  //modules/constants:test \
  --test_output=errors

# Or use the helper script from the repo root:
# ../scripts/run-tests.sh

# Web E2E
cd web && npm ci && npm run e2e
```

Tests must pass before merging. CI runs on macOS (unit tests) and Ubuntu (web E2E).

## Code conventions

This is a **Valdi** app, not React. Follow these patterns:

### Components

- Use `StatefulComponent` when the component has local state; use `Component` for prop-only shells.
- Lifecycle methods: `onCreate`, `onViewModelUpdate`, `onDestroy` — not `onMount`/`onUnmount`.
- Access props via `this.viewModel`, not `this.props`.
- `onRender()` returns void; JSX is a statement, not a return value.

### Callbacks and performance

- Use **class arrow functions** for callbacks passed to children (`handleKnit = () => { ... }`).
- Avoid creating inline lambdas in `onRender()` for handlers passed to child components.
- Pre-compute derived viewModels in `onViewModelUpdate`, not in `onRender()`.

### Logic extraction

- Keep session orchestration out of UI (`KnitSession.ts`, `HardwareTestSession.ts`, `AppSessions.ts`).
- Extract pure image/repeat logic into `*Logic.ts` / `AppImageHandlers.ts` with unit tests.

### Async safety

- Guard async callbacks with `this.isDestroyed()` before calling `setState()`.
- Cancel in-flight work in `onDestroy()`.

### Styling

- Use module-level `Style` objects where possible.
- Use `<layout>` for structural containers.

See [AGENTS.md](AGENTS.md) and [src/AGENTS.md](src/AGENTS.md) for more Valdi-specific guidance.

For feature parity status and remaining gaps, see [PORT_AUDIT_AND_PLAN.md](PORT_AUDIT_AND_PLAN.md) and [TDD_GAP_PLAN.md](TDD_GAP_PLAN.md).

## Pull request guidelines

1. **One logical change per PR** — easier to review and bisect.
2. **Include tests** for new behavior. Port desktop test cases when parity is the goal.
3. **Keep `bazel test` green** — run the full module test suite locally.
4. **Describe the test plan** in the PR body (see the PR template).
5. **No drive-by refactors** — keep diffs focused.

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml). Include:

- Platform (web / macOS / Android)
- Steps to reproduce
- Expected vs. actual behavior
- Whether you were using Simulation mode or real hardware

## Feature requests

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml). Check [PORT_AUDIT_AND_PLAN.md](PORT_AUDIT_AND_PLAN.md) first — the feature may already be tracked.

## Regenerating golden fixtures

The `.pat` golden tests compare against ayab-desktop's Python `PatPatternConverter`. To regenerate:

```bash
# Clone ayab-desktop as a sibling of ayab-valdi, then:
export AYAB_DESKTOP_PATH=/path/to/ayab-desktop/src/main/python/main
python3 src/modules/process_image/test/fixtures/generatePatGoldenFixtures.py
python3 src/modules/process_image/test/fixtures/generateStpGoldenFixtures.py
python3 src/modules/process_image/test/fixtures/generateCutGoldenFixtures.py
```

`.pat` / `.stp` generators need ayab-desktop as a sibling (or `AYAB_DESKTOP_PATH`) plus numpy/pillow. The `.cut` generator is self-contained (desktop’s cut parser hangs on `pos` updates; Valdi’s fixed decoder is the oracle).

Use the project venv if your system Python is externally managed:

```bash
python3 -m venv .venv-pat-golden
.venv-pat-golden/bin/pip install numpy pillow
.venv-pat-golden/bin/python src/modules/process_image/test/fixtures/generateStpGoldenFixtures.py
```

Golden output is committed; regeneration is only needed when the converter changes.

## Upgrading Valdi dependencies

`src/MODULE.bazel` fetches Valdi and Valdi_Widgets from GitHub via `archive_override` and applies patches from `src/patches/`. SHAs are pinned in `VALDI_REF` / `WIDGETS_REF`. The Bazel registry is fetched from the same Valdi pin (not committed).

To upgrade:

1. Choose new upstream commit SHAs (usually `origin/main` of each repo).
2. Confirm every patch under `src/patches/valdi/` and `src/patches/valdi_widgets/` still applies (`git apply --check` against those commits, or bump/drop patches that landed upstream).
3. Update pins and refresh the registry cache:
   ```bash
   ./scripts/pin-valdi-deps.sh <valdi-sha> <widgets-sha>
   ```
   Or omit SHAs to resolve latest `main` from GitHub.
4. Sync and test:
   ```bash
   cd src && valdi projectsync
   ./scripts/run-tests.sh
   cd src/web && npm run e2e
   ```
5. Commit `.github/valdi-deps.env`, `src/MODULE.bazel`, and any patch updates together.

When an upstream PR merges a patch we carry locally, delete that patch file and remove it from the corresponding `archive_override(patches = ...)` list.

## Questions

- **AYAB protocol / hardware:** [ayab-desktop issues](https://github.com/AllYarnsAreBeautiful/ayab-desktop/issues) or the AYAB community
- **Valdi framework:** [Valdi Discord](https://discord.gg/uJyNEeYX2U) or [Valdi docs](https://github.com/Snapchat/Valdi/tree/main/docs)
- **This port:** open a GitHub issue here
