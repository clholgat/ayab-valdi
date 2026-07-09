import "jasmine/src/jasmine";
import { Mode, Alignment } from "constants/src/StateMachineConstants";
import {
  getKnitDisabledReason,
  getMissingImageKnitMessage,
  isKnitButtonDisabled,
} from "ayab_valdi/src/AppUiState";

describe("AppUiState", () => {
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
  const bits = [[new Uint8Array([0, 0, 0, 255])]];

  it("getKnitDisabledReason returns null while knitting", () => {
    expect(
      getKnitDisabledReason({
        isKnitting: true,
        isHardwareTesting: false,
        currentImageSettings: settings,
        imageBits: bits,
        imageWidth: 1,
        imageHeight: 1,
      }),
    ).toBeNull();
  });

  it("getKnitDisabledReason reports settings still loading", () => {
    expect(
      getKnitDisabledReason({
        isKnitting: false,
        isHardwareTesting: false,
        currentImageSettings: undefined,
        imageBits: bits,
        imageWidth: 1,
        imageHeight: 1,
      }),
    ).toBe("Image settings are still loading.");
  });

  it("getMissingImageKnitMessage requires width and height", () => {
    expect(getMissingImageKnitMessage({ imageBits: bits })).toBe(
      "Load a pattern before knitting.",
    );
    expect(
      getMissingImageKnitMessage({
        imageBits: bits,
        imageWidth: 1,
        imageHeight: 1,
      }),
    ).toBeNull();
  });

  it("isKnitButtonDisabled blocks missing settings even with image bits", () => {
    expect(
      isKnitButtonDisabled({
        isKnitting: false,
        isHardwareTesting: false,
        currentImageSettings: undefined,
        imageBits: bits,
      }),
    ).toBe(true);
  });
});
