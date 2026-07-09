import { Mode, Alignment } from "constants/src/StateMachineConstants";
import { Machine } from "state_machine/src/Machine";
import { NeedleColor } from "./Types";
import type { ImageSettings } from "./ImageSettingsComponent";

export function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function machineMaxNeedleOffset(machineWidth: number): number {
  return Math.floor(machineWidth / 2);
}

export function clampNeedleOffsets(
  startOffset: number,
  stopOffset: number,
  machineWidth: number,
): { startNeedleOffset: number; stopNeedleOffset: number } {
  const maxOffset = machineMaxNeedleOffset(machineWidth);
  return {
    startNeedleOffset: clampInt(startOffset, 1, maxOffset),
    stopNeedleOffset: clampInt(stopOffset, 1, maxOffset),
  };
}

export function needleDefaultsForImageWidth(imageWidth: number): {
  startNeedleColor: NeedleColor;
  stopNeedleColor: NeedleColor;
  startNeedleOffset: number;
  stopNeedleOffset: number;
} {
  const leftSide = Math.floor(imageWidth / 2);
  return {
    startNeedleColor: NeedleColor.ORANGE,
    stopNeedleColor: NeedleColor.GREEN,
    startNeedleOffset: leftSide,
    stopNeedleOffset: imageWidth - leftSide,
  };
}

/** Brother-style bed label, e.g. "Left 30" or "Right 30". */
export function formatBrotherNeedlePosition(
  color: NeedleColor,
  offset: number,
): string {
  return color === NeedleColor.ORANGE ? `Left ${offset}` : `Right ${offset}`;
}

export const NEEDLE_RANGE_CAST_ON_HINT =
  "Match your cast-on: set Start and Stop to the same bed positions you used when casting on (e.g. Left 30 and Right 30).";

export function buildNeedleRangeSuggestion(
  imageWidth: number,
  machineWidth: number,
): string {
  if (imageWidth <= 0) {
    return "";
  }
  const defaults = needleDefaultsForImageWidth(imageWidth);
  const clamped = clampNeedleOffsets(
    defaults.startNeedleOffset,
    defaults.stopNeedleOffset,
    machineWidth,
  );
  const startLabel = formatBrotherNeedlePosition(
    defaults.startNeedleColor,
    clamped.startNeedleOffset,
  );
  const stopLabel = formatBrotherNeedlePosition(
    defaults.stopNeedleColor,
    clamped.stopNeedleOffset,
  );
  return `Suggested for this ${imageWidth}-stitch pattern: ${startLabel} – ${stopLabel}.`;
}

export interface ImageSettingsFields {
  mode: Mode;
  numColors: number;
  startRow: number;
  infRepeat: boolean;
  startNeedleColor: NeedleColor;
  startNeedleOffset: number;
  stopNeedleColor: NeedleColor;
  stopNeedleOffset: number;
  alignment: Alignment;
  autoMirror: boolean;
}

export function buildImageSettings(
  fields: ImageSettingsFields,
  machine: Machine,
): ImageSettings {
  const machineWidth = Machine.width(machine);
  return {
    mode: fields.mode,
    numColors: fields.numColors,
    startRow: fields.startRow,
    infRepeat: fields.infRepeat,
    startNeedle: NeedleColor.calculateNeedle(
      fields.startNeedleColor,
      fields.startNeedleOffset,
      machineWidth,
    ),
    stopNeedle: NeedleColor.calculateNeedle(
      fields.stopNeedleColor,
      fields.stopNeedleOffset,
      machineWidth,
    ),
    alignment: fields.alignment,
    autoMirror: fields.autoMirror,
  };
}
