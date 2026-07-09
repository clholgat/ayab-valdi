/**
 * DAK .stp pattern import — TypeScript port of ayab-desktop StpPatternConverter.
 */

import {
  PatternColor,
  PatternImportError,
  colorPatternToRgb,
  decodeRleColorRuns,
  getByteAt,
  getDWordAt,
  getStringAt,
  getWordAt,
  readDakColorBlocks,
  rgbToRgbaBits,
} from "./PatternImportBinary";

const COLOR_BLOCK_START = 0xf8;
const MAX_XOR_LEN = 21000;
const MAX_WIDTH = 500;
const MAX_HEIGHT = 3000;

class StpBlock {
  readonly height: number;
  readonly size: number;
  readonly data: Uint8Array;

  constructor(buffer: Uint8Array, start: number, xorkey?: Uint8Array) {
    this.height = getWordAt(buffer, start);
    this.size = getWordAt(buffer, start + 2);
    if (xorkey != null) {
      this.data = new Uint8Array(this.size);
      for (let i = 0; i < this.size; i++) {
        this.data[i] = buffer[start + 4 + i]! ^ xorkey[i]!;
      }
    } else {
      this.data = buffer.subarray(start + 4, start + 4 + this.size);
    }
  }
}

export function isStpFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".stp");
}

function checkStpHeader(data: Uint8Array): void {
  if (
    getByteAt(data, 0) !== 0x44 ||
    getByteAt(data, 1) !== 0x37 ||
    getByteAt(data, 2) !== 0x63
  ) {
    throw new PatternImportError("file header not recognized", -4);
  }
}

function checkStpDims(data: Uint8Array): { width: number; height: number } {
  const width = getWordAt(data, 3);
  const height = getWordAt(data, 5);
  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    throw new PatternImportError("dimensions are too big", -2);
  }
  if (width === 0 || height === 0) {
    throw new PatternImportError("invalid pattern dimensions", -2);
  }
  return { width, height };
}

function appendKeyString(existing: Uint8Array, next: Uint8Array, maxSize: number): Uint8Array {
  const combined = new Uint8Array(existing.length + next.length);
  combined.set(existing);
  combined.set(next, existing.length);
  return combined.subarray(0, maxSize);
}

function calcStpXorKey(data: Uint8Array): Uint8Array {
  let key1 =
    (getDWordAt(data, 0x35) >> 1) +
    (getWordAt(data, 0x3f) << 2) +
    getDWordAt(data, 0x39) +
    getWordAt(data, 0x3d) +
    getByteAt(data, 0x20);

  let keystring = getStringAt(data, 0x60);
  keystring = appendKeyString(keystring, getStringAt(data, 0x41), 0x6e);
  keystring = appendKeyString(
    keystring,
    new TextEncoder().encode(String(getWordAt(data, 0x3d))),
    0x7d,
  );
  keystring = appendKeyString(
    keystring,
    new TextEncoder().encode(String(getByteAt(data, 0x20))),
    0x8c,
  );
  keystring = appendKeyString(keystring, getStringAt(data, 0x41), 0xaa);
  keystring = appendKeyString(
    keystring,
    new TextEncoder().encode(String(getByteAt(data, 0x20))),
    0xb9,
  );
  keystring = appendKeyString(
    keystring,
    new TextEncoder().encode(String(getWordAt(data, 0x3d))),
    0xc8,
  );

  const salt1 = getWordAt(data, 0x39);
  const salt2 = (getDWordAt(data, 0x35) & 0xffff) > 0 ? 1 : 0;
  let key2 = key1;
  for (let i = 0; i < keystring.length; i++) {
    const b = Math.floor(keystring[i]! / 2);
    const switchIndex = (i + 1) % 3;
    if (switchIndex === 0) {
      const temp = Math.floor((salt2 + b) / 7);
      key2 += (i + 1) * b + temp;
    } else if (switchIndex === 1) {
      const temp = Math.floor(b / 5) * getWordAt(data, 0x3f);
      key2 += (i + 1) * salt2 + b * 6 + temp;
    } else {
      key2 += (i + 1) * salt1 + b * 4;
    }
  }

  keystring = new TextEncoder().encode(String(key2 * 3));
  keystring = appendKeyString(
    keystring,
    new TextEncoder().encode(String(key2)),
    0x1e,
  );
  keystring = appendKeyString(
    keystring,
    new TextEncoder().encode(String(key2 * 4)),
    0x2d,
  );
  keystring = appendKeyString(
    keystring,
    new TextEncoder().encode(String(key2 * 2)),
    0x3c,
  );
  keystring = appendKeyString(
    keystring,
    new TextEncoder().encode(String(key2 * 5)),
    0x4b,
  );
  keystring = appendKeyString(
    keystring,
    new TextEncoder().encode(String(key2 * 6)),
    0x5a,
  );
  keystring = appendKeyString(
    keystring,
    new TextEncoder().encode(String(key2 * 8)),
    0x69,
  );
  keystring = appendKeyString(
    keystring,
    new TextEncoder().encode(String(key2 * 7)),
    0x78,
  );

  const xorkey = new Uint8Array(MAX_XOR_LEN);
  for (let i = 0; i < MAX_XOR_LEN; i++) {
    const index = (i + 1) % keystring.length;
    const temp1 = keystring[index]! & 0xff;
    const temp2 = key2 % (i + 1) & 0xff;
    xorkey[i] = temp1 ^ temp2;
  }
  return xorkey;
}

