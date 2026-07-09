import "jasmine/src/jasmine";
import {
  buildImageSettings,
  buildNeedleRangeSuggestion,
  clampInt,
  clampNeedleOffsets,
  formatBrotherNeedlePosition,
  machineMaxNeedleOffset,
  needleDefaultsForImageWidth,
} from "image_settings/src/ImageSettingsLogic";
import { NeedleColor } from "image_settings/src/Types";
import { Mode, Alignment } from "constants/src/StateMachineConstants";
import { Machine } from "state_machine/src/Machine";

describe("ImageSettingsLogic", () => {
  describe("clampInt", () => {
    it("returns value when within range", () => {
      expect(clampInt(5, 1, 10)).toBe(5);
    });

    it("clamps to min", () => {
      expect(clampInt(0, 1, 10)).toBe(1);
    });

    it("clamps to max", () => {
      expect(clampInt(100, 1, 99)).toBe(99);
    });
  });

  describe("machineMaxNeedleOffset", () => {
    it("uses half the machine bed width", () => {
      expect(machineMaxNeedleOffset(200)).toBe(100);
      expect(machineMaxNeedleOffset(201)).toBe(100);
    });
  });

  describe("clampNeedleOffsets", () => {
    it("clamps both offsets to the machine range", () => {
      expect(clampNeedleOffsets(0, 500, 200)).toEqual({
        startNeedleOffset: 1,
        stopNeedleOffset: 100,
      });
    });
  });

  describe("needleDefaultsForImageWidth", () => {
    it("centers a 40-stitch image on the bed", () => {
      expect(needleDefaultsForImageWidth(40)).toEqual({
        startNeedleColor: NeedleColor.ORANGE,
        stopNeedleColor: NeedleColor.GREEN,
        startNeedleOffset: 20,
        stopNeedleOffset: 20,
      });
    });
  });

  describe("formatBrotherNeedlePosition", () => {
    it("uses Left and Right bed labels", () => {
      expect(formatBrotherNeedlePosition(NeedleColor.ORANGE, 30)).toBe(
        "Left 30",
      );
      expect(formatBrotherNeedlePosition(NeedleColor.GREEN, 14)).toBe(
        "Right 14",
      );
    });
  });

  describe("buildNeedleRangeSuggestion", () => {
    it("describes centered defaults for the pattern width", () => {
      expect(buildNeedleRangeSuggestion(60, 200)).toBe(
        "Suggested for this 60-stitch pattern: Left 30 – Right 30.",
      );
    });

    it("clamps wide patterns to the machine bed", () => {
      expect(buildNeedleRangeSuggestion(250, 200)).toBe(
        "Suggested for this 250-stitch pattern: Left 100 – Right 100.",
      );
    });
  });

  describe("buildImageSettings", () => {
    it("maps needle colors and offsets to machine coordinates", () => {
      const settings = buildImageSettings(
        {
          mode: Mode.SINGLEBED,
          numColors: 2,
          startRow: 0,
          infRepeat: false,
          startNeedleColor: NeedleColor.ORANGE,
          startNeedleOffset: 10,
          stopNeedleColor: NeedleColor.GREEN,
          stopNeedleOffset: 5,
          alignment: Alignment.CENTER,
          autoMirror: false,
        },
        Machine.KH910_KH950,
      );
      expect(settings.startNeedle).toBe(90);
      expect(settings.stopNeedle).toBe(104);
      expect(settings.numColors).toBe(2);
    });
  });
});
