import "jasmine/src/jasmine";
import { Preferences } from "app_settings/src/Preferences";
import { InMemoryPreferenceStorage } from "app_settings/src/PreferenceStorage";
import { KnitSession } from "ayab_valdi/src/KnitSession";
import { MachineJob } from "machine_job/src/MachineJobTypes";
import { CommunicationMock } from "serial/src/CommunicationMock";
import { Machine } from "state_machine/src/Machine";

function job(): MachineJob {
  return {
    formatVersion: "1.0",
    jobId: "simulation-golden",
    title: "Simulation golden",
    coordinateSystem: "zeroBasedNeedleIndex",
    requirements: {
      minNeedle: 8,
      maxNeedle: 17,
      maxColors: 2,
      techniques: ["fairIsle"],
      carriageRoles: ["knit"],
    },
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
          direction: "rightToLeft",
          activeNeedles: { left: 8, right: 17 },
          selection: { encoding: "indices", indices: [9, 16] },
          yarnIds: ["a", "b"],
          technique: "fairIsle",
          carriage: "knit",
        }],
        promptsAfter: [],
      },
    ],
  };
}

describe("MachineJob Simulation", () => {
  it("emits golden firmware line data without raster quantization", () => {
    const preferences = new Preferences(new InMemoryPreferenceStorage());
    preferences.machine = Machine.KH910_KH950;
    const result = KnitSession.tryStartMachineJobSimulation({
      job: job(),
      preferences,
    });
    expect(result.ok).toBeTrue();
    if (!result.ok) return;

    const control = result.session.control;
    expect(control.pattern.hasPrepackedSingleBedRows()).toBeTrue();
    expect(control.func_selector()).toBeTrue();
    const lines: Uint8Array[] = [];
    const communication = control.com as CommunicationMock;
    const original = communication.cnfLine.bind(communication);
    communication.cnfLine = (lineNumber, color, flags, lineData) => {
      lines.push(lineData);
      original(lineNumber, color, flags, lineData);
    };

    expect(control.cnf_line_API6(0)).toBeFalse();
    expect(control.cnf_line_API6(1)).toBeTrue();
    expect(Array.from(lines[0]!.slice(0, 4))).toEqual([0x00, 0x01, 0x03, 0x00]);
    expect(Array.from(lines[1]!.slice(0, 4))).toEqual([0x00, 0x02, 0x01, 0x00]);
  });

  it("carries shaped active bounds into the Simulation pattern", () => {
    const value = job();
    value.rows[1]!.passes[0]!.activeNeedles = { left: 10, right: 15 };
    value.rows[1]!.passes[0]!.selection = {
      encoding: "indices",
      indices: [10, 15],
    };
    const result = KnitSession.tryStartMachineJobSimulation({
      job: value,
      preferences: new Preferences(new InMemoryPreferenceStorage()),
    });
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(
      result.session.control.pattern.getPrepackedActiveNeedleBounds(1),
    ).toEqual({ left: 2, right: 7 });
    const control = result.session.control;
    expect(control.func_selector()).toBeTrue();
    const lines: Uint8Array[] = [];
    (control.com as CommunicationMock).cnfLine = (
      _lineNumber,
      _color,
      _flags,
      lineData,
    ) => lines.push(lineData);
    expect(control.cnf_line_API6(0)).toBeFalse();
    expect(control.status.knitStartNeedle).toBe(8);
    expect(control.status.knitNeedleCount).toBe(10);
    expect(control.cnf_line_API6(1)).toBeTrue();
    expect(control.status.knitStartNeedle).toBe(10);
    expect(control.status.knitNeedleCount).toBe(6);
    expect(Array.from(lines[1]!.slice(0, 3))).toEqual([0x00, 0x84, 0x00]);
  });

  it("starts a resumed simulation at the saved pass offset", () => {
    const result = KnitSession.tryStartMachineJobSimulation({
      job: job(),
      preferences: new Preferences(new InMemoryPreferenceStorage()),
      startPassIndex: 1,
    });
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    const control = result.session.control;
    expect(control.pattern.pattern.height).toBe(1);
    expect(control.func_selector()).toBeTrue();
    let resumedLine: Uint8Array | undefined;
    const communication = control.com as CommunicationMock;
    communication.cnfLine = (_lineNumber, _color, _flags, lineData) => {
      resumedLine = lineData;
    };
    expect(control.cnf_line_API6(0)).toBeTrue();
    expect(Array.from(resumedLine!.slice(0, 4))).toEqual([
      0x00, 0x02, 0x01, 0x00,
    ]);
  });

  it("pauses for before/after operator prompts in boundary order", async () => {
    const value = job();
    value.rows = [value.rows[0]!];
    value.rows[0]!.promptsBefore.push({
      id: "shape-before",
      kind: "shape",
      severity: "warning",
      text: "Decrease one stitch at each edge.",
      acknowledgementRequired: true,
    });
    value.rows[0]!.promptsAfter.push({
      id: "manual-after",
      kind: "manualAction",
      severity: "warning",
      text: "Transfer the edge stitches.",
      acknowledgementRequired: true,
    });
    const result = KnitSession.tryStartMachineJobSimulation({
      job: value,
      preferences: new Preferences(new InMemoryPreferenceStorage()),
    });
    expect(result.ok).toBeTrue();
    if (!result.ok) return;

    const events: string[] = [];
    await result.session.run({
      onStatusVersion: () => undefined,
      isDestroyed: () => false,
      onOperatorPrompt: async (prompt, timing, passIndex) => {
        events.push(`${timing}:${passIndex}:${prompt.id}`);
      },
    });
    expect(events).toEqual([
      "before:0:shape-before",
      "after:0:manual-after",
    ]);
  });

  it("resumes a knitted pass at after-prompts without knitting it twice", async () => {
    const value = job();
    value.rows = [value.rows[0]!];
    value.rows[0]!.promptsBefore.push({
      id: "before",
      kind: "confirm",
      severity: "warning",
      text: "Before",
      acknowledgementRequired: true,
    });
    value.rows[0]!.promptsAfter.push({
      id: "after",
      kind: "manualAction",
      severity: "warning",
      text: "After",
      acknowledgementRequired: true,
    });
    const result = KnitSession.tryStartMachineJobSimulation({
      job: value,
      preferences: new Preferences(new InMemoryPreferenceStorage()),
      startPassIndex: 0,
      resumePendingAfterPass: true,
      acknowledgedPromptIds: ["before"],
    });
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    const events: string[] = [];
    await result.session.run({
      onStatusVersion: () => undefined,
      isDestroyed: () => false,
      onPassKnitted: () => { events.push("knitted-again"); },
      onOperatorPrompt: (prompt, timing) => { events.push(`${timing}:${prompt.id}`); },
      onPassCompleted: () => { events.push("completed"); },
    });
    expect(events).toEqual(["after:after", "completed"]);
  });
});
