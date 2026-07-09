import {
  NEEDLE_BED_GREEN,
  NEEDLE_BED_ORANGE,
} from "constants/src/NeedleColors";
import { KnitProgressRowViewModel } from "./KnitProgressRow";

export interface KnitProgressCellRenderData {
  numberLabel: string;
  isLeftNumber: boolean;
  backgroundColor: string;
}

export function colorToHex(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, "0")}`;
}

export function isColumnSelected(bits: Uint8Array, column: number): boolean {
  const byteIndex = Math.floor(column / 8);
  if (byteIndex >= bits.length) return false;
  return ((bits[byteIndex]! >> (column % 8)) & 1) !== 0;
}

export function needleNumberFromR1(
  needleIndex: number,
  machineWidth: number,
): string {
  const half = Math.floor(machineWidth / 2);
  const fromR1 = needleIndex - half;
  if (fromR1 < 0) return String(-fromR1);
  return String(1 + fromR1);
}

export function alternateBedHex(
  needleIndex: number,
  machineWidth: number,
): string {
  const half = Math.floor(machineWidth / 2);
  const fromR1 = needleIndex - half;
  const base = fromR1 < 0 ? NEEDLE_BED_ORANGE : NEEDLE_BED_GREEN;
  const stripe = Math.floor(Math.abs(fromR1) / 10) % 2;
  if (stripe === 0) return colorToHex(base);
  const r = (base >> 16) & 0xff;
  const g = (base >> 8) & 0xff;
  const b = base & 0xff;
  return `#${Math.floor(r * 0.85)
    .toString(16)
    .padStart(2, "0")}${Math.floor(g * 0.85)
    .toString(16)
    .padStart(2, "0")}${Math.floor(b * 0.85)
    .toString(16)
    .padStart(2, "0")}`;
}

export function knitProgressStitchColor(
  vm: KnitProgressRowViewModel,
  column: number,
  selected: boolean,
): string {
  if (selected) return colorToHex(vm.color);
  if (vm.altColor != null && vm.altColor >= 0) return colorToHex(vm.altColor);
  return alternateBedHex(vm.knitStartNeedle + column, vm.machineWidth);
}

export function computeKnitProgressCells(
  vm: KnitProgressRowViewModel,
): KnitProgressCellRenderData[] {
  const count =
    vm.knitNeedleCount > 0
      ? vm.knitNeedleCount
      : vm.bits.length > 0
        ? vm.bits.length * 8
        : 0;
  if (count <= 0 || vm.machineWidth <= 0) {
    return [];
  }

  const half = Math.floor(vm.machineWidth / 2);
  const cells: KnitProgressCellRenderData[] = [];
  for (let c = 0; c < count; c++) {
    const needle = vm.knitStartNeedle + c;
    const selected = vm.bits.length > 0 && isColumnSelected(vm.bits, c);
    cells.push({
      numberLabel: needleNumberFromR1(needle, vm.machineWidth),
      isLeftNumber: needle < half,
      backgroundColor: knitProgressStitchColor(vm, c, selected),
    });
  }
  return cells;
}
