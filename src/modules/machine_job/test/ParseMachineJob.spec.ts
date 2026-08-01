import "jasmine/src/jasmine";
import { parseMachineJob, validateMachineJob } from "machine_job/src/ParseMachineJob";

function validJob(): any {
  return {
    formatVersion: "1.0",
    jobId: "golden-fixed-two-color",
    title: "Fixed two-color swatch",
    coordinateSystem: "zeroBasedNeedleIndex",
    requirements: { minNeedle: 0, maxNeedle: 3, maxColors: 2, techniques: ["fairIsle"] },
    yarns: [{ id: "light" }, { id: "dark" }],
    rows: [{
      rowNumber: 1,
      promptsBefore: [],
      passes: [{
        passId: "row-1-pass-1",
        direction: "leftToRight",
        activeNeedles: { left: 0, right: 3 },
        selection: { encoding: "bitmap", offset: 0, bits: "1010" },
        yarnIds: ["light", "dark"],
        technique: "fairIsle",
      }],
      promptsAfter: [],
    }],
  };
}

describe("parseMachineJob", () => {
  it("accepts the minimal fixed-width two-color contract", () => {
    const result = validateMachineJob(validJob());
    expect(result.ok).toBeTrue();
    if (result.ok) expect(result.job.rows[0]!.passes[0]!.passId).toBe("row-1-pass-1");
  });

  it("accepts shaped rows and structured prompts", () => {
    const job = validJob();
    job.rows[0].promptsBefore.push({
      id: "shape-row-1",
      kind: "shape",
      severity: "warning",
      text: "Decrease one stitch at each edge.",
      acknowledgementRequired: true,
    });
    job.rows[0].passes[0].activeNeedles = { left: 1, right: 2 };
    job.rows[0].passes[0].selection = { encoding: "indices", indices: [1] };
    expect(validateMachineJob(job).ok).toBeTrue();
  });

  it("rejects malformed JSON", () => {
    expect(parseMachineJob("{not-json")).toEqual({
      ok: false,
      issues: [{ path: "$", message: "is not valid JSON" }],
    });
  });

  it("rejects unsupported versions and duplicate stable IDs", () => {
    const job = validJob();
    job.formatVersion = "2.0";
    job.rows.push({ ...job.rows[0], rowNumber: 2 });
    const result = validateMachineJob(job);
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.issues.some((entry) => entry.path === "$.formatVersion")).toBeTrue();
      expect(result.issues.some((entry) => entry.message.includes("duplicate pass ID"))).toBeTrue();
    }
  });

  it("rejects inverted bounds, bad bitmaps, and unknown yarns", () => {
    const job = validJob();
    job.rows[0].passes[0].activeNeedles = { left: 4, right: -4 };
    job.rows[0].passes[0].selection.bits = "10x0";
    job.rows[0].passes[0].yarnIds = ["missing"];
    const result = validateMachineJob(job);
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.issues.some((entry) => entry.path.endsWith("activeNeedles"))).toBeTrue();
      expect(result.issues.some((entry) => entry.path.endsWith("selection.bits"))).toBeTrue();
      expect(result.issues.some((entry) => entry.path.endsWith("yarnIds[0]"))).toBeTrue();
    }
  });

  it("rejects selections outside the declared and active bounds", () => {
    const job = validJob();
    job.rows[0].passes[0].activeNeedles = { left: -1, right: 3 };
    job.rows[0].passes[0].selection = {
      encoding: "indices",
      indices: [-2, -2],
    };
    const result = validateMachineJob(job);
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.issues.some((entry) => entry.message.includes("requirement bounds"))).toBeTrue();
      expect(result.issues.some((entry) => entry.message.includes("duplicates"))).toBeTrue();
      expect(result.issues.some((entry) => entry.message.includes("active needles"))).toBeTrue();
    }
  });

  it("rejects negative coordinates in the zero-based coordinate system", () => {
    const job = validJob();
    job.requirements.minNeedle = -1;
    const result = validateMachineJob(job);
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(
        result.issues.some((entry) =>
          entry.message.includes("zeroBasedNeedleIndex"),
        ),
      ).toBeTrue();
    }
  });
});
