# AYAB Valdi — Product & Usability Recommendations

Product and usability recommendations for **ayab-valdi**, grounded in how AYAB knitting works, the [official AYAB manual](https://manual.ayab-knitting.com/1.0/how_to_knit/basics/), and the current app UI.

**Updated 2026-07** — high-impact items #1–#4, stretch, firmware recovery, and mDNS (macOS) are implemented. Checkerboard empty-start is deferred; reflect / rotate-right won't be added.

---

## Who is using this?

AYAB users stand at a **Brother machine**, move a **carriage by hand**, listen for **beeps**, and glance at a screen between rows. Constraints:

- Eyes and hands are on the machine most of the time
- Setup is error-prone (port, firmware, needles, KC mode)
- First sessions are confusing
- Terminology is inherited from Brother (Left/Right 30, KC-I/KC-II, purl vs knit side)

---

## High-impact recommendations

### 1. Guided first-run tour — ✅ Done

Implemented as a multi-step first-run overlay (`FirstRunTour`, `OnboardingBubble` / `InlineTourBubble`) covering machine → connection/Simulation → pattern → needles → Knit. Completion is persisted in preferences.

### 2. Prominent knit-session messages — ✅ Done

`KnitActionBanner` spans the preview during active knit prompts (`WAIT_FOR_INIT`, please knit, completion, firmware init, wrong API). Includes a large row counter when row data is available. Web audio still applies via `quietMode`.

### 3. Clarify "Knit side image" — ✅ Done (partial)

| Recommendation | Status |
|----------------|--------|
| One-line hint on the toggle | ✅ `KNIT_SIDE_IMAGE_HINT` |
| Preview label (“Viewing: purl/knit side”) | ✅ `KnitSidePreviewLogic` |
| Live flip when toggled | ✅ via existing auto-mirror preview path |
| Lace mode auto-disable + explanation | ❌ Optional follow-up |

### 4. Needle range: physical ↔ digital — ✅ Done (partial)

| Recommendation | Status |
|----------------|--------|
| Plain-language cast-on hint | ✅ “Match your cast-on…” |
| Suggested range from image width | ✅ `needleDefaultsForImageWidth` + UI suggestion |
| Click bed to set start/stop | ❌ Stretch goal — not planned now |

### 5. Connection UX / firmware recovery — Partial

| Recommendation | Status |
|----------------|--------|
| Wrong-API → update via ayab-desktop | ✅ `WRONG_FIRMWARE_MESSAGE` + action banner |
| mDNS auto-discovery | ✅ macOS Bonjour; manual `ws://` elsewhere |
| First-visit “Connect your AYAB” card | ❌ Optional |
| Persist last-used port | ❌ Optional |

### 6. Empty initial preview (no checkerboard) — Deferred

Keep auto-loading `preview:checkerboard` for now. Later: empty state with “Open a pattern…” and optional demo (`triangles_60x10.png`).

---

## Medium-impact / still open

### 7. Sidebar scroll fatigue — Partial

Knit/Cancel footer is pinned; Image Settings still a long scroll. Optional: accordions; move machine-only prefs into Settings.

### 8. Plain-language progress panel — Partial

Action banner exposes **Row N of M** during knit. Progress table still uses Brother-style needle labels for power users.

### 9. Pattern workflow extras

| Item | Status |
|------|--------|
| Stretch transform | ✅ |
| Reflect / mirror dialog | ❌ Won't do |
| Rotate right in UI | ❌ Won't do |
| Recent files | ❌ Open |
| Save/export after transforms | ❌ Open |
| Pattern dimensions near preview | ❌ Open |

### 10. Mode-aware UI — Open

Short workflow note when Mode changes; hide irrelevant options (e.g. color count for lace).

---

## Platform / layout opportunities (open)

| Platform | Opportunity |
|----------|-------------|
| **Web** | Connection onboarding card; loud audio |
| **macOS** | Menu shortcuts (Open, Knit, Cancel) |
| **Android** | Large touch targets; keep screen awake |

**Knit mode** (fullscreen preview + row counter + banner, sidebar hidden) remains a strong optional upgrade for all platforms.

---

## What the app already does well

- Simulation in the port list
- Preview with needle bed overlay
- Validation before knit (`getKnitDisabledReason`)
- Hardware test in Settings
- Audio feedback on web
- First-run tour + knit action banner
- Wrong-firmware recovery pointing at ayab-desktop

---

## Priority order (current)

1. ~~First-run tour~~ ✅
2. ~~Action banner~~ ✅
3. ~~Knit-side clarity~~ ✅
4. ~~Needle suggestions~~ ✅
5. ~~Firmware wrong-API recovery~~ ✅
6. ~~Stretch + mDNS (macOS)~~ ✅
7. **Ship** — commit, push, CI verify, optionally go public
8. **Deferred** — empty preview (drop checkerboard)
9. **Optional** — Knit mode layout, recent files, mode help, sleep prevention
10. **Won't do** — reflect / rotate-right UI

---

## References

- [AYAB Manual — Basics](https://manual.ayab-knitting.com/1.0/how_to_knit/basics/)
- [ayab-desktop issue #604 — Knit side image](https://github.com/AllYarnsAreBeautiful/ayab-desktop/issues/604)
- [PORT_AUDIT_AND_PLAN.md](PORT_AUDIT_AND_PLAN.md) — parity checklist
- [TDD_GAP_PLAN.md](TDD_GAP_PLAN.md) — test/history status

---

*Living document — update as recommendations are implemented or deprioritized.*
