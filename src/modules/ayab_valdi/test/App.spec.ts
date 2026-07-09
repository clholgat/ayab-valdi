import "jasmine/src/jasmine";
import { Mode, Alignment } from "constants/src/StateMachineConstants";
import { Preferences } from "app_settings/src/Preferences";
import { KnitSession } from "ayab_valdi/src/KnitSession";
import {
  getMissingImageKnitMessage,
  getKnitDisabledReason,
  isKnitButtonDisabled,
} from "ayab_valdi/src/AppUiState";

describe("App", () => {
  const settings = {
    mode: Mode.SINGLEBED,
    numColors: 2,
    startRow: 0,
    infRepeat: false,
    startNeedle: 80,
    stopNeedle: 120,
    alignment: Alignment.CENTER,
    autoMirror: false,
  };

  it("disables knit button without image bits", () => {
    expect(
      isKnitButtonDisabled({
        isKnitting: false,
        isHardwareTesting: false,
        currentImageSettings: settings,
        imageBits: undefined,
      }),
    ).toBe(true);
  });

  it("disables knit button while knitting or hardware testing", () => {
    const bits = [[new Uint8Array([0, 0, 0, 255])]];
    expect(
      isKnitButtonDisabled({
        isKnitting: true,
        isHardwareTesting: false,
        currentImageSettings: settings,
        imageBits: bits,
      }),
    ).toBe(true);
    expect(
      isKnitButtonDisabled({
        isKnitting: false,
        isHardwareTesting: true,
        currentImageSettings: settings,
        imageBits: bits,
      }),
    ).toBe(true);
  });

  it("enables knit button when image and settings are ready", () => {
    expect(
      isKnitButtonDisabled({
        isKnitting: false,
        isHardwareTesting: false,
        currentImageSettings: settings,
        imageBits: [[new Uint8Array([0, 0, 0, 255])]],
      }),
    ).toBe(false);
  });

  it("returns load-image message when knitting without image", () => {
    expect(getMissingImageKnitMessage({})).toBe(
      "Load a pattern before knitting.",
    );
  });

  it("returns knit disabled reasons for blocked states", () => {
    expect(
      getKnitDisabledReason({
        isKnitting: false,
        isHardwareTesting: true,
        currentImageSettings: settings,
        imageBits: [[new Uint8Array([0])]],
        imageWidth: 1,
        imageHeight: 1,
      }),
    ).toBe("Finish the hardware test before knitting.");
    expect(
      getKnitDisabledReason({
        isKnitting: false,
        isHardwareTesting: false,
        currentImageSettings: settings,
        imageBits: undefined,
      }),
    ).toBe("Load a pattern before knitting.");
  });

  it("surfaces validation errors like invalid color count", () => {
    const bits = [[new Uint8Array([0, 0, 0, 255])]];
    const result = KnitSession.tryStart({
      imageBits: bits,
      imageWidth: 1,
      imageHeight: 1,
      settings: { ...settings, numColors: 4 },
      preferences: new Preferences(),
      serialPort: "Simulation",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("2 colors");
    }
  });
});
