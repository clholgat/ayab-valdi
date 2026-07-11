import "jasmine/src/jasmine";
import { sansFont, sansBoldFont, BUTTON_FONT_SMALL, BUTTON_FONT_TINY } from "constants/src/Typography";

describe("Typography", () => {
  it("sansFont uses the plain family name with no weight token", () => {
    expect(sansFont(14)).toBe("sans-serif 14");
  });

  it("sansBoldFont encodes weight as a third space-separated token", () => {
    // The web renderer (ValdiWebStyles.ts) parses "family size weight" via a
    // plain space-split and maps weight straight to CSS font-weight, so
    // "600" here is what actually renders bold on the tested (web) platform.
    // A "-bold" suffix on the family name looks correct for Valdi's native
    // parser but breaks web, since "sans-serif-bold" isn't a real font and
    // the web renderer has no special-casing for it.
    expect(sansBoldFont(16)).toBe("sans-serif 16 600");
  });

  it("BUTTON_FONT_SMALL and BUTTON_FONT_TINY use the bold weight token", () => {
    expect(BUTTON_FONT_SMALL).toBe("sans-serif 14 600");
    expect(BUTTON_FONT_TINY).toBe("sans-serif 12 600");
  });
});
