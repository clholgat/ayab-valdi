import "jasmine/src/jasmine";
import { mirrorHorizontal, preparePreviewBits } from "preview/src/PreviewTransforms";

describe("PreviewTransforms", () => {
  it("mirrorHorizontal swaps columns in each row", () => {
    const black = new Uint8Array([0, 0, 0, 255]);
    const white = new Uint8Array([255, 255, 255, 255]);
    const bits = [
      [black, white],
      [white, black],
    ];

    const mirrored = mirrorHorizontal(bits);

    expect(mirrored[0]![0]).toBe(white);
    expect(mirrored[0]![1]).toBe(black);
    expect(mirrored[1]![0]).toBe(black);
    expect(mirrored[1]![1]).toBe(white);
  });

  it("preparePreviewBits leaves bits unchanged when autoMirror is false", () => {
    const bits = [[new Uint8Array([1])]];
    expect(preparePreviewBits(bits, false)).toBe(bits);
  });

  it("preparePreviewBits mirrors when autoMirror is true", () => {
    const left = new Uint8Array([10]);
    const right = new Uint8Array([20]);
    const bits = [[left, right]];
    const prepared = preparePreviewBits(bits, true);
    expect(prepared[0]![0]).toBe(right);
    expect(prepared[0]![1]).toBe(left);
  });
});
