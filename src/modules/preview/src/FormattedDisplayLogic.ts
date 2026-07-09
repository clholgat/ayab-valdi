import {
  NEEDLE_GRID_BORDER_LEFT,
  NEEDLE_GRID_BORDER_RIGHT,
} from "constants/src/NeedleColors";

export interface PixelCell {
  backgroundColor: string;
  borderColor: string;
}

export interface ComputePixelGridOptions {
  bits: Uint8Array[][];
  machineWidth?: number;
  stitchSize?: number;
  imageOffsetPx?: number;
  barHalf?: number;
  showBar?: boolean;
}

export function rgbaToHexColor(rgba: Uint8Array): string {
  const r = rgba[0] ?? 0;
  const g = rgba[1] ?? 0;
  const b = rgba[2] ?? 0;
  const a = rgba[3] ?? 255;

  const toHex = (n: number) => {
    const hex = n.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  if (a === 255) {
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
}

/** Packed 0xRRGGBB int (as used by knit status color fields) → #rrggbb. */
export function rgbIntToHex(color: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function computePixelGrid(
  options: ComputePixelGridOptions,
): PixelCell[][] {
  const bits = options.bits;
  const imageWidth = bits.length > 0 ? bits[0].length : 0;
  const machineWidth = options.machineWidth ?? 0;
  const size = options.stitchSize ?? 10;
  const showBar = options.showBar ?? false;
  const barHalfCount = Math.floor(machineWidth / 2);
  const imageLeftNeedle = showBar
    ? Math.floor((options.imageOffsetPx ?? 0) / size)
    : 0;
  const bedHalf = options.barHalf ?? barHalfCount;
  const middleCol = imageWidth ? Math.floor(imageWidth / 2) : 0;

  const pixelRows: PixelCell[][] = [];
  for (let rowIndex = 0; rowIndex < bits.length; rowIndex++) {
    const rowBits = bits[rowIndex];
    const rowCells: PixelCell[] = [];
    for (let colIndex = 0; colIndex < rowBits.length; colIndex++) {
      const borderColor = showBar
        ? imageLeftNeedle + colIndex < bedHalf
          ? NEEDLE_GRID_BORDER_LEFT
          : NEEDLE_GRID_BORDER_RIGHT
        : colIndex < middleCol
          ? NEEDLE_GRID_BORDER_LEFT
          : NEEDLE_GRID_BORDER_RIGHT;
      rowCells.push({
        backgroundColor: rgbaToHexColor(rowBits[colIndex]),
        borderColor,
      });
    }
    pixelRows.push(rowCells);
  }

  return pixelRows;
}
