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

  it("orderPaletteByFrequency reverses palette indices for single bed", () => {
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
    expect(ordered.indices[0]![0]).toBe(1);
    expect(ordered.indices[0]![2]).toBe(0);
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
