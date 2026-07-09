# ayab-valdi (Bazel workspace)

This directory is the Bazel workspace root. See the [project README](../README.md) for full setup and usage instructions.

## Quick commands

```bash
# From this directory (src/)
valdi projectsync
../scripts/run-tests.sh
valdi install macos
cd web && npm start
```

## Modules

| Module | Purpose |
|--------|---------|
| `ayab_valdi` | Main app shell, sessions, modals, port/machine pickers |
| `serial` | Serial communication, Web Serial, WebSocket transport, network registry |
| `state_machine` | AYAB protocol state machine, pattern, validation |
| `preview` | Image preview, zoom viewport, transforms, bed visualization |
| `image_settings` | Knit settings UI and pure logic |
| `app_settings` | Preferences storage, settings screen, about screen |
| `process_image` | Image loading, `.pat` / `.stp` / `.cut` import |
| `constants` | Shared types, tokens, UI theme |

## `ayab_valdi` app architecture

`App.tsx` is the root shell (~450 lines). It owns preferences, image state, modal visibility, and wires child components. Heavy logic lives in extracted modules:

```
App
├── AppImageHandlers → AppImageLogic     # repeat / transform state
├── AppSessions                          # knit + hardware-test orchestration
├── PreviewPanel (ValueNotifier)         # preview + progress; knit ticks scoped here
├── AppSidebar                           # machine, serial, image settings, knit footer
├── SettingsModal
└── HardwareTestModal (ValueNotifier)    # log + ready; command table inside modal
```

**Sessions** (no UI):

- `KnitSession` — build pattern, run knit loop, feedback/audio hooks
- `HardwareTestSession` — `Operation.TEST` loop, simulation timer, `sendCommand`

**Reactivity:** `ValueNotifier` lets `PreviewPanel` and `HardwareTestModal` subscribe to high-frequency updates without re-rendering all of `App`. `Preferences.onChanged()` bumps `preferencesRevision` for pickers that need it.

**Pure logic** (unit-tested, no Valdi UI):

- `AppUiState`, `KnitProgressRowLogic`, `ImageSettingsLogic`, `FormattedDisplayLogic`, etc.

When adding features: put validation and transforms in `*Logic.ts`, session loops in `*Session.ts` or `AppSessions.ts`, and keep `onRender()` free of inline handler lambdas passed to children.

## Tests

```bash
../scripts/run-tests.sh                 # all 8 module targets
bazel test //modules/ayab_valdi:test    # single module
cd web && npm run e2e                   # 9 browser specs
```

See `TDD_GAP_PLAN.md` for the full spec map and remaining gaps.
