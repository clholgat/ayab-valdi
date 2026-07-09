import { ImageSettings } from "image_settings/src/ImageSettingsComponent";

export function isKnitButtonDisabled(state: {
  isKnitting: boolean;
  isHardwareTesting: boolean;
  currentImageSettings?: ImageSettings;
  imageBits?: Uint8Array[][];
}): boolean {
  return (
    state.isKnitting ||
    state.isHardwareTesting ||
    !state.currentImageSettings ||
    !state.imageBits
  );
}

export function getMissingImageKnitMessage(state: {
  imageBits?: Uint8Array[][];
  imageWidth?: number;
  imageHeight?: number;
}): string | null {
  if (!state.imageBits || !state.imageWidth || !state.imageHeight) {
    return "Load a pattern before knitting.";
  }
  return null;
}

export function getKnitDisabledReason(state: {
  isKnitting: boolean;
  isHardwareTesting: boolean;
  currentImageSettings?: ImageSettings;
  imageBits?: Uint8Array[][];
  imageWidth?: number;
  imageHeight?: number;
}): string | null {
  if (state.isKnitting) {
    return null;
  }
  if (state.isHardwareTesting) {
    return "Finish the hardware test before knitting.";
  }
  const missingImage = getMissingImageKnitMessage(state);
  if (missingImage) {
    return missingImage;
  }
  if (!state.currentImageSettings) {
    return "Image settings are still loading.";
  }
  return null;
}
