import "jasmine/src/jasmine";
import { buildRepeatedImageState } from "ayab_valdi/src/AppImageLogic";

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
});
