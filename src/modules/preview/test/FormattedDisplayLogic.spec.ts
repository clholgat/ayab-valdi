import "jasmine/src/jasmine";
import {
  NEEDLE_GRID_BORDER_LEFT,
  NEEDLE_GRID_BORDER_RIGHT,
} from "constants/src/NeedleColors";
import {
  computePixelGrid,
  visibleRowMemos,
  rgbaToHexColor,
  rgbIntToHex,
} from "preview/src/FormattedDisplayLogic";
import { computeZoomContentKey } from "preview/src/PreviewViewportTypes";

describe("FormattedDisplayLogic", () => {
  it("distinguishes equal-sized samples by content identity", () => {
    const first = computeZoomContentKey(60, 40, 40, false, 0, "first.png");
    const second = computeZoomContentKey(60, 40, 40, false, 0, "second.png");

    expect(first).not.toBe(second);
  });

  describe("rgbaToHexColor", () => {
    it("formats opaque RGB as 6-digit hex", () => {
      expect(rgbaToHexColor(new Uint8Array([255, 0, 128, 255]))).toBe(
        "#ff0080",
      );
    });

    it("formats transparent RGBA with alpha channel", () => {
      expect(rgbaToHexColor(new Uint8Array([0, 0, 0, 0]))).toBe("#00000000");
    });
  });

  describe("rgbIntToHex", () => {
    it("formats packed RGB integers", () => {
      expect(rgbIntToHex(0xff0080)).toBe("#ff0080");
      expect(rgbIntToHex(0x0000ff)).toBe("#0000ff");
    });
  });

  describe("computePixelGrid", () => {
    const bits = [
      [
        new Uint8Array([255, 0, 0, 255]),
        new Uint8Array([0, 255, 0, 255]),
      ],
    ];

    it("assigns left/right borders by image midpoint when bar is hidden", () => {
      const rows = computePixelGrid({ bits });
      expect(rows[0][0].backgroundColor).toBe("#ff0000");
      expect(rows[0][0].borderColor).toBe(NEEDLE_GRID_BORDER_LEFT);
      expect(rows[0][1].borderColor).toBe(NEEDLE_GRID_BORDER_RIGHT);
    });

    it("assigns borders by needle bed offset when bar is shown", () => {
      const rows = computePixelGrid({
        bits,
        showBar: true,
        machineWidth: 200,
        stitchSize: 10,
        imageOffsetPx: 990,
        barHalf: 100,
      });
      expect(rows[0][0].borderColor).toBe(NEEDLE_GRID_BORDER_LEFT);
      expect(rows[0][1].borderColor).toBe(NEEDLE_GRID_BORDER_RIGHT);
    });
  });

  describe("visibleRowMemos", () => {
    it("keeps annotations aligned to their image rows and hides empty memos", () => {
      expect(visibleRowMemos(["0", "3", "", "7", "9"], 4)).toEqual([
        { rowIndex: 1, memo: "3" },
        { rowIndex: 3, memo: "7" },
      ]);
    });
  });
});
