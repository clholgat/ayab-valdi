import "jasmine/src/jasmine";
import { NeedleColor } from "image_settings/src/Types";

describe("NeedleColor", () => {
  it("getLabel returns bed side names", () => {
    expect(NeedleColor.getLabel(NeedleColor.ORANGE)).toBe("Left bed");
    expect(NeedleColor.getLabel(NeedleColor.GREEN)).toBe("Right bed");
  });

  it("getAllLabels returns both bed labels", () => {
    expect(NeedleColor.getAllLabels()).toEqual(["Left bed", "Right bed"]);
  });

  it("calculateNeedle maps orange side offsets from center", () => {
    expect(NeedleColor.calculateNeedle(NeedleColor.ORANGE, 10, 200)).toBe(90);
    expect(NeedleColor.calculateNeedle(NeedleColor.ORANGE, 0, 200)).toBe(100);
  });

  it("calculateNeedle maps green side offsets from center", () => {
    expect(NeedleColor.calculateNeedle(NeedleColor.GREEN, 5, 200)).toBe(104);
    expect(NeedleColor.calculateNeedle(NeedleColor.GREEN, 1, 200)).toBe(100);
  });

  it("needleToColorOffset inverts calculateNeedle on both sides", () => {
    expect(NeedleColor.needleToColorOffset(90, 200)).toEqual({
      color: NeedleColor.ORANGE,
      offset: 10,
    });
    expect(NeedleColor.needleToColorOffset(104, 200)).toEqual({
      color: NeedleColor.GREEN,
      offset: 5,
    });
    // Center boundary belongs to the green side (offset 1 == needle w/2).
    expect(NeedleColor.needleToColorOffset(100, 200)).toEqual({
      color: NeedleColor.GREEN,
      offset: 1,
    });
    for (const needle of [0, 42, 99, 100, 137, 199]) {
      const { color, offset } = NeedleColor.needleToColorOffset(needle, 200);
      expect(NeedleColor.calculateNeedle(color, offset, 200)).toBe(needle);
    }
  });
});
