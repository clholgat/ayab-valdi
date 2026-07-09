/**
 * Image orientation helpers for knitting (desktop: FLIP_TOP_BOTTOM in knit_config).
 */

/** Reverse row order so the bottom image row knits first. Returns a shallow copy of rows. */
export function flipRowsVertical(bits: Uint8Array[][]): Uint8Array[][] {
  const flipped: Uint8Array[][] = [];
  for (let i = bits.length - 1; i >= 0; i--) {
    flipped.push(bits[i]!);
  }
  return flipped;
}

/** Prepare loaded image bits for knitting (bottom row first). */
export function prepareImageBitsForKnit(bits: Uint8Array[][]): Uint8Array[][] {
  return flipRowsVertical(bits);
}
