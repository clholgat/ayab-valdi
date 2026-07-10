/**
 * Image transforms on Uint8Array[][] — port of ayab-desktop transforms.py (subset).
 */

import { flipRowsVertical } from "state_machine/src/ImageOrientation";
import { mirrorHorizontal } from "./PreviewTransforms";

/** Rotate 90 degrees counter-clockwise (left turn). */
export function rotateLeft(bits: Uint8Array[][]): Uint8Array[][] {
  const height = bits.length;
  const width = height > 0 ? bits[0]!.length : 0;
  const rotated: Uint8Array[][] = [];
  for (let col = width - 1; col >= 0; col--) {
    const row: Uint8Array[] = [];
    for (let rowIndex = 0; rowIndex < height; rowIndex++) {
      row.push(bits[rowIndex]![col]!);
    }
    rotated.push(row);
  }
  return rotated;
}

/** Rotate 90 degrees clockwise (right turn). */
export function rotateRight(bits: Uint8Array[][]): Uint8Array[][] {
  const height = bits.length;
  const width = height > 0 ? bits[0]!.length : 0;
  const rotated: Uint8Array[][] = [];
  for (let col = 0; col < width; col++) {
    const row: Uint8Array[] = [];
    for (let rowIndex = height - 1; rowIndex >= 0; rowIndex--) {
      row.push(bits[rowIndex]![col]!);
    }
    rotated.push(row);
  }
  return rotated;
}

export function hflip(bits: Uint8Array[][]): Uint8Array[][] {
  return mirrorHorizontal(bits);
}

export function vflip(bits: Uint8Array[][]): Uint8Array[][] {
  return flipRowsVertical(bits);
}

export function invert(bits: Uint8Array[][]): Uint8Array[][] {
  const inverted: Uint8Array[][] = [];
  for (const row of bits) {
    const outRow: Uint8Array[] = [];
    for (const pixel of row) {
      const rgba = new Uint8Array(pixel);
      rgba[0] = 255 - (rgba[0] ?? 0);
      rgba[1] = 255 - (rgba[1] ?? 0);
      rgba[2] = 255 - (rgba[2] ?? 0);
      outRow.push(rgba);
    }
    inverted.push(outRow);
  }
  return inverted;
}

export function parseRepeatCount(text: string): number {
  const parsed = Number.parseInt(text.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(parsed, 99);
}

/** Scale each stitch vertically and horizontally (integer factors, min 1). */
export function stretch(
  bits: Uint8Array[][],
  vertical: number,
  horizontal: number,
): Uint8Array[][] {
  if (vertical <= 0 || horizontal <= 0 || (vertical === 1 && horizontal === 1)) {
    return bits;
  }
  const stretchedRows: Uint8Array[][] = [];
  for (const row of bits) {
    const stretchedRow: Uint8Array[] = [];
    for (const pixel of row) {
      for (let h = 0; h < horizontal; h++) {
        stretchedRow.push(pixel);
      }
    }
    for (let v = 0; v < vertical; v++) {
      stretchedRows.push([...stretchedRow]);
    }
  }
  return stretchedRows;
}

export function repeat(
  bits: Uint8Array[][],
  vertical: number,
  horizontal: number,
): Uint8Array[][] {
  if (vertical <= 0 || horizontal <= 0) {
    return bits;
  }
  const rows: Uint8Array[][] = [];
  for (let v = 0; v < vertical; v++) {
    for (const row of bits) {
      const repeatedRow: Uint8Array[] = [];
      for (let h = 0; h < horizontal; h++) {
        for (const pixel of row) {
          repeatedRow.push(pixel);
        }
      }
      rows.push(repeatedRow);
    }
  }
  return rows;
}
