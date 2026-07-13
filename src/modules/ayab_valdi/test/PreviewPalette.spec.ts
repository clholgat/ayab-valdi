import "jasmine/src/jasmine";
import { Mode } from "constants/src/StateMachineConstants";
import { computePreviewPalette } from "ayab_valdi/src/PreviewPalette";

function rgbaRows(pixels: Array<[number, number, number]>[]): Uint8Array[][] {
  return pixels.map((row) =>
    row.map(([r, g, b]) => new Uint8Array([r, g, b, 255])),
  );
}

describe("computePreviewPalette", () => {
  it("returns an empty palette when there is no image", () => {
    const palette = computePreviewPalette({
      imageBits: [],
      imageWidth: 0,
      imageHeight: 0,
      numColors: 2,
      mode: Mode.SINGLEBED,
      machineWidth: 200,
    });
    expect(palette).toEqual([]);
  });

  it("returns one packed 0xRRGGBB entry per color for a black/white singlebed image", () => {
    const imageBits = rgbaRows([
      [
        [0, 0, 0],
        [255, 255, 255],
      ],
    ]);
    const palette = computePreviewPalette({
      imageBits,
      imageWidth: 2,
      imageHeight: 1,
      numColors: 2,
      mode: Mode.SINGLEBED,
      machineWidth: 200,
    });
    expect(palette.length).toBe(2);
    // Matches ColorQuantization's tested singlebed behavior: darkest first.
    expect(palette[0]).toBe(0x000000);
    expect(palette[1]).toBe(0xffffff);
  });

  it("returns numColors entries for a multi-color ribber-mode image", () => {
    const imageBits = rgbaRows([
      [
        [0, 0, 0],
        [128, 0, 0],
        [255, 255, 255],
      ],
    ]);
    const palette = computePreviewPalette({
      imageBits,
      imageWidth: 3,
      imageHeight: 1,
      numColors: 3,
      mode: Mode.CLASSIC_RIBBER,
      machineWidth: 200,
    });
    expect(palette.length).toBe(3);
  });

  it("respects the startNeedle/stopNeedle extraction window used at knit time", () => {
    const imageBits = rgbaRows([
      [
        [0, 0, 0],
        [255, 255, 255],
      ],
    ]);
    const palette = computePreviewPalette({
      imageBits,
      imageWidth: 2,
      imageHeight: 1,
      numColors: 2,
      mode: Mode.SINGLEBED,
      machineWidth: 200,
      startNeedle: 0,
      stopNeedle: 1,
    });
    expect(palette.length).toBe(2);
  });
});
