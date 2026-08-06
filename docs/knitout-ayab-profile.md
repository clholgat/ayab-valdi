# AYAB Knitout execution profile

AYAB imports Knitout as a source program, analyzes it, and compiles a deliberately conservative subset into the portable `MachineJob` representation. Parsing a file does not imply that AYAB can execute it. A file reaches simulation or hardware only when every source operation has been scheduled, converted into an acknowledged operator prompt, or rejected with a diagnostic.

This integration targets `;!knitout-2`. Later or earlier versions may be inspected, but are blocked from execution until reviewed.

## Executable subset

An executable carriage pass must satisfy all of these rules:

- Every stitch operation is `knit` on the front bed (`f`).
- Needles are strictly monotonic in the declared direction.
- Every needle between the pass's left and right bounds is knitted exactly once.
- Each needle uses exactly one declared carrier.
- A pass uses one or two distinct carriers.
- Consecutive physical passes alternate direction.
- The translated needle range fits the selected Brother machine.
- The file contains the required `;;Carriers:` header.
- The file contains no extension header or opcode whose machine effect AYAB has not reviewed.

One-carrier passes compile as `stockinette`. Two-carrier passes compile as `fairIsle`. Inside the active needle range, selection bit `1` chooses the first yarn in `MachinePass.yarnIds`, and bit `0` chooses the second. Changing the carrier order changes the compiled job and invalidates recovery from the previous ordering.

## Operator-assisted operations

The carrier lifecycle operations `in`, `inhook`, `releasehook`, `out`, and `outhook` become blocking yarn-change prompts at safe pass boundaries. `pause` becomes a blocking confirmation prompt, using its comment as the instruction when present.

Every carrier named by a lifecycle operation must be declared and used by at least one executable knit pass. This keeps every generated yarn prompt tied to a yarn in the compiled job.

These prompts describe manual AYAB-machine work; they do not claim that the Brother carriage provides Knitout's automated carrier or insertion-hook behavior.

## Parsed but blocked operations

AYAB reports source-line diagnostics and blocks execution for:

- `tuck`, `miss`, `split`, `drop`, `amiss`, and `xfer`
- `rack` and `stitch`
- Back-bed or slider needles (`b`, `fs`, `bs`)
- `x-*` extension opcodes and `;;X-*` headers
- Sparse passes with internal unknitted needles
- More than two yarn choices in one pass
- Multiple or empty carrier sets on an individual knit operation
- Duplicate needles, non-monotonic passes, or non-alternating directions
- Knitout versions other than version 2

AYAB does not silently ignore these operations. Future support should either prove a byte-exact automatic lowering or present a practical, hardware-validated manual action at a safe boundary.

## Needle placement

Knitout needle numbers are translated into AYAB's zero-based bed coordinates at import time:

- `Keep` preserves source indices and requires them to fit the machine.
- `Left` aligns the source's minimum needle with the machine's minimum needle.
- `Center` centers the complete source envelope.
- `Right` aligns the source's maximum needle with the machine's maximum needle.

The `;;Position:` header supplies the initial choice. The import card lets the operator override it. Placement never mirrors the design.

## Recovery identity

Checkpoint identity is derived from the canonical compiled `MachineJob`. The job ID also incorporates the source checksum, compiler version, selected machine profile, placement, and carrier order. A change to any of those inputs creates a different job and cannot resume a stale checkpoint.

## Simulation limitations

The app previews and simulates physical passes and AYAB needle selections. It is not a loop-topology or finished-fabric simulator. It does not model yarn tension, carrier kickbacks, cast-on stability, transfers, racking, or collisions.
