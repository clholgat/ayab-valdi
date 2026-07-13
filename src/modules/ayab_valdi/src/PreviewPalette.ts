import { Mode } from "constants/src/StateMachineConstants";
import { Pattern, PatternImage } from "state_machine/src/Pattern";
import { prepareImageBitsForKnit } from "state_machine/src/ImageOrientation";

export interface PreviewPaletteParams {
  imageBits: Uint8Array[][];
  imageWidth: number;
  imageHeight: number;
  numColors: number;
  mode: Mode;
  machineWidth: number;
  startNeedle?: number;
  stopNeedle?: number;
}

/**
 * RGB palette (one packed 0xRRGGBB per color index) for the currently loaded
 * image, computed via the same orientation + quantization pipeline used at
 * knit time (KnitSession.buildPattern / Pattern.processPatternData) so the
 * preview never disagrees with what actually gets knit.
 */
export function computePreviewPalette(params: PreviewPaletteParams): number[] {
  const {
    imageBits,
    imageWidth,
    imageHeight,
    numColors,
    mode,
    machineWidth,
    startNeedle,
    stopNeedle,
  } = params;

  if (imageWidth <= 0 || imageHeight <= 0 || numColors <= 0) {
    return [];
  }

  const knitBits = prepareImageBitsForKnit(imageBits);
  const patternImage = new PatternImage(knitBits, imageWidth, imageHeight, numColors);
  const pattern = new Pattern(patternImage, numColors);
  pattern.mode = mode;
  pattern.processPatternData(machineWidth, numColors, startNeedle, stopNeedle, mode);
  return pattern.palette;
}
