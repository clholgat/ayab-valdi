import { hflip, vflip, rotateLeft, invert } from "preview/src/ImageTransform";
import { buildRepeatedImageState, RepeatedImageState } from "./AppImageLogic";

export interface AppImageHandlerState {
  sourceImageBits?: Uint8Array[][];
  stretchH: number;
  stretchV: number;
  repeatH: number;
  repeatV: number;
  imageBitsRevision: number;
}

export interface AppImageHandlers {
  handleBitsLoaded: (
    bits: Uint8Array[][],
    width: number,
    height: number,
  ) => RepeatedImageState;
  handleStretchChange: (
    stretchH: number,
    stretchV: number,
  ) => RepeatedImageState | null;
  handleRepeatChange: (
    repeatH: number,
    repeatV: number,
  ) => RepeatedImageState | null;
  handleFlipH: () => RepeatedImageState | null;
  handleFlipV: () => RepeatedImageState | null;
  handleRotateLeft: () => RepeatedImageState | null;
  handleInvert: () => RepeatedImageState | null;
}

export function createAppImageHandlers(
  getState: () => AppImageHandlerState,
): AppImageHandlers {
  const applyTransform = (
    transform: (bits: Uint8Array[][]) => Uint8Array[][],
  ): RepeatedImageState | null => {
    const source = getState().sourceImageBits;
    if (!source) {
      return null;
    }
    const { stretchH, stretchV, repeatH, repeatV, imageBitsRevision } =
      getState();
    return buildRepeatedImageState(
      transform(source),
      repeatH,
      repeatV,
      imageBitsRevision,
      stretchH,
      stretchV,
    );
  };

  return {
    handleBitsLoaded: (bits, width, height) => {
      void width;
      void height;
      const { imageBitsRevision } = getState();
      return buildRepeatedImageState(bits, 1, 1, imageBitsRevision, 1, 1);
    },

    handleStretchChange: (stretchH, stretchV) => {
      const source = getState().sourceImageBits;
      if (!source) {
        return null;
      }
      const { repeatH, repeatV, imageBitsRevision } = getState();
      return buildRepeatedImageState(
        source,
        repeatH,
        repeatV,
        imageBitsRevision,
        stretchH,
        stretchV,
      );
    },

    handleRepeatChange: (repeatH, repeatV) => {
      const source = getState().sourceImageBits;
      if (!source) {
        return null;
      }
      const { stretchH, stretchV, imageBitsRevision } = getState();
      return buildRepeatedImageState(
        source,
        repeatH,
        repeatV,
        imageBitsRevision,
        stretchH,
        stretchV,
      );
    },

    handleFlipH: () => applyTransform(hflip),
    handleFlipV: () => applyTransform(vflip),
    handleRotateLeft: () => applyTransform(rotateLeft),
    handleInvert: () => applyTransform(invert),
  };
}
