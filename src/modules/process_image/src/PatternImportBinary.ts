/**
 * Shared binary helpers for DAK pattern import (.pat, .stp, .cut).
 * TypeScript port of ayab-desktop pattern_import.py utilities.
 */

export class PatternImportError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
    this.name = "PatternImportError";
  }
}

export function getByteAt(data: Uint8Array, i: number): number {
  return data[i]! & 0xff;
}

export function getWordAt(data: Uint8Array, i: number): number {
  return getByteAt(data, i) + (getByteAt(data, i + 1) << 8);
}

export function getDWordAt(data: Uint8Array, i: number): number {
  return getWordAt(data, i) + (getWordAt(data, i + 2) << 16);
}

export function getStringAt(data: Uint8Array, i: number): Uint8Array {
  const size = getByteAt(data, i);
  return data.subarray(i + 1, i + size + 1);
}

export class PatternColor {
  readonly rgb: [number, number, number];

  constructor(
    readonly code: number,
    readonly n: number | undefined,
    readonly symbol: number,
    readonly name: Uint8Array,
    r: number,
    g: number,
    b: number,
  ) {
    this.rgb = [r, g, b];
  }

  static fromBinary(binary: Uint8Array): PatternColor {
    return new PatternColor(
      getByteAt(binary, 0),
      getByteAt(binary, 3),
      getByteAt(binary, 1),
      getStringAt(binary, 9),
      getByteAt(binary, 6),
      getByteAt(binary, 7),
      getByteAt(binary, 8),
    );
  }

  static greyscale(index: number): PatternColor {
    return new PatternColor(
      0x10,
      index,
      index,
      new Uint8Array(0),
      index,
      index,
      index,
    );
  }
}

export function readDakColorBlocks(
  buffer: Uint8Array,
  start: number,
  colors: Map<number, PatternColor>,
): void {
  colors.clear();
  let pos = start;
  for (let i = 0; i < 0x47; i++) {
    const block = buffer.subarray(pos, pos + 0x1a);
    if (getByteAt(block, 0) & 0x10) {
      colors.set(i, PatternColor.fromBinary(block));
    }
    pos += 0x19;
  }
}

export function extractPatColor(
  patternData: Uint8Array,
  colors: Map<number, PatternColor>,
  i: number,
): void {
  const a = getByteAt(patternData, i + 3);
  if (a === 0xff) {
    return;
  }
  const pos = 3 * (a & 0x0f);
  colors.set(
    i,
    new PatternColor(
      0x10 + 0x40 * (0 === i ? 1 : 0),
      undefined,
      i,
      new Uint8Array(0),
      getByteAt(patternData, 0x107 + pos),
      getByteAt(patternData, 0x106 + pos),
      getByteAt(patternData, 0x105 + pos),
    ),
  );
}

export function decodeRleColorRuns(
  patternData: Uint8Array,
  width: number,
  height: number,
  startPos: number,
): { colorPattern: Uint8Array; pos: number } {
  const colorPattern = new Uint8Array(width * height);
  let pos = startPos;

  for (let row = 0; row < height; row++) {
    let column = 0;
    while (column < width) {
      let run = 1;
      let color = getByteAt(patternData, pos);
      pos += 1;
      if (color & 0x80) {
        run = color & 0x7f;
        color = getByteAt(patternData, pos);
        pos += 1;
      }
      for (let i = 0; i < run; i++) {
        colorPattern[row * width + column] = color;
        column += 1;
      }
    }
  }

  return { colorPattern, pos };
}

export function skipPatPatternTail(patternData: Uint8Array, pos: number): number {
  const patternSize = patternData.length;
  pos += 1;
  while (pos < patternSize) {
    pos += 1;
    if (getByteAt(patternData, pos - 1) === 0xfe) {
      break;
    }
    pos += getByteAt(patternData, pos) + 1;
    pos += getByteAt(patternData, pos) + 3;
  }
  return pos;
}

export function colorPatternToRgb(
  colorPattern: Uint8Array,
  width: number,
  height: number,
  colors: Map<number, PatternColor>,
): Uint8Array {
  const rgb = new Uint8Array(width * height * 3);
  for (let row = 0; row < height; row++) {
    const srcRow = height - row - 1;
    for (let column = 0; column < width; column++) {
      const colorIndex = colorPattern[srcRow * width + column]!;
      const color = colors.get(colorIndex);
      if (!color) {
        throw new PatternImportError(
          `missing palette entry for color index ${colorIndex}`,
          -6,
        );
      }
      const outIndex = (row * width + column) * 3;
      rgb[outIndex] = color.rgb[0];
      rgb[outIndex + 1] = color.rgb[1];
      rgb[outIndex + 2] = color.rgb[2];
    }
  }
  return rgb;
}

export function rgbToRgbaBits(
  rgb: Uint8Array,
  width: number,
  height: number,
): Uint8Array[][] {
  const bits: Uint8Array[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Uint8Array[] = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      row.push(new Uint8Array([rgb[i]!, rgb[i + 1]!, rgb[i + 2]!, 255]));
    }
    bits.push(row);
  }
  return bits;
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) {
    throw new Error("Invalid data URL");
  }
  const base64 = dataUrl.slice(comma + 1);
  if (typeof atob === "undefined") {
    throw new Error("Cannot decode data URL: atob is unavailable");
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
