import "jasmine/src/jasmine";
import { machineJobToKnitPlan } from "machine_job/src/MachineJobToKnitPlan";
import { MachineJob } from "machine_job/src/MachineJobTypes";

function job(): MachineJob {
  return {
    formatVersion: "1.0",
    jobId: "plan-test",
    title: "Plan test",
    coordinateSystem: "zeroBasedNeedleIndex",
    requirements: { minNeedle: 8, maxNeedle: 17, maxColors: 2 },
    yarns: [{ id: "a" }, { id: "b" }],
    rows: [
      {
        rowNumber: 1,
        promptsBefore: [],
        passes: [{
          passId: "p1",
          direction: "leftToRight",
          activeNeedles: { left: 8, right: 17 },
          selection: { encoding: "bitmap", offset: 8, bits: "1000000011" },
          yarnIds: ["a", "b"],
          technique: "fairIsle",
          carriage: "knit",
        }],
        promptsAfter: [],
      },
      {
        rowNumber: 2,
        promptsBefore: [],
        passes: [{
          passId: "p2",
          direction: "either",
          activeNeedles: { left: 8, right: 17 },
          selection: { encoding: "indices", indices: [9, 16] },
          yarnIds: ["a", "b"],
          technique: "fairIsle",
        }],
        promptsAfter: [],
      },
    ],
  };
}

describe("machineJobToKnitPlan", () => {
  it("packs bitmap and index selections byte-exactly", () => {
    const result = machineJobToKnitPlan(job());
    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(Array.from(result.plan.passes[0]!.selectionBits)).toEqual([1, 3]);
      expect(Array.from(result.plan.passes[1]!.selectionBits)).toEqual([2, 1]);
      expect(result.plan.passes.map((pass) => pass.direction)).toEqual([
        "leftToRight",
        "rightToLeft",
      ]);
    }
  });

  it("supports changing bounds but rejects multi-pass rows and blocking prompts", () => {
    const value = job();
    value.rows[1]!.passes[0]!.activeNeedles.left = 9;
    value.rows[1]!.passes[0]!.selection = {
      encoding: "indices",
      indices: [9, 16],
    };
    value.rows[0]!.passes.push({ ...value.rows[0]!.passes[0]!, passId: "extra" });
    value.rows[1]!.promptsBefore.push({
      id: "confirm",
      kind: "confirm",
      severity: "warning",
      text: "Confirm shaping",
      acknowledgementRequired: true,
    });
    const result = machineJobToKnitPlan(value);
    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.issues.length).toBe(2);
  });

  it("zero-fills selections outside each shaped pass inside the job envelope", () => {
    const value = job();
    value.rows[1]!.passes[0]!.activeNeedles = { left: 10, right: 15 };
    value.rows[1]!.passes[0]!.selection = {
      encoding: "indices",
      indices: [10, 15],
    };
    const result = machineJobToKnitPlan(value);
    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.plan.leftNeedle).toBe(8);
      expect(result.plan.rightNeedle).toBe(17);
      expect(Array.from(result.plan.passes[1]!.selectionBits)).toEqual([132, 0]);
      expect(result.plan.passes[1]!.activeNeedles).toEqual({ left: 10, right: 15 });
    }
  });

  it("rejects non-alternating explicit directions", () => {
    const value = job();
    value.rows[1]!.passes[0]!.direction = "leftToRight";
    const result = machineJobToKnitPlan(value);
    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.issues[0]!.path.endsWith("direction")).toBeTrue();
  });
});
