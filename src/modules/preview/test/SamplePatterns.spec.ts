import {
  patternRegistryKey,
  SAMPLE_PATTERN_SECTIONS,
} from "../src/SamplePatterns";

describe("SamplePatterns", () => {
  it("maps tutorial filenames to web registry keys", () => {
    expect(patternRegistryKey("triangles_60x10.png")).toBe("triangles60x10");
    expect(patternRegistryKey("test_pattern_200x40.png")).toBe(
      "testPattern200x40",
    );
  });

  it("keeps dotted KH-910 filenames as registry keys", () => {
    expect(patternRegistryKey("1.01.png")).toBe("1.01");
    expect(patternRegistryKey("10.36.png")).toBe("10.36");
  });

  it("includes every locally synced annotated AYAB pattern", () => {
    const annotated = SAMPLE_PATTERN_SECTIONS.find(
      (section) => section.id === "annotated",
    );
    expect(annotated).toBeDefined();
    expect(annotated!.patterns.length).toBe(480);
    expect(annotated!.patterns[0]!.resource).toBe(
      "preview:annotated/stitchworld-004",
    );
  });
});
