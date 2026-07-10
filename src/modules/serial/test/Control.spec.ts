import "jasmine/src/jasmine";
import { Alignment, Mode, Operation } from "constants/src/StateMachineConstants";
import { BLOCK_LENGTH, Token } from "constants/src/SerialConstants";
import { Machine } from "state_machine/src/Machine";
import { Pattern, PatternImage } from "state_machine/src/Pattern";
import { Carriage, Direction } from "state_machine/src/Status";
import { Preferences } from "app_settings/src/Preferences";
import { Control } from "serial/src/Control";
import { CommunicationMock } from "serial/src/CommunicationMock";

function solidRow(width: number, pixel: Uint8Array): Uint8Array[] {
  const row: Uint8Array[] = [];
  for (let i = 0; i < width; i++) {
    row.push(pixel);
  }
  return row;
}

function makeLeftAlignedPattern(width: number, height: number): Pattern {
  const black = new Uint8Array([0, 0, 0, 255]);
  const white = new Uint8Array([255, 255, 255, 255]);
  const imageRows = [solidRow(width, black)];
  for (let r = 1; r < height; r++) {
    imageRows.push(solidRow(width, white));
  }
  const image = new PatternImage(imageRows, width, height, 2);
  const pattern = new Pattern(image, 2);
  pattern.alignment = Alignment.LEFT;
  pattern.knitStartNeedle = 0;
  pattern.knitEndNeedle = width;
  pattern.calcPatStartEndNeedles();
  pattern.processPatternData(Machine.width(Machine.KH910_KH950), 2, 0, width - 1);
  return pattern;
}

describe("Control.select_needles_API6", () => {
  it("selects left-aligned 40px row for singlebed", () => {
    const pattern = makeLeftAlignedPattern(40, 3);
    expect(pattern.startNeedle).toBe(0);
    expect(pattern.endNeedle).toBe(40);

    const control = new Control();
    control.machine = Machine.KH910_KH950;
    control.mode = Mode.SINGLEBED;
    control.num_colors = 2;
    control.start_row = 0;
    control.pattern = pattern;
    control.start_needle = 0;
    control.end_needle = 40;
    control.start_pixel = 0;
    control.end_pixel = 40;

    const bits = control.select_needles_API6(0, 0, false);
    expect(Array.from(bits.slice(0, 5))).toEqual([0, 0, 0, 0, 0]);

    const blackPass = control.select_needles_API6(1, 1, false);
    expect(Array.from(blackPass.slice(0, 5))).toEqual([255, 255, 255, 255, 255]);
    expect(bits.length).toBe(25);
  });

  it("reads correct needle bits for row 1+ when the source image is wider than the machine", () => {
    // Image is wider than the machine (250 > 200), so processPatternData()
    // center-crops to a narrower extractedWidth when packing patternExpanded.
    // Row 0 is white (not selected in the black/color-1 plane), row 1 is solid
    // black (selected everywhere in the needle range). If Pattern.width isn't
    // updated to match the packed width, select_needles_API6's byte-offset
    // math for row 1 reads from the wrong place in patternExpanded.
    const machineWidth = Machine.width(Machine.KH910_KH950); // 200
    const overWidth = 250;
    const white = new Uint8Array([255, 255, 255, 255]);
    const black = new Uint8Array([0, 0, 0, 255]);
    const imageRows = [solidRow(overWidth, white), solidRow(overWidth, black)];
    const image = new PatternImage(imageRows, overWidth, 2, 2);
    const pattern = new Pattern(image, 2);
    pattern.alignment = Alignment.LEFT;
    pattern.knitStartNeedle = 0;
    pattern.knitEndNeedle = machineWidth;
    pattern.calcPatStartEndNeedles();
    pattern.processPatternData(machineWidth, 2, 0, machineWidth - 1);

    // processPatternData must record the width it actually packed
    // patternExpanded with, not the raw (wider) source image width.
    expect(pattern.width).toBe(machineWidth);

    const control = new Control();
    control.machine = Machine.KH910_KH950;
    control.mode = Mode.SINGLEBED;
    control.num_colors = 2;
    control.pattern = pattern;
    control.start_needle = 0;
    control.end_needle = machineWidth;
    control.start_pixel = 0;
    control.end_pixel = machineWidth;

    // expandedRowIndex = numColors * patRow + color -> row 1 (black), color 1 = index 3
    const blackRowBits = control.select_needles_API6(1, 3, false);
    for (let i = 0; i < machineWidth; i++) {
      expect(((blackRowBits[Math.floor(i / 8)]! >> (i % 8)) & 1) !== 0).toBe(
        true,
      );
    }

    // row 0 (white), color 1 = index 1 -> nothing selected in the black plane
    const whiteRowBits = control.select_needles_API6(1, 1, false);
    for (let i = 0; i < machineWidth; i++) {
      expect(((whiteRowBits[Math.floor(i / 8)]! >> (i % 8)) & 1) !== 0).toBe(
        false,
      );
    }
  });

  it("sets flanking needles for ribber color 0", () => {
    const pattern = makeLeftAlignedPattern(20, 1);
    const control = new Control();
    control.machine = Machine.KH910_KH950;
    control.mode = Mode.CLASSIC_RIBBER;
    control.num_colors = 2;
    control.pattern = pattern;
    control.start_needle = 10;
    control.end_needle = 30;
    control.start_pixel = 0;
    control.end_pixel = 20;

    const bits = control.select_needles_API6(0, 0, true);
    for (let i = 0; i < 10; i++) {
      expect(((bits[Math.floor(i / 8)]! >> (i % 8)) & 1) !== 0).toBe(true);
    }
    for (let i = 30; i < 200; i++) {
      expect(((bits[Math.floor(i / 8)]! >> (i % 8)) & 1) !== 0).toBe(true);
    }
  });

  it("func_selector rejects invalid color count for singlebed", () => {
    const control = new Control();
    control.mode = Mode.SINGLEBED;
    control.num_colors = 3;
    expect(control.func_selector()).toBe(false);
  });

  it("func_selector binds singlebed mode func", () => {
    const control = new Control();
    control.mode = Mode.SINGLEBED;
    control.num_colors = 2;
    expect(control.func_selector()).toBe(true);
    expect(control.mode_func).toBeDefined();
  });
});

