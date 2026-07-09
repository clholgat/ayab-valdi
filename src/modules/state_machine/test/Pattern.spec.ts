import "jasmine/src/jasmine";
import { Alignment } from "constants/src/StateMachineConstants";
import { Machine } from "state_machine/src/Machine";
import { Pattern, PatternImage } from "state_machine/src/Pattern";

function solidRow(width: number, pixel: Uint8Array): Uint8Array[] {
  const row: Uint8Array[] = [];
  for (let i = 0; i < width; i++) {
    row.push(pixel);
  }
  return row;
}

function makePattern(width: number, height: number): Pattern {
  const black = new Uint8Array([0, 0, 0, 255]);
  const white = new Uint8Array([255, 255, 255, 255]);
  const rows: Uint8Array[][] = [solidRow(width, black)];
  for (let r = 1; r < height; r++) {
    rows.push(solidRow(width, white));
  }
  return new Pattern(new PatternImage(rows, width, height, 2), 2);
}

function bitIsSet(data: Uint8Array, bitIndex: number): boolean {
  return ((data[Math.floor(bitIndex / 8)]! >> (bitIndex % 8)) & 1) !== 0;
}

describe("Pattern", () => {
  it("calcPatStartEndNeedles left-aligns to knit window start", () => {
    const pattern = makePattern(40, 3);
    pattern.alignment = Alignment.LEFT;
    pattern.knitStartNeedle = 10;
    pattern.knitEndNeedle = 110;
    pattern.calcPatStartEndNeedles();
    expect(pattern.startNeedle).toBe(10);
    expect(pattern.endNeedle).toBe(50);
  });

  it("calcPatStartEndNeedles centers pattern in knit window", () => {
    const pattern = makePattern(40, 3);
    pattern.alignment = Alignment.CENTER;
    pattern.knitStartNeedle = 10;
    pattern.knitEndNeedle = 110;
    pattern.calcPatStartEndNeedles();
    expect(pattern.startNeedle).toBe(40);
    expect(pattern.endNeedle).toBe(80);
  });

  it("calcPatStartEndNeedles right-aligns to knit window end", () => {
    const pattern = makePattern(40, 3);
    pattern.alignment = Alignment.RIGHT;
    pattern.knitStartNeedle = 10;
    pattern.knitEndNeedle = 110;
    pattern.calcPatStartEndNeedles();
    expect(pattern.startNeedle).toBe(70);
    expect(pattern.endNeedle).toBe(110);
  });

  it("calcImageStartNeedle matches alignment math used by preview", () => {
    expect(
      Pattern.calcImageStartNeedle(Alignment.LEFT, 10, 110, 40),
    ).toBe(10);
    expect(
      Pattern.calcImageStartNeedle(Alignment.RIGHT, 10, 110, 40),
    ).toBe(70);
    expect(
      Pattern.calcImageStartNeedle(Alignment.CENTER, 10, 110, 40),
    ).toBe(40);
  });

  it("processPatternData extracts center section when image exceeds machine width", () => {
    const machineWidth = Machine.width(Machine.KH910_KH950);
    const white = new Uint8Array([255, 255, 255, 255]);
    const black = new Uint8Array([0, 0, 0, 255]);
    const row = solidRow(250, white);
    row[25] = black;
    const image = new PatternImage([row], 250, 1, 2);
    const pattern = new Pattern(image, 2);
    pattern.processPatternData(machineWidth, 2, 0, machineWidth - 1);

    const bytesPerRow = Math.ceil(machineWidth / 8);
    expect(pattern.patternExpanded.length).toBe(2 * bytesPerRow);
    expect(
      bitIsSet(pattern.patternExpanded.subarray(bytesPerRow, bytesPerRow * 2), 0),
    ).toBe(true);
  });

  it("processPatternData maps dark and light pixels to color planes", () => {
    const pattern = makePattern(8, 1);
    pattern.processPatternData(200, 2, 0, 7);
    const bytesPerRow = Math.ceil(8 / 8);

    const color0Row = pattern.patternExpanded.subarray(0, bytesPerRow);
    const color1Row = pattern.patternExpanded.subarray(bytesPerRow, bytesPerRow * 2);

    for (let i = 0; i < 8; i++) {
      expect(bitIsSet(color0Row, i)).toBe(false);
      expect(bitIsSet(color1Row, i)).toBe(true);
    }
  });
});
