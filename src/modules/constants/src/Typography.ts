/**
 * Single sans-serif stack for all Valdi `font` attributes (format: "family size [weight]").
 *
 * NOTE: this "family size weight" 3-token format is what the *web* renderer
 * (ValdiWebStyles.ts: `value.split(' ')` -> fontFamily/fontSize/fontWeight)
 * expects, and "sans-serif"/"600" are both valid CSS values there, so bold
 * renders correctly on web. Valdi's *native* font parser instead resolves
 * weight from a "-bold" suffix on the family name (and only recognizes it
 * for the literal built-in names "system"/"system-bold", not arbitrary
 * families like "sans-serif") - the web renderer has no equivalent
 * special-casing, so switching to a "-bold" suffixed family name to satisfy
 * native breaks web (the suffixed name isn't a real font, so the browser
 * falls back to its default - usually serif). There's no single string this
 * codebase's Valdi build accepts that renders bold correctly on both
 * platforms, so this keeps the web-correct format; native bold text
 * (macOS/Android) is a known, separate, currently-unresolved gap.
 */
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
