/**
 * DAK .pat pattern import — TypeScript port of ayab-desktop pattern_import.PatPatternConverter.
 */

import {
  PatternImportError,
  colorPatternToRgb,
  dataUrlToBytes,
  decodeRleColorRuns,
  extractPatColor,
  getByteAt,
  getWordAt,
  readDakColorBlocks,
  rgbToRgbaBits,
  skipPatPatternTail,
} from "./PatternImportBinary";

const PATTERN_START = 0x165;
const MAX_WIDTH = 500;
const MAX_HEIGHT = 800;
const VALID_HEADERS: ReadonlyArray<[number, number, number]> = [
  [0x44, 0x34, 0x43], // D4C
  [0x44, 0x36, 0x43], // D6C
];

export { PatternImportError as PatPatternConverterError };

function checkHeader(data: Uint8Array): void {
  const header: [number, number, number] = [
    getByteAt(data, 0),
    getByteAt(data, 1),
    getByteAt(data, 2),
  ];
  const ok = VALID_HEADERS.some(
    (candidate) =>
      candidate[0] === header[0] &&
      candidate[1] === header[1] &&
      candidate[2] === header[2],
  );
  if (!ok) {
    throw new PatternImportError("file header not recognized", -4);
  }
}

function checkDims(data: Uint8Array): { width: number; height: number } {
  const width = getWordAt(data, 0x13a);
  const height = getWordAt(data, 0x13c);
  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    throw new PatternImportError("dimensions are too big", -2);
  }
  if (width === 0 || height === 0) {
    throw new PatternImportError("invalid pattern dimensions", -2);
  }
  return { width, height };
}

export function isPatFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".pat");
}

export function patPatternFromBytes(patternData: Uint8Array): {
  rgb: Uint8Array;
  width: number;
  height: number;
} {
  if (patternData.length < PATTERN_START + 1) {
    throw new PatternImportError("file is too small", -3);
  }

  checkHeader(patternData);
  const { width, height } = checkDims(patternData);
  const colors = new Map<number, import("./PatternImportBinary").PatternColor>();

  const { colorPattern, pos: afterRle } = decodeRleColorRuns(
    patternData,
    width,
    height,
    PATTERN_START,
  );

  let pos = skipPatPatternTail(patternData, afterRle);

  if (pos < patternData.length) {
    readDakColorBlocks(patternData, pos, colors);
  }

  if (pos === patternData.length || colors.size === 0) {
    for (let i = 0; i < 0x80; i++) {
      extractPatColor(patternData, colors, i);
    }
  }

  const rgb = colorPatternToRgb(colorPattern, width, height, colors);
  return { rgb, width, height };
}

export function patToRgbaBits(patternData: Uint8Array): {
  bits: Uint8Array[][];
  width: number;
  height: number;
} {
  const { rgb, width, height } = patPatternFromBytes(patternData);
  return { bits: rgbToRgbaBits(rgb, width, height), width, height };
}

export { dataUrlToBytes };
