/** Single sans-serif stack for all Valdi `font` attributes (format: "family size [weight]"). */
const SANS = "sans-serif";

export function sansFont(size: number): string {
  return `${SANS} ${size}`;
}

export function sansBoldFont(size: number): string {
  return `${SANS} ${size} 600`;
}

/** CoreButton SMALL sizing — matches SUBHEADLINE_EMPHASIS at 14px. */
export const BUTTON_FONT_SMALL = sansBoldFont(14);

/** CoreButton TINY sizing — matches CAPTION_EMPHASIS at 12px. */
export const BUTTON_FONT_TINY = sansBoldFont(12);
