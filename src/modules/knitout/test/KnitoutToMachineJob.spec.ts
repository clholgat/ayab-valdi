import "jasmine/src/jasmine";
import { MachineCapabilities } from "machine_job/src/MachineCapabilities";
import { machineJobIdentity } from "machine_job/src/MachineJobChecksum";
import { machineJobToKnitPlan } from "machine_job/src/MachineJobToKnitPlan";
import { validateMachineJob } from "machine_job/src/ParseMachineJob";
import { inspectKnitout } from "knitout/src/InspectKnitout";
import { knitoutToMachineJob } from "knitout/src/KnitoutToMachineJob";
import { parseKnitout } from "knitout/src/ParseKnitout";

function machine(maxNeedle: number = 199): MachineCapabilities {
  return {
    profileId: `test-${maxNeedle}`,
    displayName: "Test Brother machine",
    minNeedle: 0,
    maxNeedle,
    maxColorsPerPass: 2,
    selectionEncodings: ["bitmap", "indices"],
    directions: ["leftToRight", "rightToLeft"],
    techniques: ["stockinette", "fairIsle"],
    carriageRoles: ["knit"],
    accessories: [],
  };
}

function compile(text: string, placement: "keep" | "left" | "center" | "right" = "left") {
  const parsed = parseKnitout(text);
  if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message);
  return knitoutToMachineJob(parsed.document, {
    machine: machine(),
    fileName: "test.k",
    placement,
  });
}

describe("knitoutToMachineJob", () => {
  const twoColor = `;!knitout-2
;;Carriers: dark light
knit + f10 dark
knit + f11 light
knit + f12 dark
knit + f13 light
knit - f13 light
knit - f12 dark
knit - f11 light
knit - f10 dark
`;

  it("compiles alternating fair-isle passes with documented selection semantics", () => {
    const result = compile(twoColor);
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.job.requirements).toEqual({
      minNeedle: 0,
      maxNeedle: 3,
      maxColors: 2,
      techniques: ["fairIsle"],
      carriageRoles: ["knit"],
    });
    expect(result.job.rows[0]!.passes[0]!.selection).toEqual({
      encoding: "bitmap",
      offset: 0,
      bits: "1010",
    });
    expect(result.job.rows[1]!.passes[0]!.selection).toEqual({
      encoding: "bitmap",
      offset: 0,
      bits: "1010",
    });
    expect(validateMachineJob(result.job).ok).toBeTrue();
    expect(machineJobToKnitPlan(result.job).ok).toBeTrue();
  });

  it("supports keep, left, center, and right placement", () => {
    const onePass = `;!knitout-2
;;Carriers: A
knit + f10 A
knit + f11 A
`;
    const kept = compile(onePass, "keep");
    const left = compile(onePass, "left");
    const center = compile(onePass, "center");
    const right = compile(onePass, "right");
    expect(kept.ok && kept.job.requirements.minNeedle).toBe(10);
    expect(left.ok && left.job.requirements.minNeedle).toBe(0);
    expect(center.ok && center.job.requirements.minNeedle).toBe(99);
    expect(right.ok && right.job.requirements.minNeedle).toBe(198);
  });

  it("makes compiled identity sensitive to placement and carrier mapping", () => {
    const left = compile(twoColor, "left");
    const right = compile(twoColor, "right");
    expect(left.ok).toBeTrue();
    expect(right.ok).toBeTrue();
    if (!left.ok || !right.ok) return;
    expect(left.job.jobId).not.toBe(right.job.jobId);
    expect(machineJobIdentity(left.job.jobId, left.canonicalText)).not.toEqual(
      machineJobIdentity(right.job.jobId, right.canonicalText),
    );

    const parsed = parseKnitout(twoColor);
    if (!parsed.ok) return;
    const swapped = knitoutToMachineJob(parsed.document, {
      machine: machine(),
      placement: "left",
      carrierOrder: ["light", "dark"],
    });
    expect(swapped.ok).toBeTrue();
    if (swapped.ok) expect(swapped.job.jobId).not.toBe(left.job.jobId);
  });

  it("returns source-line compatibility issues before MachineJob execution", () => {
    const inspected = inspectKnitout(`;!knitout-2
;;Carriers: A
knit + b1 A
`, { machine: machine(), fileName: "bad.k" });
    expect(inspected.ok).toBeTrue();
    if (!inspected.ok) return;
    expect(inspected.compilation.ok).toBeFalse();
    if (!inspected.compilation.ok) {
      expect(inspected.compilation.diagnostics[0]!.code).toBe("unsupportedBed");
      expect(inspected.compilation.diagnostics[0]!.line).toBe(3);
    }
  });

  it("blocks keep placement outside the selected machine", () => {
    const inspected = inspectKnitout(`;!knitout-2
;;Carriers: A
;;Position: Keep
knit + f200 A
`, { machine: machine(), fileName: "wide.k" });
    expect(inspected.ok).toBeTrue();
    if (inspected.ok && !inspected.compilation.ok) {
      expect(inspected.compilation.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
        "keepPlacementOutOfBounds",
      );
    } else {
      fail("Expected compilation to be blocked.");
    }
  });

  it("retains non-blocking parser warnings in inspection diagnostics", () => {
    const inspected = inspectKnitout(
      ";!knitout-2\r\n;;Carriers: A\r\nknit + f1 A\r\n",
      { machine: machine(), fileName: "crlf.k" },
    );
    expect(inspected.ok).toBeTrue();
    if (!inspected.ok) return;
    expect(inspected.compilation.ok).toBeTrue();
    expect(inspected.compilation.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "nonStandardLineEnding",
    );
  });
});
