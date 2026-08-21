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