type CnfLineCall = {
  lineNumber: number;
  color: number;
  flags: number;
  lineData: Uint8Array;
};

function trackCnfLine(comm: CommunicationMock): {
  calls: CnfLineCall[];
  restore: () => void;
} {
  const calls: CnfLineCall[] = [];
  const original = comm.cnfLine.bind(comm);
  comm.cnfLine = (
    lineNumber: number,
    color: number,
    flags: number,
    lineData: Uint8Array,
  ) => {
    calls.push({ lineNumber, color, flags, lineData });
    original(lineNumber, color, flags, lineData);
  };
  return {
    calls,
    restore: () => {
      comm.cnfLine = original;
    },
  };
}

function makeKnitControl(patternHeight: number = 3): Control {
  const pattern = makeLeftAlignedPattern(40, patternHeight);
  const control = new Control();
  control.start(
    pattern,
    {
      machine: Machine.KH910_KH950,
      num_colors: 2,
      start_row: 0,
      mode: Mode.SINGLEBED,
      inf_repeat: false,
      continuous_reporting: true,
      prefs: new Preferences(),
      portname: "Simulation",
    },
    Operation.KNIT,
  );
  control.func_selector();
  control.initial_carriage = Carriage.Knit;
  control.initial_direction = Direction.Right;
  control.initial_position = 0;
  return control;
}

describe("Control.cnf_line_API6", () => {
  it("sends cnfLine and updates status for sequential lines", () => {
    const control = makeKnitControl(3);
    const tracker = trackCnfLine(control.com as CommunicationMock);

    expect(control.cnf_line_API6(0)).toBe(false);
    expect(tracker.calls.length).toBe(1);
    expect(tracker.calls[0]!.lineNumber).toBe(0);
    expect(control.status.currentRow).toBe(1);
    expect(control.status.lineNumber).toBe(0);
    expect(control.status.totalRows).toBe(3);

    expect(control.cnf_line_API6(1)).toBe(false);
    expect(tracker.calls.length).toBe(2);
    expect(control.status.currentRow).toBe(2);
    tracker.restore();
  });

  it("returns true on last pattern row when not repeating", () => {
    const control = makeKnitControl(3);
    expect(control.cnf_line_API6(0)).toBe(false);
    expect(control.cnf_line_API6(1)).toBe(false);
    expect(control.cnf_line_API6(2)).toBe(true);
  });

  it("continues knitting when inf_repeat is enabled", () => {
    const control = makeKnitControl(3);
    control.inf_repeat = true;
    expect(control.cnf_line_API6(0)).toBe(false);
    expect(control.cnf_line_API6(1)).toBe(false);
    expect(control.cnf_line_API6(2)).toBe(false);
    expect(control.pattern_repeats).toBe(1);
  });

  it("stops knitting when line_number is out of range", () => {
    const control = makeKnitControl(3);
    expect(control.cnf_line_API6(BLOCK_LENGTH)).toBe(true);
  });

  it("stops knitting when line sequence jumps", () => {
    const control = makeKnitControl(3);
    expect(control.cnf_line_API6(0)).toBe(false);
    expect(control.cnf_line_API6(2)).toBe(true);
  });

  it("stop sends quit before closing the simulation port", () => {
    const control = makeKnitControl(3);
    const com = control.com as CommunicationMock;
    com.openSerial("Simulation");
    com.reqStart(0, 10, false, true);
    com.update_API6(); // cnfStart
    expect(com.update_API6()[1]).toBe(Token.reqLine);
    control.stop();
    expect(com.isOpen()).toBe(false);
    // After quit, a fresh open can start knitting again.
    com.openSerial("Simulation");
    com.reqInit(Machine.KH910_KH950);
    expect(com.update_API6()[1]).toBe(Token.cnfInit);
  });
});
