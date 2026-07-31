import { repeat, stretch } from "preview/src/ImageTransform";
import { Machine } from "state_machine/src/Machine";
import { Alignment, Mode } from "constants/src/StateMachineConstants";
import { ImageSettings } from "image_settings/src/ImageSettingsComponent";
import {
  clampNeedleOffsets,
  needleDefaultsForImageWidth,
} from "image_settings/src/ImageSettingsLogic";
import { NeedleColor } from "image_settings/src/Types";

export interface RepeatedImageState {
  sourceImageBits: Uint8Array[][];
  /** Row memos (ayab-desktop#779) aligned to sourceImageBits, pre-transform. */
  sourceRowMemos: string[];
  stretchH: number;
  stretchV: number;
  repeatH: number;
  repeatV: number;
  imageBits: Uint8Array[][];
  imageWidth: number;
  imageHeight: number;
  imageBitsRevision: number;
  /** Row memos aligned to imageBits, post-transform. See rowMemosForTransform. */
  rowMemos: string[];
}

/**
 * Settings to apply when a new image loads: the needle window snaps to the
 * image-fit suggestion (clamped to the bed) and the start row resets, while
 * any user-chosen non-needle fields carry over. Owned by the host so the
 * behavior doesn't depend on an ImageSettings panel being mounted (compact
 * layouts mount the panel lazily in a drawer).
 */
export function settingsForLoadedImage(
  imageWidth: number,
  machine: Machine,
  previous: ImageSettings | undefined,
): ImageSettings {
  const machineWidth = Machine.width(machine);
  const defaults = needleDefaultsForImageWidth(imageWidth);
  const clamped = clampNeedleOffsets(
    defaults.startNeedleOffset,
    defaults.stopNeedleOffset,
    machineWidth,
  );
  return {
    mode: previous?.mode ?? Mode.SINGLEBED,
    numColors: previous?.numColors ?? 2,
    infRepeat: previous?.infRepeat ?? false,
    alignment: previous?.alignment ?? Alignment.CENTER,
    autoMirror: previous?.autoMirror ?? false,
    startRow: 0,
    startNeedle: NeedleColor.calculateNeedle(
      defaults.startNeedleColor,
      clamped.startNeedleOffset,
      machineWidth,
    ),
    stopNeedle: NeedleColor.calculateNeedle(
      defaults.stopNeedleColor,
      clamped.stopNeedleOffset,
      machineWidth,
    ),
  };
}

/**
 * Row memos (ayab-desktop#779) after vertical stretch/repeat, matching
 * transforms.py: stretch resamples rows (interpolated/duplicated), which has
 * no well-defined per-row memo mapping, so it drops memos entirely; repeat
 * tiles whole rows, so memos tile the same way (`self.memos = self.memos * v`).
 */
export function rowMemosForTransform(
  sourceRowMemos: string[],
  repeatV: number,
  stretchV: number,
): string[] {
  if (sourceRowMemos.length === 0 || stretchV !== 1) {
    return [];
  }
  const tiled: string[] = [];
  for (let i = 0; i < repeatV; i++) {
    tiled.push(...sourceRowMemos);
  }
  return tiled;
}

export function buildRepeatedImageState(
  source: Uint8Array[][],
  repeatH: number,
  repeatV: number,
  imageBitsRevision: number,
  stretchH = 1,
  stretchV = 1,
  sourceRowMemos: string[] = [],
): RepeatedImageState {
  const scaled = stretch(source, stretchV, stretchH);
  const imageBits = repeat(scaled, repeatV, repeatH);
  const imageHeight = imageBits.length;
  const imageWidth = imageHeight > 0 ? imageBits[0]!.length : 0;
  return {
    sourceImageBits: source,
    sourceRowMemos,
    stretchH,
    stretchV,
    repeatH,
    repeatV,
    imageBits,
    imageWidth,
    imageHeight,
    imageBitsRevision: imageBitsRevision + 1,
    rowMemos: rowMemosForTransform(sourceRowMemos, repeatV, stretchV),
  };
}
