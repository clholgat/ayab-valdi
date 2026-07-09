import "jasmine/src/jasmine";
import {
  getPreviewSideLabel,
  KNIT_SIDE_IMAGE_HINT,
} from "preview/src/KnitSidePreviewLogic";

describe("KnitSidePreviewLogic", () => {
  it("describes the knit side toggle purpose", () => {
    expect(KNIT_SIDE_IMAGE_HINT).toContain("finished knit");
  });

  it("labels purl side when autoMirror is off", () => {
    expect(getPreviewSideLabel(false)).toBe("Viewing: purl side");
  });

  it("labels knit side when autoMirror is on", () => {
    expect(getPreviewSideLabel(true)).toBe("Viewing: knit side");
  });
});
