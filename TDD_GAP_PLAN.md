# Test-Driven Gap Closure Plan: ayab-valdi

This plan closes the PyQt → Valdi gaps using **tests first**. Desktop Python tests in `ayab-desktop` remain the oracle where fixtures exist.

**Status (2026-07):** Phases 0–7 product/TDD work for practical knitting are **complete**. Remaining work is open-source hygiene (push/CI) and optional polish listed below.

---

## Principles

1. **Red → Green → Refactor** for every feature.
2. **Pure logic in unit tests** (Jasmine via `valdi_test`). **UI in component tests** (`valdiIt`).
3. **Golden parity** when desktop fixtures exist.
4. **Simulation as integration harness**: `CommunicationMock` + `KnitSession.run()`.
5. Keep `bazel test` and `npm run e2e` green.

---

## Out of scope

| Item | Notes |
|------|--------|
| **Localization / i18n** | English-only |
| **In-app firmware flash** | Wrong-API copy points users to ayab-desktop |
| **Reflect / mirror dialog** | Won't implement |
| **Rotate-right UI** | Won't wire (`rotateLeft` only in UI) |
| **Empty checkerboard start** | Deferred — keep default checkerboard for now |

---

## Completed phases

| Phase | Focus | Status |
|-------|-------|--------|
| **0** | Test infra, CI, Valdi pin scripts | ✅ |
| **1** | Vertical flip, validation, Feedback | ✅ |
| **2** | Preferences, row overlay, auto-mirror, Simulation, progress | ✅ |
| **3** | Transforms (incl. stretch), ModeFunc, About, audio | ✅ |
| **4** | WebSocket, mDNS (macOS), Pat/Stp/Cut, HW test | ✅ (sleep prevention still open) |
| **5** | Web E2E (9 specs) | ✅ locally |
| **6** | App splits, `AppSessions`, `ValueNotifier` | ✅ |
| **7** | mDNS + `.stp` goldens + UX tour/banner/needle/knit-side | ✅ |

Also shipped after Phase 7: wrong-API firmware recovery guidance in `Feedback` / `KnitActionBanner`.

---

## Remaining work

| Slice | Status | Notes |
|-------|--------|-------|
| **Push + GitHub CI verify** | Open | Confirm Actions green after push |
| **Empty initial preview** | Deferred | Drop auto-checkerboard later |
| **Sleep prevention** | Optional | Keep awake during knit |
| **`.cut` golden tests** | ✅ | `CutPatternConverter.golden.spec.ts` |
| **Android/iOS mDNS** | Optional | macOS Bonjour already works |
| **Knit mode / recent files** | Optional | See `UX_RECOMMENDATIONS.md` |
| **Reflect / rotate-right UI** | Won't do | — |

Suggested order: **push/CI** → optional polish as needed.

---

## Local verification

```bash
./scripts/run-tests.sh
cd src/web && npm run e2e
```

CI: `.github/workflows/tests.yml` (macOS Bazel), `e2e.yml` (Ubuntu Puppeteer).

**Exit criteria still pending:** CI verified on GitHub after the next push.

---

## Test file map (high level)

```
modules/state_machine/test/   Pattern, Status, ValidateKnitConfig, ModeFunc, …
modules/serial/test/          Communication, Control, NetworkDiscovery, WebsocketTransport
modules/ayab_valdi/test/      App*, KnitSession, Feedback, FirstRunTour, KnitActionBanner, …
modules/preview/test/         ImageTransform, KnitSidePreviewLogic, PreviewTransforms, …
modules/image_settings/test/  ImageSettingsLogic, ImageSettingsComponent
modules/app_settings/test/    Preferences, PreferencesScreen, AboutScreen
modules/process_image/test/   Pat + Stp + Cut golden, CutPatternConverter
src/web/e2e/specs/            smoke, load-image/pat, validation, simulation-knit,
                              hardware-test, settings, preview-transforms, progress-stitch
```

---

## Sprint summary

| Sprint | Focus | Status |
|--------|-------|--------|
| S0–S7 | Infra through architecture refactor | ✅ |
| S8 | mDNS + `.stp` golden | ✅ |
| S9 | First-run tour, action banner, knit-side, needles, stretch, firmware recovery | ✅ |
| **S10** | Push / CI / public repo | **Next** |

---

## Definition of done (per slice)

- [x] Tests written / ported
- [x] Implementation green locally
- [x] No `console.log`-only user errors for shipped slices
- [x] E2E updated for user-visible UI
- [ ] CI verified on GitHub after push

---

## References

- Feature audit: `PORT_AUDIT_AND_PLAN.md`
- UX backlog: `UX_RECOMMENDATIONS.md`
- Contributor guide: `CONTRIBUTING.md`
