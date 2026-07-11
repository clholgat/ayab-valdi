import "jasmine/src/jasmine";
import { Mode } from "constants/src/StateMachineConstants";
import {
  buildPaletteFromSamples,
  orderPaletteByFrequency,
  quantizeRgbaImage,
} from "state_machine/src/ColorQuantization";

describe("ColorQuantization", () => {
  it("buildPaletteFromSamples returns requested number of colors", () => {
    const samples: Array<[number, number, number]> = [
      [0, 0, 0],
      [255, 255, 255],
      [0, 0, 0],
    ];
    const palette = buildPaletteFromSamples(samples, 2);
    expect(palette.length).toBe(2);
  });

  it("quantizeRgbaImage maps pixels to palette indices", () => {
    const black = new Uint8Array([0, 0, 0, 255]);
    const white = new Uint8Array([255, 255, 255, 255]);
    const rows = [[black, white], [white, black]];
    const result = quantizeRgbaImage(rows, 2, 2, 2, Mode.SINGLEBED);
    expect(result.indices.length).toBe(2);
    expect(result.palette.length).toBe(2);
    expect(result.indices[0]!.length).toBe(2);
  });

  it("orderPaletteByFrequency puts the darkest color at index 0 for single bed (already black-first)", () => {
    const indices = [
      [0, 0, 1],
      [0, 1, 1],
    ];
    const palette: Array<[number, number, number]> = [
      [0, 0, 0],
      [255, 255, 255],
    ];
    const ordered = orderPaletteByFrequency(indices, palette, Mode.SINGLEBED);
    expect(ordered.palette.length).toBe(2);
    // Black is already palette index 0 here, so nothing should move.
    expect(ordered.indices[0]![0]).toBe(0);
    expect(ordered.indices[0]![2]).toBe(1);
  });

  it("orderPaletteByFrequency moves the darkest color to index 0 for single bed even when the quantizer produced it last", () => {
    // Same picture as above, but the quantizer happened to emit white as
    // palette index 0 and black as index 1 - ModeFunc.singlebed() always
    // reads color plane 0 as the needle-selected color, so black must end
    // up at index 0 regardless of the quantizer's original box order.
    const indices = [
      [1, 1, 0],
      [1, 0, 0],
    ];
    const palette: Array<[number, number, number]> = [
      [255, 255, 255],
      [0, 0, 0],
    ];
    const ordered = orderPaletteByFrequency(indices, palette, Mode.SINGLEBED);
    expect(ordered.palette.length).toBe(2);
    // indices[0][0] originally referenced old index 1 (black) -> must become 0.
    expect(ordered.indices[0]![0]).toBe(0);
    // indices[0][2] originally referenced old index 0 (white) -> must become 1.
    expect(ordered.indices[0]![2]).toBe(1);
  });

  it("orderPaletteByFrequency reverses frequency order outside single bed", () => {
    const indices = [
      [0, 0, 1],
      [0, 1, 1],
    ];
    const palette: Array<[number, number, number]> = [
      [0, 0, 0],
      [255, 255, 255],
    ];
    const ordered = orderPaletteByFrequency(indices, palette, Mode.CLASSIC_RIBBER);
    expect(ordered.palette.length).toBe(2);
    expect(ordered.indices[0]!.length).toBe(3);
  });
});