function decryptNextBlock(
  pos: number,
  inputData: Uint8Array,
  xorkey: Uint8Array,
  targetHeight: number,
): { blocks: StpBlock[]; nextPos: number } {
  const blocks: StpBlock[] = [];
  while (true) {
    const block = new StpBlock(inputData, pos, xorkey);
    blocks.push(block);
    pos += block.size + 4;
    if (block.height === targetHeight) {
      return { blocks, nextPos: pos };
    }
  }
}

function decodeStpRuns(
  blocks: StpBlock[],
  width: number,
  height: number,
): Uint8Array {
  const output = new Uint8Array(width * height);
  let blockNum = 0;
  let blockData = blocks[0]!.data;
  let pos = 0;

  for (let row = 0; row < height; row++) {
    if (row === blocks[blockNum]!.height) {
      blockNum += 1;
      blockData = blocks[blockNum]!.data;
      pos = 0;
    }
    let column = 0;
    while (column < width) {
      let run = 1;
      let symbol = getByteAt(blockData, pos);
      pos += 1;
      if (symbol & 0x80) {
        run = symbol & 0x7f;
        symbol = getByteAt(blockData, pos);
        pos += 1;
      }
      for (let i = 0; i < run; i++) {
        output[row * width + column] = symbol;
        column += 1;
      }
    }
  }

  return output;
}

export function stpPatternFromBytes(inputData: Uint8Array): {
  rgb: Uint8Array;
  width: number;
  height: number;
} {
  if (inputData.length < COLOR_BLOCK_START + 1) {
    throw new PatternImportError("file is too small", -3);
  }

  checkStpHeader(inputData);
  const { width, height } = checkStpDims(inputData);
  const xorkey = calcStpXorKey(inputData);

  const colorBlocksResult = decryptNextBlock(
    COLOR_BLOCK_START,
    inputData,
    xorkey,
    height,
  );
  const stitchBlocksResult = decryptNextBlock(
    colorBlocksResult.nextPos,
    inputData,
    xorkey,
    height,
  );
  const colorDataStart = stitchBlocksResult.nextPos;

  const colorPattern = decodeStpRuns(colorBlocksResult.blocks, width, height);
  const colors = new Map<number, PatternColor>();
  readDakColorBlocks(inputData, colorDataStart, colors);

  const rgb = colorPatternToRgb(colorPattern, width, height, colors);
  return { rgb, width, height };
}

export function stpToRgbaBits(inputData: Uint8Array): {
  bits: Uint8Array[][];
  width: number;
  height: number;
} {
  const { rgb, width, height } = stpPatternFromBytes(inputData);
  return { bits: rgbToRgbaBits(rgb, width, height), width, height };
}
