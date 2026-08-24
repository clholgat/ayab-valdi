# Valdi Web sync PR #148 integration notes

These notes capture issues found while updating AYAB Valdi to
[Snapchat/Valdi#148](https://github.com/Snapchat/Valdi/pull/148), tested at
Valdi commit `08a94ae1ba4624b0d6f0d139eb27f2ea4a560068`.

## Validation performed

- `bazel build //:ayab_valdi_app_web` succeeds with the temporary compatibility
  changes in this branch.
- All 11 project Bazel test targets pass.
- All 17 browser E2E workflows pass.
- The Web simulation workflow was also verified manually.
- In the downstream `pattern_website` consumer, `npm run build` succeeds and
  `npm run verify` passes the canonical Valdi test target plus exported Web
  package build.
- The downstream `/projects` deep link was verified visually after it
  canonicalized to `/tools/projects` and rendered the expected project UI.
- A downstream Puppeteer regression test passes real mouse clicks through the
  Patterns header, a pattern card, the Tools header, and a tool card after the
  temporary layout hit-testing patch.
- Newly reported interaction and layout failures were pinned by failing
  real-browser tests: pattern header/scroll/input behavior, Stitch Chart zoom
  dragging, and narrow-page overflow. With renderer patches `0010` through
  `0013`, the aggregate `npm run test:pr148` suite passes real mouse, keyboard,
  and wheel input, and the route suite passes at desktop and phone widths.
- The corrected `0010` patch applies against the exact pinned Valdi source.
  `npm run verify` passes the canonical Valdi tests and exported Web package
  build, and `npm run build` completes the production Webpack build.

## 1. External Web dependency paths can escape the collapsed output tree

**Impact:** blocks `valdi_web_application` builds when Valdi is consumed as an
external Bazel module.

Bazel exposes some external-repository inputs with short paths such as:

```text
../valdi~/src/valdi_modules/src/valdi/coreutils/src/RuntimeBase.d.ts
```

The fallback in `_dest_native()` returns that path unchanged. The collapse action
then tries to write outside its declared tree artifact.

**Temporary workaround:**
`src/patches/valdi/0002-Normalize-external-web-native-paths.patch` strips the
Valdi source prefix, or at minimum the leading `../`, before returning the
destination.

**Suggested upstream fix:** normalize every `_dest_native()` result to a safe,
package-relative path and add a regression test using an external Bzlmod
dependency.

## 2. The current Valdi Widgets pin uses the removed palette API

**Impact:** blocks the Web build when Valdi PR #148 is paired with the current
Valdi Widgets revision.

`valdi_modules/widgets/src/InitSemanticColors.ts` calls:

```typescript
runtime.setColorPalette(palette);
```

The PR replaces that API with named palettes.

**Temporary workaround:**
`src/patches/valdi_widgets/0002-Use-named-color-palette-runtime-API.patch` calls:

```typescript
runtime.configureColorPalette('default', palette);
runtime.setActiveColorPalette('default');
```

**Suggested upstream fix:** land the corresponding compatibility update in
Valdi Widgets, or preserve a compatibility wrapper in Valdi until the paired
Widgets release is available.

## 3. The Web PersistentStore format changes without migration

**Impact:** browser state written by the previous implementation becomes
invisible after upgrading. For AYAB this includes preferences, onboarding state,
and recoverable knitting checkpoints.

The previous implementation stored a whole store under a key shaped like:

```text
valdi.PersistentStore.<store-name>
```

with typed values inside the serialized store object. PR #148 instead writes one
enveloped value per key:

```text
valdi.persistence.v1:<scope>:<store-name>:<entry-key>
```

The new reader enumerates only the new namespace. No fallback reader or one-time
migration for the previous key was found.

**Suggested upstream fix:** on first access, detect the legacy store object,
convert its entries to the v1 envelopes, and remove the legacy key only after a
successful migration. Add a test that initializes localStorage in the previous
format and verifies values survive the upgrade.

## 4. Custom `@ExportModule` Web implementations are not shimmed automatically

**Impact:** downstream polyglot modules do not build from `web_deps` alone.

AYAB has the expected module layout:

```text
process_image/src/ProcessImageNative.d.ts
process_image/web/ProcessImageNative.ts
```

and wires the Web `ts_project` through `web_deps`. Without additional metadata,
Webpack fails with:

```text
Module not found: Can't resolve 'process_image/src/ProcessImageNative'
Module not found: Can't resolve './ProcessImageNative.js'
```

The package-file generator and `RegisterNativeModules.js` generator are both
driven by `web_register_native_module_id_overrides`; they do not infer the
relationship from the `@ExportModule` declaration and Web implementation.

**Temporary workaround:** `src/modules/process_image/BUILD.bazel` currently
contains:

```python
web_register_native_module_id_overrides = {
    "process_image/web/ProcessImageNative.js": "process_image/src/ProcessImageNative",
}
```

This should not be the required downstream integration pattern. Per the Valdi
polyglot contract, `web_deps` should make the Web implementation available and
the build should generate the shim without handwritten registration metadata.

**Suggested upstream fix:** derive the package shim mapping from exported native
module declarations plus the owning module's Web outputs. Add a downstream
module test that uses only `web_deps` and imports its exported native module by
the normal Valdi module ID.

## 5. Webpack reports a dynamic-require dependency warning

**Impact:** non-blocking, but every application build emits:

```text
Critical dependency: require function is used in a way in which dependencies
cannot be statically extracted
```

The warning originates from the compiled Web renderer path where the raw
`require` function is passed into dynamic component resolution. The bundle still
builds and the tested workflows work, but this weakens Webpack's static dependency
analysis and can obscure a genuinely missing module.

**Suggested upstream fix:** route dynamic component resolution through a
generated, statically enumerable registry, or otherwise constrain/suppress the
known context deliberately and add a bundle test that fails for an unregistered
component.

## 6. Native-module override ownership and transitivity are fragile

**Impact:** downstream builds can fail either during Valdi compilation or later
in Webpack, depending on which module declares the override.

`pattern_website` has a native `raster_image/src/RasterImage.tsx` implementation
and a Web implementation at `raster_image/web/RasterImageWeb.ts`. Keeping the
override on the owning `raster_image` `valdi_module` makes the PR compiler emit
both the concrete TSX output and generated Web shim to:

```text
web/debug/assets/raster_image/src/RasterImage.js
```

The compiler then fails with `Multiple .finalFile items writing to the same
output URL`. Separately, AYAB's `process_image` override is declared in the
dependency, but it is not propagated into the downstream collapsed Web package;
Webpack reports unresolved `process_image/src/ProcessImageNative` imports.

**Temporary workaround:** remove the raster override from its owning module and
redeclare both the raster and process-image mappings on the consuming
`pattern_website` module.

**Suggested upstream fix:** define one unambiguous ownership model for these
mappings, aggregate valid mappings transitively, and suppress/replace the
concrete output when a shim intentionally targets the same module ID. The
duplicate-output diagnostic should also identify the generated shim instead of
presenting it as a second source file.

## 7. The public browser-history navigation surface was removed

**Impact:** `pattern_website` no longer compiles because it imports
`web_renderer/src/WebNavStack` and `web_renderer/src/RouteRegistry` for browser
history, deep links, canonical URLs, and custom route construction.

The replacement `WebNavigationHost`/`WebNavigator` implementation does not
expose equivalent URL, route-registry, restore-from-location, or `popstate`
behavior. Adopting it directly would require the application to reintroduce a
custom browser-history bridge.

**Temporary workaround:** the downstream project patches the three previous
compatibility files (`WebNavStack.ts`, `RouteRegistry.ts`, and the previous
`WebNavigator.ts`) back into `web_renderer`, with renderer teardown updated from
`destroy()` to the PR's `onDestroy()` lifecycle method.

**Suggested upstream fix:** retain the compatibility exports until an official
browser routing API covers route registries, URL builders, deep-link restoration,
back/forward navigation, and page teardown. A migration guide should identify
the replacement for each removed behavior.

## 8. Generated `.bin` module entries assume bundler-specific byte handling

**Impact:** Valdi compilation succeeds, but the downstream production Webpack
build fails with hundreds of errors such as:

```text
Module parse failed: Unexpected character
.../preview/src/patterns/annotated/stitchworld-004.png.bin
```

The PR-generated `_module_entry_registry.js` emits a static `require()` for
every `.bin` entry. Webpack has no default parser for that extension, and the
generated package does not provide a loader contract. In this consumer the
registry exposed 523 such failures at once.

**Temporary workaround:** add a Webpack 5 `asset/bytes` rule for `.bin` so the
runtime receives a `Uint8Array` and preserves byte-exact pattern images.

**Suggested upstream fix:** make collapsed packages bundler-neutral (for
example, emit byte-exact registry data directly), or ship and document the
required bundler configuration. Add an integration fixture containing a binary
module entry and bundle it with the supported Web toolchain.

## 9. Shadow-root isolation breaks existing browser-level test contracts

**Impact:** the downstream app renders correctly, but its existing Puppeteer
workflows time out because they use document-level selectors and
`document.body.innerText`.

PR #148's `ValdiWebRenderer` now attaches an open shadow root to every page host.
The visible `/tools/projects` screen was confirmed in a screenshot, while the
same page appeared empty to the current assertions and reported no runtime or
Webpack error. Its text is available only by traversing the visible page host's
`shadowRoot`.

**Suggested upstream fix:** publish a stable browser-test query helper or test
contract that traverses Valdi renderer roots, and document the migration impact
for host-page selectors, accessibility assertions, and automation. An opt-out or
compatibility period would reduce surprise for existing Web consumers.

## 10. Non-interactive layout overlays block pointer input

**Impact:** catalog pages render normally, but pattern and tool cards cannot be
clicked. Header navigation still works, which makes the failure initially look
like an application routing or gesture-bubbling bug.

The PR's rewritten `LayoutElementClass` creates ordinary `<div>` elements
without a `pointer-events` default. The previous Web renderer initialized Valdi
layout/view nodes with `pointer-events: none`, then explicitly opted interactive
nodes back in when attributes such as `onTap`, `touchEnabled`, or `hitTest` were
applied. Without that default, Widgets' empty absolute `Subscreen` floating
layout covers the complete body below the header and wins
`shadowRoot.elementFromPoint()`, preventing real pointer events from reaching
the cards underneath.

**Temporary workaround:** `pattern_website` patches `LayoutElementClass` so
new layout/view `<div>` nodes start with `pointer-events: none`; the existing
gesture attribute appliers continue to set `pointer-events: auto` on interactive
views. A Puppeteer regression test performs real mouse clicks through both a
pattern card and a tool card.

**Suggested upstream fix:** restore transparent hit testing as the default for
non-interactive Valdi layout/view nodes and add renderer tests for overlapping
absolute containers. The integration fixture should verify that an empty
overlay does not intercept clicks while a child with `onTap` remains clickable.

## 11. Renderer shadow roots isolate application layout and print CSS

**Impact:** downstream pattern pages show no usable header, do not scroll, and
render their print-only copy alongside the interactive screen copy.

`pattern_website` installs responsive-layout and print styles in `document.head`.
PR #148 creates an open shadow root for every page host, so selectors such as
`.akf-print-document { display: none }` no longer reach the rendered page.
The print copy therefore remains in normal flex layout and distorts the screen
shell. A real-browser reproduction at 1280×720 measured:

```text
header rect: top=-39.5, bottom=-18.5
#scrollView: clientHeight=0, scrollHeight=1416, scrollTop=0
```

The renderer-root text also contained the complete pattern body twice, which
confirms that the screen and print timelines were both visible.

**Verified temporary framework workaround:**
`src/patches/valdi/0012-Preserve-host-styles-in-isolated-web-roots.patch`
clones the host's existing `<style>` and stylesheet `<link>` nodes into each new
isolated renderer root. `pattern_website` keeps its original document-level CSS
installation unchanged. The Valdi renderer test confirms cloned rather than
moved nodes and preserves the renderer's own reset stylesheet; the downstream
browser suite confirms the header and responsive layout rules are visible.
Styles added or changed after a renderer root is constructed are not synchronized
by this compatibility patch, and the actual browser print dialog was not
re-tested.

**Suggested upstream fix:** provide and document a renderer stylesheet
registration API that installs application-owned CSS in each isolated root, or
retain a compatibility mode for apps that rely on document-level media queries.
Add an integration test covering `@media print`, hidden screen-only content,
hidden print-only content, and responsive class selectors inside a page host.

## 12. Pointer-transparent layouts also disable text fields and scroll views

**Impact:** after restoring the old transparent-layout default in section 10,
pattern text boxes cannot be focused or typed into and wheel scrolling cannot
reach the Valdi scroll view.

The old renderer made layout containers pointer-transparent, but concrete
interactive element classes opted themselves back in. PR #148's new
`TextFieldElementClass` and `ScrollElementClass` do not set
`pointer-events: auto`. The browser reproduction recorded:

```text
#chestCircumference value: "38" before and after Meta+A, typing "48"
computed pointer-events: none
shadowRoot.activeElement === input: false
elementFromPoint(input center): DIV
#scrollView wheel result: scrollTop=0
```

This is the other half of the section 10 contract: setting every layout to
pointer-active blocks controls behind overlays, while setting layouts to
pointer-transparent without opting concrete controls back in disables the
controls themselves.

**Verified temporary workaround:** copied patch
`src/patches/valdi/0010-Restore-web-input-scroll-and-mouse-touch-events.patch`
sets `pointerEvents: 'auto'` when creating Web text fields and scroll views. A
real-browser test focuses `#chestCircumference`, replaces its value by keyboard,
and advances the page's scroll offset with a wheel event.

**Suggested upstream fix:** encode hit-testing ownership per element class and
test it as one contract: transparent layout overlays, clickable `onTap` views,
focusable/editable text fields, and wheel/touch-scrollable scroll views.

## 13. `onTouch` lost desktop mouse support and local coordinates

**Impact:** the Stitch Chart editor's Zoom slider does not react to mouse drag.
This likely affects every Widgets `Slider` and any Web UI that uses Valdi
`onTouch` as a cross-input drag primitive.

Widgets' `Slider` listens with `onTouch` and calculates its normalized value as
`event.x / barWidth`. The previous Web renderer supplied a desktop sequence
(`mousedown`, document-level `mousemove`, `mouseup`) and reported `x`/`y`
relative to the target element. PR #148 binds `onTouch` only to browser
`touchstart`/`touchmove`/`touchend`/`touchcancel`, reports viewport coordinates,
and—after the necessary transparent-layout fix—leaves the slider at computed
`pointer-events: none`.

A Puppeteer test dragged across a visible 1043.58×25 slider with a real mouse;
the label remained `Zoom: 1.0x`.

**Verified temporary workaround:** copied patch
`src/patches/valdi/0010-Restore-web-input-scroll-and-mouse-touch-events.patch`
opts `onTouch` views into hit testing, restores the document-level desktop mouse
sequence, cleans listeners up with the attribute lifecycle, and supplies
element-local `x`/`y` while retaining viewport-relative `absoluteX`/`absoluteY`.
After rebuilding, the same Puppeteer drag changes the Stitch Chart label from
`Zoom: 1.0x` to `Zoom: 2.5x`.

**Suggested upstream fix:** restore mouse/pointer parity in `onTouch` (preferably
with Pointer Events and pointer capture), preserve the documented local versus
absolute coordinate semantics, and add mouse, touch, drag-outside-bounds, and
listener-cleanup tests using Widgets' Slider as an integration fixture.

## 14. Multiline text views are read-only by default

**Impact:** multiline editors render with the expected textbox shape and text,
but cannot receive focus or keyboard input. This blocked the garment workflow's
free-form pattern summary even after ordinary `CoreTextField` inputs were fixed.

The PR's `TextViewElementClass` creates a pointer-inactive `<div>` and sets
`contentEditable=false`. A real-browser reproduction reported:

```json
{"tag":"div","contentEditable":"false","fontFamily":"sans-serif","height":96}
```

**Verified temporary workaround:** copied patch
`src/patches/valdi/0011-Restore-editable-Web-text-views.patch` restores the
previous default editability contract by opting the element into pointer input,
using `contentEditable=plaintext-only`, and exposing textbox/multiline ARIA
semantics. The browser garment workflow now enters real multiline text by
keyboard and completes its sample, profile, fit, AYAB handoff, Back-navigation,
and post-return checks.

**Suggested upstream fix:** make Web text views editable by default, retain
`enabled=false` as the explicit read-only path, and add focus, typing, multiline,
selection, disabled-state, and accessibility integration tests.

## 15. Static CommonJS imports bypass Web native-module overrides

**Impact:** chart images render as empty boxes and edits appear to do nothing.
The chart's RGBA-to-PNG promise rejects, while the application intentionally
keeps the previous image and continues without surfacing the encoder failure.

Under PR #148, compiled consumers contain a static webpack import such as:

```js
require("../../../raster_image/src/RasterImage.js")
```

The generated `RegisterNativeModules.js` correctly registers
`raster_image/web/RasterImageWeb` for the module ID
`raster_image/src/RasterImage`, but that registration only affects Valdi's
runtime module loader. Webpack follows the relative CommonJS import directly and
bundles the native Skia implementation instead of the registered canvas shim.
The resulting Web image element had its expected 336×264 layout but no `<img>`
or `<canvas>` child.

**Verified temporary downstream workaround:** `pattern_website` adds a webpack
`NormalModuleReplacementPlugin` rule that maps static imports of
`raster_image/src/RasterImage.js` to the generated Web shim. After rebuilding,
the full real-browser chart workflow passes paint, select, copy/paste, reusable
motifs and palettes, repeat, move, undo, final paint, and workshop export.

**Suggested upstream fix:** make `web_register_native_module_id_overrides`
effective for both runtime-loader calls and static CommonJS imports in the
collapsed npm package, or generate imports that consistently use the registered
module IDs. Add an end-to-end webpack fixture whose Web implementation differs
observably from its native implementation.

## 16. PR #148 makes all Web labels non-shrinking

**Impact:** at a 320px viewport, the Stitch Chart page acquired 150px of
horizontal page overflow. Its intentionally wide chart remained correctly
contained by a horizontal scroller; the actual offender was the status sentence
`Pick a color and tap or drag on the grid to draw stitches.`, measured at
445.25px inside a 294.4px row.

The PR's base DOM layout-item styles use `flex-shrink: 0`, and the rewritten
`LabelElementClass` inherits that value. The previous Web label did not set
`flex-shrink`, so browser flexbox used its shrinkable default. Labels in
horizontal rows now keep their intrinsic width unless every consumer explicitly
overrides the framework default.

**Verified temporary framework workaround:**
`src/patches/valdi/0013-Restore-shrinkable-web-labels.patch` sets
`flexShrink: 1` on Web labels. Its Valdi renderer regression test passes, and
the downstream 320px route test reports no surrounding-page overflow while the
chart retains its intentional inner two-axis scroller. No app component was
changed.

**Suggested upstream fix:** restore the previous shrinkable Label default and
add a narrow-viewport fixture with a wrapping multiline label in a horizontal
row that asserts it cannot widen the page.

## 17. Stitch Chart column order and faint borders are downstream, not PR regressions

The post-sync visual review expected the older mixed Stitch Chart layout: a
vertical controls/actions column beside a vertical drawing/preview column on
wide screens, stacking on phones. That layout exists in the parent of downstream
commit `6a8f708`; the commit replaced it with the current `chartTimelineStyle`,
which explicitly sets `flexDirection: 'column'` and renders every card in one
vertical sequence. The current page also explicitly requests the wide site
shell. Valdi is rendering the source it receives, so a framework patch cannot
recreate the historical card grouping. No app source change was retained; this
needs a separate downstream product/code decision.

The Stitch Chart borders are also present in PR #148's separate paint elements.
Representative app-defined neutral colors measure only about 1.42–1.48:1
against their backgrounds, which explains why they appear missing. That contrast
choice is downstream styling, not dropped renderer attributes. In contrast,
section 11 is a genuine framework regression for class-based host styles that
cannot cross the new shadow boundary and is addressed by patch `0012`.

## Copied downstream compatibility patches

The following previously local `pattern_website` patches are now copied into
AYAB and referenced by `src/MODULE.bazel`:

- `0008-Restore-WebNavStack-route-compatibility.patch`
- `0009-Restore-transparent-layout-hit-testing.patch`
- `0010-Restore-web-input-scroll-and-mouse-touch-events.patch`
- `0011-Restore-editable-Web-text-views.patch`
- `0012-Preserve-host-styles-in-isolated-web-roots.patch`
- `0013-Restore-shrinkable-web-labels.patch`

The other local Valdi patches were not duplicated because AYAB already carries
equivalent patches under its own numbering: pattern site's `0006` corresponds
to AYAB `0001`, and pattern site's `0007` corresponds to AYAB `0002`.
