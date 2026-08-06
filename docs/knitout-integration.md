# Knitout integration guide

## Using a Knitout file

1. Select the Brother machine, knitting mode, and color count in AYAB settings.
2. In the Pattern panel, use **Open job** and choose a `.k` or `.knitout` file.
3. Review every compatibility issue and warning.
4. Confirm placement and carrier order. `Swap yarn A/B` changes which carrier corresponds to selected needles.
5. Review the needle-selection preview. It shows physical passes, not finished fabric.
6. Run **Simulate job** and acknowledge every manual instruction.
7. Connect the machine and use **Knit job on machine** only after the simulated selections and directions match the intended design.

See [the execution profile](knitout-ayab-profile.md) for the exact supported subset.

## Developer architecture

The data flow is:

```text
Knitout text
  -> parseKnitout
  -> analyzeKnitout
  -> scheduleKnitoutPasses
  -> knitoutToMachineJob
  -> preflightMachineJob
  -> machineJobToKnitPlan
  -> KnitSession
```

`modules/knitout` depends on `modules/machine_job`; the generic job contract does not depend on Knitout. Keep format parsing, machine-independent analysis, AYAB scheduling, and UI presentation separate.

To add an opcode:

1. Ensure the parser retains all operands and the original line.
2. Add analyzer coverage.
3. Decide whether the operation is automatically executable, an operator prompt, or blocking.
4. Prove that every operation is accounted for by scheduler tests.
5. Add golden `Knitout -> MachineJob -> selection bytes` coverage.
6. Validate the behavior on each applicable machine family before removing an experimental or blocking gate.

## Validation

From `src/`:

```bash
bazel test //modules/knitout:test \
  //modules/machine_job:test \
  //modules/knit_session:test \
  //modules/preview:test \
  //modules/ayab_valdi:test \
  --test_output=errors

cd web
E2E_ONLY=knitout-import,machine-job-import npm run e2e
```

Run `valdi projectsync` after adding or changing module dependencies. This repository uses the consolidated `modules/tsconfig.json`; do not add a module-local TypeScript configuration.
