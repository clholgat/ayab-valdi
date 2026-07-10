/**
 * Single sans-serif stack for all Valdi `font` attributes (format: "family size [unscaled]").
 * Weight is NOT a separate token - Valdi's font parser resolves it from a
 * "-weight" suffix on the family name itself (e.g. "sans-serif-bold"), so
 * bold variants must be requested via a distinct family name, not a third
 * space-separated token (that position is only ever checked for the literal
 * "unscaled" flag and silently ignored otherwise).
 */
const SANS = "sans-serif";
const SANS_BOLD = "sans-serif-bold";

export function sansFont(size: number): string {
  return `${SANS} ${size}`;
}

export function sansBoldFont(size: number): string {
  return `${SANS_BOLD} ${size}`;
}

/** CoreButton SMALL sizing — matches SUBHEADLINE_EMPHASIS at 14px. */
export const BUTTON_FONT_SMALL = sansBoldFont(14);

/** CoreButton TINY sizing — matches CAPTION_EMPHASIS at 12px. */
export const BUTTON_FONT_TINY = sansBoldFont(12);
