import "jasmine/src/jasmine";
import {
  rowProgressOverlayHeight,
  aspectRatioVerticalScale,
  needleMarkerHeight,
  PREVIEW_BAR_HEIGHT,
} from "preview/src/PreviewSceneLayout";

describe("rowProgressOverlayHeight", () => {
  it("returns 0 when not knitting", () => {
    expect(rowProgressOverlayHeight(-1, 10, 10, 6)).toBe(0);
  });

  it("scales completed rows by stitch size", () => {
    expect(rowProgressOverlayHeight(3, 10, 10, 6)).toBe(18);
  });

  it("caps at image height", () => {
    expect(rowProgressOverlayHeight(15, 10, 10, 6)).toBe(60);
  });

  it("returns 0 for zero stitch size", () => {
    expect(rowProgressOverlayHeight(5, 10, 10, 0)).toBe(0);
  });
});

describe("needleMarkerHeight", () => {
  it("includes bar height plus all pattern rows", () => {
    expect(needleMarkerHeight(20, 6)).toBe(PREVIEW_BAR_HEIGHT + 120);
    expect(needleMarkerHeight(0, 6)).toBe(PREVIEW_BAR_HEIGHT);
  });
});

describe("aspectRatioVerticalScale", () => {
  it("returns 1.0 for default aspect ratio", () => {
    expect(aspectRatioVerticalScale(0)).toBe(1);
  });

  it("returns 0.8 for fairisle aspect ratio", () => {
    expect(aspectRatioVerticalScale(1)).toBe(0.8);
  });
});
