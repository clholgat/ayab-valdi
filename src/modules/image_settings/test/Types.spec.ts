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
});
