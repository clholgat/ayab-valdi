import "jasmine/src/jasmine";
import {
  formatKnitRowLabel,
  getKnitActionBannerContent,
  shouldShowKnitActionBanner,
} from "ayab_valdi/src/KnitSessionUiLogic";

describe("KnitSessionUiLogic", () => {
  describe("shouldShowKnitActionBanner", () => {
    it("shows during an active knit session with a message", () => {
      expect(shouldShowKnitActionBanner(true, "Please knit.")).toBe(true);
    });

    it("hides when not knitting", () => {
      expect(shouldShowKnitActionBanner(false, "Please knit.")).toBe(false);
    });

    it("hides when message is empty", () => {
      expect(shouldShowKnitActionBanner(true, "")).toBe(false);
    });
  });

  describe("getKnitActionBannerContent", () => {
    it("maps please knit to a prominent title and subtitle", () => {
      const content = getKnitActionBannerContent("Please knit.");
      expect(content.title).toBe("Please knit");
      expect(content.subtitle).toContain("carriage");
    });

    it("maps transmission finished to two-phase completion copy", () => {
      const content = getKnitActionBannerContent("Pattern completed", "success");
      expect(content.title).toBe("Pattern completed");
      expect(content.subtitle).toContain("double beep");
    });

    it("maps wait-for-init to a short title", () => {
      const content = getKnitActionBannerContent(
        "Please start machine. Set the carriage to mode KC-I or KC-II " +
          "and move the carriage over the left turn mark.",
      );
      expect(content.title).toBe("Start the machine");
      expect(content.subtitle).toContain("KC-I");
    });

    it("maps wrong firmware to ayab-desktop recovery guidance", () => {
      const content = getKnitActionBannerContent(
        "Wrong Arduino firmware version. Update the shield firmware with " +
          "ayab-desktop (Tools → Load AYAB firmware), then reconnect.",
        "blocking",
      );
      expect(content.title).toBe("Update AYAB firmware");
      expect(content.subtitle).toContain("ayab-desktop");
      expect(content.subtitle).toContain("Load AYAB firmware");
      expect(content.level).toBe("blocking");
    });
  });

  describe("formatKnitRowLabel", () => {
    it("formats active row progress", () => {
      expect(formatKnitRowLabel(7, 120)).toBe("Row 7 of 120");
    });

    it("returns null before rows are available", () => {
      expect(formatKnitRowLabel(-1, 120)).toBeNull();
      expect(formatKnitRowLabel(undefined, 120)).toBeNull();
    });
  });
});
