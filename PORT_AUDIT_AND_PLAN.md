# ayab-valdi Port Audit & Implementation Plan

This document compares **ayab-valdi** to **ayab-desktop**. Updated **2026-07** to match the current codebase.

---

## 1. What exists today

### Core engine (parity)

| Area | Status | Key files |
|------|--------|-----------|
| **Serial / connection** | ✅ | `SerialPortPicker`, Web Serial polyglot, `Communication`, `WebsocketTransport` |
| **Simulation** | ✅ | `CommunicationMock`; "Simulation" always in port list |
| **Manual WebSocket** | ✅ | `NetworkDiscovery`, prompt in `SerialPortPicker` |
| **mDNS (macOS)** | ✅ | Bonjour via `browse_ayab_mdns()` / `MdnsDiscoveryMacOS.mm` |
| **State machine** | ✅ | `StateMachine`, `Control`, `Operation.KNIT` / `TEST` |
| **Pattern** | ✅ | `Pattern`, `PatternImage`, alignment, needles, `ModeFunc` |
| **Validation** | ✅ | `ValidateKnitConfig`, `KnitSession.tryStart`, `AppUiState` |
| **Vertical flip at knit** | ✅ | `prepareImageBitsForKnit` / `ImageOrientation` |

### UI and UX

| Area | Status | Key files |
|------|--------|-----------|
| **Main layout** | ✅ | `App`, `AppSidebar`, `PreviewPanel`, `AppKnitFooter` |
| **First-run tour** | ✅ | `FirstRunTour`, `OnboardingBubble`, `InlineTourBubble` |
| **Knit action banner** | ✅ | `KnitActionBanner`, `KnitSessionUiLogic` |
| **Preferences** | ✅ | `Preferences`, `PreferencesScreen`, `SettingsModal` |
| **Image settings** | ✅ | `ImageSettingsComponent`, needle suggestions, help hints |
| **Image transforms** | ✅ | Flip H/V, rotate left, invert, repeat, **stretch** |
| **Knit-side preview** | ✅ | `KnitSidePreviewLogic` label + hint |
| **Image loading** | ✅ | Raster + `.pat` / `.stp` / `.cut` via `PatternFileLoader` |
| **Preview** | ✅ | `Preview`, `ZoomablePreviewViewport`, bed + needles |
| **Row progress overlay** | ✅ | `PreviewSceneLayout` |
| **Knit progress** | ✅ | `ProgressAndStatus`, `KnitProgressRow`, stitch selection |
| **User feedback** | ✅ | `Feedback`, `UserMessage`, wrong-API → ayab-desktop guidance |
| **About** | ✅ | `AboutScreen` in `app_settings` |
| **Hardware test** | ✅ | `HardwareTestSession`, `HardwareTestModal` |
| **Audio** | ✅ Partial | Web audio via `PlatformAudioFeedback`; `quietMode` |

### Architecture & quality

| Area | Status | Key files |
|------|--------|-----------|
| **Session orchestration** | ✅ | `KnitSession`, `HardwareTestSession`, `AppSessions` |
| **Image pipeline** | ✅ | `AppImageLogic`, `AppImageHandlers` |
| **Scoped re-renders** | ✅ | `ValueNotifier` |
| **Tests** | ✅ | 8 Bazel `:test` targets, Jasmine specs |
| **Web E2E** | ✅ | 9 Puppeteer specs under `src/web/e2e/` |
| **CI** | ✅ | `tests.yml`, `e2e.yml`; pinned Valdi SHAs in `.github/valdi-deps.env` |

```bash
./scripts/run-tests.sh
cd src/web && npm run e2e
```

---

## 2. Remaining gaps vs ayab-desktop

### Won't do / explicitly deferred

| Item | Decision |
|------|----------|
| **Reflect / mirror dialog** | Won't implement; stretch + flip cover common cases |
| **Rotate right in UI** | Won't wire; `rotateLeft` is enough (`rotateRight` exists in logic only) |
| **Empty initial preview (no checkerboard)** | Deferred — keep default checkerboard for now |
| **In-app firmware flash** | Deferred forever for this port; wrong-API message points at ayab-desktop |
| **i18n** | Deferred; English-only |

### Optional remaining work

| Item | Notes |
|------|--------|
| **mDNS on Android / iOS** | macOS Bonjour only; web/Linux use manual `ws://` |
| **`.cut` golden tests** | ✅ `CutPatternConverter.golden.spec.ts` (greyscale + `.pal`) |
| **Fullscreen Knit mode** | See `UX_RECOMMENDATIONS.md` |
| **Recent files / export** | Not implemented |
| **Sleep prevention** | Keep screen awake during knit (especially Android/macOS) |
| **Menu bar / full scene editor** | Different chrome; not blocking knitting |
| **Mode-aware help** | Contextual notes when Mode changes |

### Open-source hygiene (non-code)

1. Commit and push accumulated changes; verify GitHub Actions green.
2. Make repository public (or transfer to AYAB org).
3. Refresh README badges after URL/visibility change.

---

## 3. Priority overview

| Priority | Item | Status |
|----------|------|--------|
| — | Phase 1–3 core parity + UX | ✅ Done |
| — | mDNS (macOS), `.stp` goldens, stretch | ✅ Done |
| — | Wrong-API firmware recovery copy | ✅ Done |
| **Next** | Commit / push / CI verify / public | Open |
| **Later** | Empty preview (drop checkerboard) | Deferred |
| **Optional** | Knit mode, recent files, Android mDNS | Open |
| **Won't do** | Reflect, rotate-right UI, in-app firmware flash, i18n | — |

---

## 4. Summary checklist

| Feature | Desktop | Valdi | Notes |
|---------|---------|-------|-------|
| Serial discovery | ✅ | ✅ | Local + Web Serial |
| mDNS / auto WebSocket | ✅ | ✅ Partial | Bonjour on macOS; manual URL elsewhere |
| Simulation | ✅ | ✅ | |
| Knit + cancel | ✅ | ✅ | |
| Validation + UI errors | ✅ | ✅ | Includes wrong-API → ayab-desktop |
| Preferences | ✅ | ✅ | |
| Progress / knit table | ✅ | ✅ | + action banner |
| First-run guidance | ✅ | ✅ | Tour overlay |
| Image transforms (core + stretch) | ✅ | ✅ | No reflect / rotate-right UI |
| Pat / Stp / Cut import | ✅ | ✅ | `.pat` / `.stp` / `.cut` golden-tested |
| About / version | ✅ | ✅ | |
| HW test UI | ✅ | ✅ | |
| Audio | ✅ | Partial | Web |
| Firmware flash | ✅ | ❌ | Documented recovery only |
| i18n | ✅ | ❌ | Deferred |
| Tests + CI + E2E | ✅ | ✅ | Verify on GitHub after push |

---

## 5. Notes

- Engine and practical knitting parity are complete for day-to-day use.
- Product UX polish beyond knitting (Knit mode, recent files, empty start) lives in [`UX_RECOMMENDATIONS.md`](UX_RECOMMENDATIONS.md).
- Test history and remaining TDD slices: [`TDD_GAP_PLAN.md`](TDD_GAP_PLAN.md).
