import "jasmine/src/jasmine";
import { MachineCapabilities } from "machine_job/src/MachineCapabilities";
import {
  preflightMachineJob,
  summarizeMachineJob,
} from "machine_job/src/PreflightMachineJob";
import { MachineJob } from "machine_job/src/MachineJobTypes";

function capableMachine(): MachineCapabilities {
  return {
    profileId: "test-200-needle",
    displayName: "Test 200-needle machine",
    minNeedle: 0,
    maxNeedle: 199,
    maxColorsPerPass: 2,
    selectionEncodings: ["bitmap", "indices"],
    directions: ["leftToRight", "rightToLeft"],
    techniques: ["fairIsle", "stockinette"],
    carriageRoles: ["knit"],
    accessories: [],
  };
}

function validJob(): MachineJob {
  return {
    formatVersion: "1.0",
    jobId: "preflight-job",
    title: "Preflight job",
    coordinateSystem: "zeroBasedNeedleIndex",
    requirements: {
      minNeedle: 0,
      maxNeedle: 3,
      maxColors: 2,
      techniques: ["fairIsle"],
      carriageRoles: ["knit"],
    },
    yarns: [{ id: "light" }, { id: "dark" }],
    rows: [
      {
        rowNumber: 1,
        promptsBefore: [
          {
            id: "ready",
            kind: "confirm",
            severity: "info",
            text: "Ready?",
            acknowledgementRequired: true,
          },
        ],
        passes: [
          {
            passId: "pass-1",
            direction: "leftToRight",
            activeNeedles: { left: 0, right: 3 },
            selection: { encoding: "bitmap", offset: 0, bits: "1010" },
            yarnIds: ["light", "dark"],
            technique: "fairIsle",
            carriage: "knit",
          },
        ],
        promptsAfter: [],
      },
    ],
  };
}

describe("preflightMachineJob", () => {
  it("accepts a job supported by the selected machine", () => {
    const result = preflightMachineJob(validJob(), capableMachine());
    expect(result.compatible).toBeTrue();
    expect(result.issues).toEqual([]);
  });

  it("summarizes logical rows separately from passes", () => {
    const job = validJob();
    job.rows[0]!.passes.push({
      ...job.rows[0]!.passes[0]!,
      passId: "pass-2",
      direction: "rightToLeft",
    });
    expect(summarizeMachineJob(job)).toEqual({
      logicalRows: 1,
      passes: 2,
      yarns: 2,
      prompts: 1,
      minNeedle: 0,
      maxNeedle: 3,
    });
  });

  it("reports requirement mismatches before execution", () => {
    const job = validJob();
    job.requirements = {
      minNeedle: -1,
      maxNeedle: 200,
      maxColors: 3,
      techniques: ["lace"],
      carriageRoles: ["lace"],
      accessories: ["ribber"],
    };
    const result = preflightMachineJob(job, capableMachine());
    expect(result.compatible).toBeFalse();
    expect(result.issues.map((entry) => entry.code)).toEqual([
      "needleBounds",
      "colorCapacity",
      "technique",
      "carriageRole",
      "accessory",
    ]);
  });

  it("reports actionable row and pass context for pass mismatches", () => {
    const job = validJob();
    const pass = job.rows[0]!.passes[0]!;
    pass.activeNeedles = { left: -1, right: 3 };
    pass.yarnIds.push("third");
    pass.selection = { encoding: "indices", indices: [1] };
    pass.direction = "rightToLeft";
    pass.technique = "lace";
    pass.carriage = "lace";
    const machine = capableMachine();
    machine.selectionEncodings = ["bitmap"];
    machine.directions = ["leftToRight"];

    const result = preflightMachineJob(job, machine);
    expect(result.compatible).toBeFalse();
    expect(result.issues.length).toBe(6);
    for (const entry of result.issues) {
      expect(entry.rowNumber).toBe(1);
      expect(entry.passId).toBe("pass-1");
    }
  });

  it("allows 'either' direction when the runtime can choose a direction", () => {
    const job = validJob();
    job.rows[0]!.passes[0]!.direction = "either";
    const machine = capableMachine();
    machine.directions = ["leftToRight"];
    expect(preflightMachineJob(job, machine).compatible).toBeTrue();
  });
});
