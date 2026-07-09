import "jasmine/src/jasmine";
import { createAppImageHandlers } from "ayab_valdi/src/AppImageHandlers";

function makeBits(rows: number, cols: number): Uint8Array[][] {
  const pixel = new Uint8Array([1]);
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => pixel),
  );
}

describe("createAppImageHandlers", () => {
  it("resets repeat and stretch when bits are loaded", () => {
    let state = {
      sourceImageBits: makeBits(2, 2),
      stretchH: 2,
      stretchV: 3,
      repeatH: 3,
      repeatV: 4,
      imageBitsRevision: 2,
    };
    const handlers = createAppImageHandlers(() => state);
    const next = handlers.handleBitsLoaded(makeBits(1, 5), 5, 1);
    expect(next.stretchH).toBe(1);
    expect(next.stretchV).toBe(1);
    expect(next.repeatH).toBe(1);
    expect(next.repeatV).toBe(1);
    expect(next.imageWidth).toBe(5);
    expect(next.imageBitsRevision).toBe(3);
  });

  it("returns null when stretch changes without a source image", () => {
    const handlers = createAppImageHandlers(() => ({
      sourceImageBits: undefined,
      stretchH: 1,
      stretchV: 1,
      repeatH: 1,
      repeatV: 1,
      imageBitsRevision: 0,
    }));
    expect(handlers.handleStretchChange(2, 2)).toBeNull();
  });

  it("returns null when repeat changes without a source image", () => {
    const handlers = createAppImageHandlers(() => ({
      sourceImageBits: undefined,
      stretchH: 1,
      stretchV: 1,
      repeatH: 1,
      repeatV: 1,
      imageBitsRevision: 0,
    }));
    expect(handlers.handleRepeatChange(2, 2)).toBeNull();
  });
});
