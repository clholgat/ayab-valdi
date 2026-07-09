/** Knit-side vs purl-side preview labeling (desktop "Knit side image" parity). */

export const KNIT_SIDE_IMAGE_HINT =
  "Flip preview so text reads correctly on the finished knit (right) side.";

/** Label shown above the preview while a pattern is loaded. */
export function getPreviewSideLabel(autoMirror: boolean): string {
  return autoMirror ? "Viewing: knit side" : "Viewing: purl side";
}
