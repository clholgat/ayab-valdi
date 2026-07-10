import "jasmine/src/jasmine";
import { sansFont, sansBoldFont, BUTTON_FONT_SMALL, BUTTON_FONT_TINY } from "constants/src/Typography";

describe("Typography", () => {
  it("sansFont uses the plain family name with no weight suffix", () => {
    expect(sansFont(14)).toBe("sans-serif 14");
  });

  it("sansBoldFont encodes weight as a '-bold' suffix on the family name", () => {
    // Valdi's font-string parser (snap_drawing FontStyle::getFamilyNameAndFontWeight)
    // resolves weight from a hyphen suffix on the family/first token - e.g.
    // "sans-serif-bold" - not from a third space-separated token like "600".
    // A numeric third token is only ever checked for the literal "unscaled"
    // flag, so it was silently ignored and never made text render bold.
    expect(sansBoldFont(16)).toBe("sans-serif-bold 16");
  });

  it("BUTTON_FONT_SMALL and BUTTON_FONT_TINY use the bold family suffix", () => {
    expect(BUTTON_FONT_SMALL).toBe("sans-serif-bold 14");
    expect(BUTTON_FONT_TINY).toBe("sans-serif-bold 12");
  });
});
