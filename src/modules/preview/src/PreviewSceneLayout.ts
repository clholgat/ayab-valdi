/**
 * Scene layout math for ZoomablePreviewViewport — stitch sizing, bar geometry, alignment.
 */

import { Style } from "valdi_core/src/Style";
import { View, Layout } from "valdi_tsx/src/NativeTemplateElements";
import { Alignment } from "constants/src/StateMachineConstants";
import { Pattern } from "state_machine/src/Pattern";
import { ZoomablePreviewViewportViewModel } from "./PreviewViewportTypes";

const NEEDLE_MARKER_WIDTH = 2;
export const PREVIEW_BAR_HEIGHT = 14;
const DEFAULT_STITCH_SIZE = 6;

export interface SceneLayout {
  hasMachineScene: boolean;
  stitchSize: number;
  /** Vertical pixel height per stitch (aspect ratio may compress rows). */
  stitchSizeY: number;
  contentWidth: number;
  contentHeight: number;
  barPixelStyle: Style<View>;
  barRowStyle: Style<Layout>;
  barHalf: number;
  needleMarkerStartStyle: Style<View>;
  needleMarkerStopStyle: Style<View>;
  imageOffsetPx: number;
}

function needleMarkerStyle(leftPx: number, height: number): Style<View> {
  return new Style<View>({
    position: "absolute",
    top: 0,
    left: leftPx,
    width: NEEDLE_MARKER_WIDTH,
    height,
    backgroundColor: "#333",
    marginLeft: -NEEDLE_MARKER_WIDTH / 2,
  });
}

/** Total marker height: needle bar plus every pattern row. */
export function needleMarkerHeight(
  imageHeight: number,
  stitchSizeY: number,
): number {
  return PREVIEW_BAR_HEIGHT + imageHeight * stitchSizeY;
}

/** Vertical stitch scale from aspect ratio preference (desktop scene.py zoom Y). */
export function aspectRatioVerticalScale(aspectRatio: number): number {
  return 1.0 - 0.2 * aspectRatio;
}

export function computeSceneLayout(
  vm: ZoomablePreviewViewportViewModel,
  viewportWidth: number | undefined,
  zoomScale: number,
): SceneLayout {
  const machineWidth = vm.machineWidth;
  const hasMachineScene =
    machineWidth != null &&
    machineWidth > 0 &&
    vm.startNeedle != null &&
    vm.stopNeedle != null;

  let baseStitchSize = DEFAULT_STITCH_SIZE;
  if (hasMachineScene) {
    baseStitchSize =
      viewportWidth != null && viewportWidth > 0
        ? viewportWidth / machineWidth!
        : DEFAULT_STITCH_SIZE;
  } else if (viewportWidth != null && viewportWidth > 0 && vm.imageWidth > 0) {
    baseStitchSize = viewportWidth / vm.imageWidth;
  }

  // Rounded to a whole pixel so every downstream measurement (grid cells laid
  // out by flexbox, needle marker lines, row-progress overlay) accumulates
  // from the exact same integral unit. A fractional stitchSize causes the
  // flexbox-rendered cells and the absolutely-positioned overlays to round
  // independently, drifting apart differently at different zoom levels.
  const stitchSize = Math.max(1, Math.round(baseStitchSize * zoomScale));
  const stitchSizeY = Math.max(
    1,
    Math.round(stitchSize * aspectRatioVerticalScale(vm.aspectRatio ?? 0)),
  );
  const contentWidth = hasMachineScene
    ? machineWidth! * stitchSize
    : vm.imageWidth * stitchSize;
  const contentHeight =
    (hasMachineScene ? PREVIEW_BAR_HEIGHT : 0) + vm.imageHeight * stitchSizeY;

  if (!hasMachineScene) {
    return {
      hasMachineScene: false,
      stitchSize,
      stitchSizeY,
      contentWidth,
      contentHeight,
      barPixelStyle: new Style<View>({ width: 0, height: 0 }),
      barRowStyle: new Style<Layout>({ flexDirection: "row", width: 0 }),
      barHalf: 0,
      needleMarkerStartStyle: needleMarkerStyle(0, 0),
      needleMarkerStopStyle: needleMarkerStyle(0, 0),
      imageOffsetPx: 0,
    };
  }

  const startNeedle = vm.startNeedle ?? 0;
  const stopNeedle = vm.stopNeedle ?? Math.max(0, machineWidth! - 1);
  const knitEndNeedleExclusive = stopNeedle + 1;
  const barRowWidth = machineWidth! * stitchSize;
  const startPx = startNeedle * stitchSize;
  const stopPx = knitEndNeedleExclusive * stitchSize;
  const imageLeftNeedle = Pattern.calcImageStartNeedle(
    vm.alignment ?? Alignment.CENTER,
    startNeedle,
    knitEndNeedleExclusive,
    vm.imageWidth,
  );
  const markerHeight = needleMarkerHeight(vm.imageHeight, stitchSizeY);

  return {
    hasMachineScene: true,
    stitchSize,
    stitchSizeY,
    contentWidth,
    contentHeight,
    barPixelStyle: new Style<View>({
      width: stitchSize,
      height: PREVIEW_BAR_HEIGHT,
      flexShrink: 0,
    }),
    barRowStyle: new Style<Layout>({
      flexDirection: "row",
      width: barRowWidth,
    }),
    barHalf: Math.floor(machineWidth! / 2),
    needleMarkerStartStyle: needleMarkerStyle(startPx, markerHeight),
    needleMarkerStopStyle: needleMarkerStyle(stopPx, markerHeight),
    imageOffsetPx: imageLeftNeedle * stitchSize,
  };
}

export function centeredHorizontalOffset(
  viewportWidth: number,
  contentWidth: number,
): number {
  if (viewportWidth <= 0 || contentWidth <= viewportWidth) {
    return 0;
  }
  return Math.round((contentWidth - viewportWidth) / 2);
}

/**
 * Grey knit-progress band height in pixels (desktop scene.py row_progress overlay).
 * Grows upward from the bottom of the image as rows complete.
 */
export function rowProgressOverlayHeight(
  currentRow: number,
  totalRows: number,
  imageHeight: number,
  stitchSize: number,
): number {
  if (currentRow < 0 || totalRows <= 0 || imageHeight <= 0 || stitchSize <= 0) {
    return 0;
  }
  const completedRows = Math.min(currentRow, imageHeight);
  return completedRows * stitchSize;
}
