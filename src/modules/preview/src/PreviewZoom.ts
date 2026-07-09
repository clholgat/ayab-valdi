/** Zoom scale helpers for the preview viewport. */

export const PREVIEW_MIN_ZOOM = 0.25;
export const PREVIEW_MAX_ZOOM = 10;
export const PREVIEW_DOUBLE_TAP_ZOOM = 2;

export function clampPreviewZoom(scale: number): number {
  return Math.max(PREVIEW_MIN_ZOOM, Math.min(PREVIEW_MAX_ZOOM, scale));
}

export function zoomToSliderT(zoom: number): number {
  return (
    (clampPreviewZoom(zoom) - PREVIEW_MIN_ZOOM) /
    (PREVIEW_MAX_ZOOM - PREVIEW_MIN_ZOOM)
  );
}

export function sliderTToZoom(t: number): number {
  return clampPreviewZoom(
    PREVIEW_MIN_ZOOM +
      Math.max(0, Math.min(1, t)) * (PREVIEW_MAX_ZOOM - PREVIEW_MIN_ZOOM),
  );
}
