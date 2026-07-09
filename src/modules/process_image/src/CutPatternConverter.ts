/**
 * DAK .cut pattern import — TypeScript port of ayab-desktop CutPatternConverter.
 */

import {
  PatternColor,
  PatternImportError,
  colorPatternToRgb,
  getByteAt,
  getWordAt,
  rgbToRgbaBits,
} from "./PatternImportBinary";

const PATTERN_START = 6;
const MAX_WIDTH = 500;
const MAX_HEIGHT = 800;

export function isCutFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".cut");
}

export function isPalFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".pal");
}

function checkCutHeader(data: Uint8Array): void {
  if (getByteAt(data, 4) !== 0 || getByteAt(data, 5) !== 0) {
    throw new PatternImportError("file header not recognized", -4);
  }
}

function checkCutDims(data: Uint8Array): { width: number; height: number } {
  const width = getWordAt(data, 0);
  const height = getWordAt(data, 2);
  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    throw new PatternImportError("dimensions are too big", -2);
  }
  if (width === 0 || height === 0) {
    throw new PatternImportError("invalid pattern dimensions", -2);
  }
  return { width, height };
}

function parseCutColor(
  patternData: Uint8Array,
  pos: number,
  allColors: Set<number>,
  row: number,
  column: number,
  rowEnd: number,
  colorPattern: Uint8Array,
  width: number,
): { pos: number; column: number; eol: boolean } {
  const byte = getByteAt(patternData, pos);
  pos += 1;
  const run = byte & 0x7f;
  if (run === 0) {
    if (pos !== rowEnd) {
      throw new PatternImportError(
        `.cut file misspecified at row ${row}`,
        -5,
      );
    }
    return { pos, column, eol: true };
  }
  if (byte & 0x80) {
    const color = getByteAt(patternData, pos);
    pos += 1;
    allColors.add(color);
    for (let stitch = 0; stitch < run; stitch++) {
      if (column >= width) {
        throw new PatternImportError(`row ${row} is too long`, -5);
      }
      colorPattern[row * width + column] = color;
      column += 1;
    }
    return { pos, column, eol: false };
  }
  for (let stitch = 0; stitch < run; stitch++) {
    if (column >= width) {
      throw new PatternImportError(`row ${row} is too long`, -5);
    }
    const color = getByteAt(patternData, pos);
    pos += 1;
    allColors.add(color);
    colorPattern[row * width + column] = color;
    column += 1;
  }
  return { pos, column, eol: false };
}

function parseCutColorPatterns(
  patternData: Uint8Array,
  width: number,
  height: number,
  startPos: number,
): { colorPattern: Uint8Array; allColors: Set<number> } {
  const colorPattern = new Uint8Array(width * height);
  const allColors = new Set<number>();
  let pos = startPos;

  for (let row = 0; row < height; row++) {
    let eol = false;
    let column = 0;
    const rowEnd = pos + 2 + getWordAt(patternData, pos);
    pos += 2;
    while (!eol) {
      const parsed = parseCutColor(
        patternData,
        pos,
        allColors,
        row,
        column,
        rowEnd,
        colorPattern,
        width,
      );
      pos = parsed.pos;
      column = parsed.column;
      eol = parsed.eol;
    }
  }

  return { colorPattern, allColors };
}

function decodePalColors(
  colorData: Uint8Array,
  allColors: Set<number>,
): Map<number, PatternColor> {
  if (getByteAt(colorData, 0) !== 0x41 || getByteAt(colorData, 1) !== 0x48) {
    throw new PatternImportError("file header not recognized", -4);
  }
  if (getByteAt(colorData, 6) !== 0x0a || getByteAt(colorData, 7) !== 0x00) {
    throw new PatternImportError("file header not recognized", -4);
  }

  const colorMaxIndex = getWordAt(colorData, 12);
  const colors = new Map<number, PatternColor>();
  const colorStart = 40;
  let block = 0;
  let offset = 0;

  for (let cs = 0; cs < colorMaxIndex; cs++) {
    if (offset + 3 > 512) {
      offset = 0;
      block += 512;
    }
    const index = colorStart + block + offset;
    const r = getByteAt(colorData, index);
    const g = getByteAt(colorData, index + 1);
    const b = getByteAt(colorData, index + 2);
    colors.set(cs, new PatternColor(0x10, cs, cs, new Uint8Array(0), r, g, b));
    offset += 3;
  }

  for (const c of allColors) {
    if (!colors.has(c)) {
      colors.set(c, PatternColor.greyscale(c));
    }
  }

  return colors;
}

function greyscalePalette(allColors: Set<number>): Map<number, PatternColor> {
  const colors = new Map<number, PatternColor>();
  for (const c of allColors) {
    colors.set(c, PatternColor.greyscale(c));
  }
  return colors;
}

export function cutPatternFromBytes(
  patternData: Uint8Array,
  paletteData?: Uint8Array,
): {
  rgb: Uint8Array;
  width: number;
  height: number;
} {
  if (patternData.length < PATTERN_START + 1) {
    throw new PatternImportError("file is too small", -3);
  }

  checkCutHeader(patternData);
  const { width, height } = checkCutDims(patternData);
  const { colorPattern, allColors } = parseCutColorPatterns(
    patternData,
    width,
    height,
    PATTERN_START,
  );

  const colors =
    paletteData != null
      ? decodePalColors(paletteData, allColors)
      : greyscalePalette(allColors);

  const rgb = colorPatternToRgb(colorPattern, width, height, colors);
  return { rgb, width, height };
}

export function cutToRgbaBits(
  patternData: Uint8Array,
  paletteData?: Uint8Array,
): {
  bits: Uint8Array[][];
  width: number;
  height: number;
} {
  const { rgb, width, height } = cutPatternFromBytes(
    patternData,
    paletteData,
  );
  return { bits: rgbToRgbaBits(rgb, width, height), width, height };
}
