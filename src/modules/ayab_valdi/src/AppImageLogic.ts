import { repeat, stretch } from "preview/src/ImageTransform";

export interface RepeatedImageState {
  sourceImageBits: Uint8Array[][];
  stretchH: number;
  stretchV: number;
  repeatH: number;
  repeatV: number;
  imageBits: Uint8Array[][];
  imageWidth: number;
  imageHeight: number;
  imageBitsRevision: number;
}

export function buildRepeatedImageState(
  source: Uint8Array[][],
  repeatH: number,
  repeatV: number,
  imageBitsRevision: number,
  stretchH = 1,
  stretchV = 1,
): RepeatedImageState {
  const scaled = stretch(source, stretchV, stretchH);
  const imageBits = repeat(scaled, repeatV, repeatH);
  const imageHeight = imageBits.length;
  const imageWidth = imageHeight > 0 ? imageBits[0]!.length : 0;
  return {
    sourceImageBits: source,
    stretchH,
    stretchV,
    repeatH,
    repeatV,
    imageBits,
    imageWidth,
    imageHeight,
    imageBitsRevision: imageBitsRevision + 1,
  };
}
