/**
 * Pure image transforms for preview display (desktop: scene.set_image_reversed).
 */

/** Mirror each row horizontally — swaps column order within every row. */
export function mirrorHorizontal(bits: Uint8Array[][]): Uint8Array[][] {
  const mirrored: Uint8Array[][] = [];
  for (let rowIndex = 0; rowIndex < bits.length; rowIndex++) {
    const row = bits[rowIndex]!;
    const mirroredRow: Uint8Array[] = [];
    for (let colIndex = row.length - 1; colIndex >= 0; colIndex--) {
      mirroredRow.push(row[colIndex]!);
    }
    mirrored.push(mirroredRow);
  }
  return mirrored;
}

/** Apply preview display transforms before rendering. */
export function preparePreviewBits(
  bits: Uint8Array[][],
  autoMirror: boolean,
): Uint8Array[][] {
  if (!autoMirror) {
    return bits;
  }
  return mirrorHorizontal(bits);
}
