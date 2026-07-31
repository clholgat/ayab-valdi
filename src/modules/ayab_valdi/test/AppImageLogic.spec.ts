import "jasmine/src/jasmine";
import { Machine } from "state_machine/src/Machine";
import { Alignment, Mode } from "constants/src/StateMachineConstants";
import {
  buildRepeatedImageState,
  rowMemosForTransform,
  settingsForLoadedImage,
} from "ayab_valdi/src/AppImageLogic";

function makeBits(rows: number, cols: number): Uint8Array[][] {
  const pixel = new Uint8Array([1]);
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => pixel),
  );
}

describe("buildRepeatedImageState", () => {
  it("scales then tiles source bits and bumps revision", () => {
    const source = makeBits(2, 3);
    const result = buildRepeatedImageState(source, 2, 3, 4, 2, 1);

    expect(result.stretchH).toBe(2);
    expect(result.stretchV).toBe(1);
    expect(result.repeatH).toBe(2);
    expect(result.repeatV).toBe(3);
    expect(result.imageHeight).toBe(6);
    expect(result.imageWidth).toBe(12);
    expect(result.imageBitsRevision).toBe(5);
    expect(result.sourceImageBits).toBe(source);
  });

  it("tiles source bits and bumps revision", () => {
    const source = makeBits(2, 3);
    const result = buildRepeatedImageState(source, 2, 3, 4);

    expect(result.repeatH).toBe(2);
    expect(result.repeatV).toBe(3);
    expect(result.imageHeight).toBe(6);
    expect(result.imageWidth).toBe(6);
    expect(result.imageBitsRevision).toBe(5);
    expect(result.sourceImageBits).toBe(source);
  });

  it("returns zero width for empty source", () => {
    const result = buildRepeatedImageState([], 1, 1, 0);
    expect(result.imageWidth).toBe(0);
    expect(result.imageHeight).toBe(0);
  });

  it("carries source row memos through unchanged with no stretch/repeat", () => {
    const source = makeBits(2, 3);
    const result = buildRepeatedImageState(source, 1, 1, 0, 1, 1, ["2", "0"]);
    expect(result.sourceRowMemos).toEqual(["2", "0"]);
    expect(result.rowMemos).toEqual(["2", "0"]);
  });

  it("tiles row memos alongside vertical repeat, matching transforms.py's repeat()", () => {
    const source = makeBits(2, 3);
    const result = buildRepeatedImageState(source, 1, 3, 0, 1, 1, ["2", "0"]);
    expect(result.rowMemos).toEqual(["2", "0", "2", "0", "2", "0"]);
  });

  it("drops row memos on vertical stretch, matching transforms.py's stretch()", () => {
    const source = makeBits(2, 3);
    const result = buildRepeatedImageState(source, 1, 1, 0, 1, 2, ["2", "0"]);
    expect(result.rowMemos).toEqual([]);
  });

  it("defaults to no row memos when none are given", () => {
    const source = makeBits(2, 3);
    const result = buildRepeatedImageState(source, 1, 1, 0);
    expect(result.sourceRowMemos).toEqual([]);
    expect(result.rowMemos).toEqual([]);
  });
});

describe("rowMemosForTransform", () => {
  it("is a no-op at repeatV=1, stretchV=1", () => {
    expect(rowMemosForTransform(["4", "0"], 1, 1)).toEqual(["4", "0"]);
  });

  it("tiles by repeatV", () => {
    expect(rowMemosForTransform(["4"], 2, 1)).toEqual(["4", "4"]);
  });

  it("clears when vertically stretched", () => {
    expect(rowMemosForTransform(["4", "0"], 1, 3)).toEqual([]);
  });

  it("stays empty when there is nothing to tile", () => {
    expect(rowMemosForTransform([], 5, 1)).toEqual([]);
  });
});

describe("settingsForLoadedImage", () => {
  it("applies the image-fit needle window on a fresh load", () => {
    // 36-wide image on a 200-needle bed: Left 18 – Right 18 → needles 82..117.
    const settings = settingsForLoadedImage(36, Machine.KH910_KH950, undefined);
    expect(settings.startNeedle).toBe(82);
    expect(settings.stopNeedle).toBe(117);
    expect(settings.startRow).toBe(0);
    expect(settings.mode).toBe(Mode.SINGLEBED);
    expect(settings.alignment).toBe(Alignment.CENTER);
  });

  it("preserves non-needle fields from existing settings", () => {
    const previous = {
      mode: Mode.CIRCULAR_RIBBER,
      numColors: 4,
      startRow: 7,
      infRepeat: true,
      startNeedle: 10,
      stopNeedle: 190,
      alignment: Alignment.LEFT,
      autoMirror: true,
    };
    const settings = settingsForLoadedImage(36, Machine.KH910_KH950, previous);
    expect(settings.mode).toBe(Mode.CIRCULAR_RIBBER);
    expect(settings.numColors).toBe(4);
    expect(settings.infRepeat).toBe(true);
    expect(settings.alignment).toBe(Alignment.LEFT);
    expect(settings.autoMirror).toBe(true);
    // …but the needle window and start row track the new image.
    expect(settings.startNeedle).toBe(82);
    expect(settings.stopNeedle).toBe(117);
    expect(settings.startRow).toBe(0);
  });

  it("clamps the window to the machine bed for oversized images", () => {
    const settings = settingsForLoadedImage(400, Machine.KH910_KH950, undefined);
    expect(settings.startNeedle).toBeGreaterThanOrEqual(0);
    expect(settings.stopNeedle).toBeLessThanOrEqual(199);
    expect(settings.startNeedle).toBeLessThan(settings.stopNeedle);
  });
});
