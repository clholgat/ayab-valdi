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

  it("supports changing bounds, blocking prompts, and multi-pass rows", () => {
    const value = job();
    value.rows[1]!.passes[0]!.activeNeedles.left = 9;
    value.rows[1]!.passes[0]!.selection = {
      encoding: "indices",
      indices: [9, 16],
    };
    value.rows[0]!.passes.push({
      ...value.rows[0]!.passes[0]!,
      passId: "extra",
      direction: "rightToLeft",
    });
    value.rows[1]!.promptsBefore.push({
      id: "confirm",
      kind: "confirm",
      severity: "warning",
      text: "Confirm shaping",
      acknowledgementRequired: true,
    });
    const result = machineJobToKnitPlan(value);
    expect(result.ok).toBeTrue();
    if (result.ok) expect(result.plan.passes.length).toBe(3);
  });

  it("schedules every supported operator prompt at its pass boundary", () => {
    const value = job();
    value.rows[0]!.promptsBefore.push({
      id: "shape-before",
      kind: "shape",
      severity: "warning",
      text: "Decrease one stitch at each edge.",
      acknowledgementRequired: true,
    });
    value.rows[0]!.promptsAfter.push({
      id: "yarn-after",
      kind: "yarnChange",
      severity: "critical",
      text: "Change to yarn B.",
      acknowledgementRequired: true,
      yarnId: "b",
    });
    const result = machineJobToKnitPlan(value);
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.plan.passes[0]!.promptsBefore.map((prompt) => prompt.id)).toEqual([
      "shape-before",
    ]);
    expect(result.plan.passes[0]!.promptsAfter.map((prompt) => prompt.id)).toEqual([
      "yarn-after",
    ]);
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

  it("plans ribber techniques, carriage roles, accessories, and multiple physical passes", () => {
    const value = job();
    value.requirements.techniques = ["classicRibber"];
    value.requirements.carriageRoles = ["ribber"];
    value.requirements.accessories = ["ribber"];
    value.rows = [value.rows[0]!];
    value.rows[0]!.passes[0]!.technique = "classicRibber";
    value.rows[0]!.passes[0]!.carriage = "ribber";
    value.rows[0]!.passes.push({
      ...value.rows[0]!.passes[0]!,
      passId: "p1-back-bed",
      direction: "rightToLeft",
      yarnIds: ["a"],
    });
    value.rows[0]!.promptsBefore.push({
      id: "install-ribber",
      kind: "carriageChange",
      severity: "warning",
      text: "Install the ribber carriage.",
      acknowledgementRequired: true,
      carriage: "ribber",
    });
    value.rows[0]!.promptsAfter.push({
      id: "row-done",
      kind: "confirm",
      severity: "info",
      text: "Ribber row complete.",
      acknowledgementRequired: false,
    });

    const result = machineJobToKnitPlan(value);
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.plan.accessories).toEqual(["ribber"]);
    expect(result.plan.passes.map((pass) => ({
      technique: pass.technique,
      carriage: pass.carriage,
      yarnIds: pass.yarnIds,
    }))).toEqual([
      { technique: "classicRibber", carriage: "ribber", yarnIds: ["a", "b"] },
      { technique: "classicRibber", carriage: "ribber", yarnIds: ["a"] },
    ]);
    expect(result.plan.passes[0]!.promptsBefore[0]!.id).toBe("install-ribber");
    expect(result.plan.passes[0]!.promptsAfter).toEqual([]);
    expect(result.plan.passes[1]!.promptsBefore).toEqual([]);
    expect(result.plan.passes[1]!.promptsAfter[0]!.id).toBe("row-done");
  });

  it("rejects non-alternating explicit directions", () => {
    const value = job();
    value.rows[1]!.passes[0]!.direction = "leftToRight";
    const result = machineJobToKnitPlan(value);
    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.issues[0]!.path.endsWith("direction")).toBeTrue();
  });
});
