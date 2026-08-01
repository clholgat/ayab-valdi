import "jasmine/src/jasmine";
import { inspectMachineJob } from "machine_job/src/InspectMachineJob";
import { MachineCapabilities } from "machine_job/src/MachineCapabilities";

function machine(maxNeedle: number): MachineCapabilities {
  return {
    profileId: "inspection-test",
    displayName: "Inspection test machine",
    minNeedle: 0,
    maxNeedle,
    maxColorsPerPass: 2,
    selectionEncodings: ["bitmap"],
    directions: ["leftToRight", "rightToLeft"],
    techniques: ["fairIsle"],
    carriageRoles: ["knit"],
    accessories: [],
  };
}

function jobJson(): string {
  return JSON.stringify({
    formatVersion: "1.0",
    jobId: "inspect-job",
    title: "Inspection job",
    coordinateSystem: "zeroBasedNeedleIndex",
    requirements: {
      minNeedle: 0,
      maxNeedle: 3,
      maxColors: 2,
      techniques: ["fairIsle"],
    },
    yarns: [{ id: "a" }, { id: "b" }],
    rows: [
      {
        rowNumber: 1,
        promptsBefore: [],
        passes: [
          {
            passId: "pass-1",
            direction: "leftToRight",
            activeNeedles: { left: 0, right: 3 },
            selection: { encoding: "bitmap", offset: 0, bits: "1010" },
            yarnIds: ["a", "b"],
            technique: "fairIsle",
            carriage: "knit",
          },
        ],
        promptsAfter: [],
      },
    ],
  });
}

describe("inspectMachineJob", () => {
  it("returns a compatible read-only inspection", () => {
    const result = inspectMachineJob(jobJson(), machine(199));
    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.job.jobId).toBe("inspect-job");
      expect(result.preflight.compatible).toBeTrue();
      expect(result.preflight.summary.logicalRows).toBe(1);
    }
  });

  it("keeps structurally valid but incompatible jobs inspectable", () => {
    const result = inspectMachineJob(jobJson(), machine(2));
    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.preflight.compatible).toBeFalse();
      expect(result.preflight.issues[0]!.code).toBe("needleBounds");
    }
  });

  it("stops at structural validation for malformed imports", () => {
    const result = inspectMachineJob("{}", machine(199));
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.stage).toBe("structure");
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });
});
