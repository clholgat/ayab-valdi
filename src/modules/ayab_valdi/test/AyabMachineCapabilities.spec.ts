import "jasmine/src/jasmine";
import { ayabMachineCapabilities } from "ayab_valdi/src/AyabMachineCapabilities";
import { Mode } from "constants/src/StateMachineConstants";
import { preflightMachineJob } from "machine_job/src/PreflightMachineJob";
import { MachineJob } from "machine_job/src/MachineJobTypes";
import { Machine } from "state_machine/src/Machine";

function edgeJob(maxNeedle: number): MachineJob {
  return {
    formatVersion: "1.0",
    jobId: `edge-${maxNeedle}`,
    title: "Machine edge test",
    coordinateSystem: "zeroBasedNeedleIndex",
    requirements: {
      minNeedle: 0,
      maxNeedle,
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
            direction: "either",
            activeNeedles: { left: 0, right: maxNeedle },
            selection: {
              encoding: "indices",
              indices: [0, maxNeedle],
            },
            yarnIds: ["a", "b"],
            technique: "fairIsle",
            carriage: "knit",
          },
        ],
        promptsAfter: [],
      },
    ],
  };
}

describe("ayabMachineCapabilities", () => {
  it("maps 200-needle machines to zero-based indices 0..199", () => {
    const capabilities = ayabMachineCapabilities({
      machine: Machine.KH910_KH950,
      mode: Mode.SINGLEBED,
      numColors: 2,
    });
    expect(capabilities.minNeedle).toBe(0);
    expect(capabilities.maxNeedle).toBe(199);
    expect(preflightMachineJob(edgeJob(199), capabilities).compatible).toBeTrue();
  });

  it("maps KH-270 to zero-based indices 0..111", () => {
    const capabilities = ayabMachineCapabilities({
      machine: Machine.KH270,
      mode: Mode.SINGLEBED,
      numColors: 2,
    });
    expect(capabilities.maxNeedle).toBe(111);
    const result = preflightMachineJob(edgeJob(199), capabilities);
    expect(result.compatible).toBeFalse();
    expect(result.issues.some((entry) => entry.code === "needleBounds")).toBeTrue();
  });

  it("reports ribber capabilities only for a selected ribber mode", () => {
    const singleBed = ayabMachineCapabilities({
      machine: Machine.KH910_KH950,
      mode: Mode.SINGLEBED,
      numColors: 2,
    });
    const ribber = ayabMachineCapabilities({
      machine: Machine.KH910_KH950,
      mode: Mode.CLASSIC_RIBBER,
      numColors: 3,
    });
    expect(singleBed.accessories).toEqual([]);
    expect(singleBed.carriageRoles).toEqual(["knit"]);
    expect(ribber.accessories).toEqual(["ribber"]);
    expect(ribber.carriageRoles).toEqual(["knit", "ribber"]);
    expect(ribber.maxColorsPerPass).toBe(3);
  });
});
