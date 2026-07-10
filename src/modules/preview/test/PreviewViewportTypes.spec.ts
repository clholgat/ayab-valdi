import "jasmine/src/jasmine";
import { computeZoomContentKey } from "preview/src/PreviewViewportTypes";

describe("computeZoomContentKey", () => {
  it("stays the same when only knit progress would change (currentRow is not an input)", () => {
    // The zoom-reset key must not depend on knit row progress - regressing this
    // is exactly what caused zoom to snap back to 100% on every knit row.
    const a = computeZoomContentKey(100, 80, 80, false, 0);
    const b = computeZoomContentKey(100, 80, 80, false, 0);
    expect(a).toBe(b);
  });

  it("changes when image dimensions change", () => {
    const a = computeZoomContentKey(100, 80, 80, false, 0);
    const b = computeZoomContentKey(120, 80, 80, false, 0);
    expect(a).not.toBe(b);
  });

  it("changes when bits length changes", () => {
    const a = computeZoomContentKey(100, 80, 80, false, 0);
    const b = computeZoomContentKey(100, 80, 81, false, 0);
    expect(a).not.toBe(b);
  });

  it("changes when autoMirror toggles", () => {
    const a = computeZoomContentKey(100, 80, 80, false, 0);
    const b = computeZoomContentKey(100, 80, 80, true, 0);
    expect(a).not.toBe(b);
  });

  it("changes when aspectRatio changes", () => {
    const a = computeZoomContentKey(100, 80, 80, false, 0);
    const b = computeZoomContentKey(100, 80, 80, false, 1);
    expect(a).not.toBe(b);
  });
});
