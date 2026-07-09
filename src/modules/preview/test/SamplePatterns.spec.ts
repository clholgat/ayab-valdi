import { patternRegistryKey } from "../src/SamplePatterns";

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
});
