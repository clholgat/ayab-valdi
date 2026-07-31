import { hflip, vflip, rotateLeft, invert } from "preview/src/ImageTransform";
import { buildRepeatedImageState, RepeatedImageState } from "./AppImageLogic";

export interface AppImageHandlerState {
  sourceImageBits?: Uint8Array[][];
  sourceRowMemos?: string[];
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
    memos?: string[],
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
  /**
   * `preservesMemos` mirrors transforms.py: invert/hflip don't reorder rows
   * so memos still line up afterward; vflip/rotateLeft do, and Python drops
   * memos rather than guess a new mapping.
   */
  const applyTransform = (
    transform: (bits: Uint8Array[][]) => Uint8Array[][],
    preservesMemos: boolean,
  ): RepeatedImageState | null => {
    const source = getState().sourceImageBits;
    if (!source) {
      return null;
    }
    const { stretchH, stretchV, repeatH, repeatV, imageBitsRevision, sourceRowMemos } =
      getState();
    return buildRepeatedImageState(
      transform(source),
      repeatH,
      repeatV,
      imageBitsRevision,
      stretchH,
      stretchV,
      preservesMemos ? sourceRowMemos ?? [] : [],
    );
  };

  return {
    handleBitsLoaded: (bits, width, height, memos = []) => {
      void width;
      void height;
      const { imageBitsRevision } = getState();
      return buildRepeatedImageState(bits, 1, 1, imageBitsRevision, 1, 1, memos);
    },

    handleStretchChange: (stretchH, stretchV) => {
      const source = getState().sourceImageBits;
      if (!source) {
        return null;
      }
      const { repeatH, repeatV, imageBitsRevision, sourceRowMemos } = getState();
      return buildRepeatedImageState(
        source,
        repeatH,
        repeatV,
        imageBitsRevision,
        stretchH,
        stretchV,
        sourceRowMemos ?? [],
      );
    },

    handleRepeatChange: (repeatH, repeatV) => {
      const source = getState().sourceImageBits;
      if (!source) {
        return null;
      }
      const { stretchH, stretchV, imageBitsRevision, sourceRowMemos } = getState();
      return buildRepeatedImageState(
        source,
        repeatH,
        repeatV,
        imageBitsRevision,
        stretchH,
        stretchV,
        sourceRowMemos ?? [],
      );
    },

    handleFlipH: () => applyTransform(hflip, true),
    handleFlipV: () => applyTransform(vflip, false),
    handleRotateLeft: () => applyTransform(rotateLeft, false),
    handleInvert: () => applyTransform(invert, true),
  };
}
