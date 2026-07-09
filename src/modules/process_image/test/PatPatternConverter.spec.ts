import "jasmine/src/jasmine";
import {
  PatPatternConverterError,
  patPatternFromBytes,
  patToRgbaBits,
  isPatFileName,
} from "process_image/src/PatPatternConverter";
import { buildMinimalPat } from "./fixtures/buildMinimalPat";

describe("PatPatternConverter", () => {
  it("isPatFileName detects .pat extension", () => {
    expect(isPatFileName("pattern.pat")).toBe(true);
    expect(isPatFileName("Pattern.PAT")).toBe(true);
    expect(isPatFileName("image.png")).toBe(false);
  });

  it("decodes a minimal 2x2 .pat into RGB pixels", () => {
    const data = buildMinimalPat();
    const { rgb, width, height } = patPatternFromBytes(data);

    expect(width).toBe(2);
    expect(height).toBe(2);
    expect(rgb.length).toBe(12);
    for (let i = 0; i < 4; i++) {
      expect(rgb[i * 3]).toBe(255);
      expect(rgb[i * 3 + 1]).toBe(0);
      expect(rgb[i * 3 + 2]).toBe(0);
    }
  });

  it("patToRgbaBits returns Uint8Array rows with alpha 255", () => {
    const data = buildMinimalPat({ rgb: [0, 128, 255] });
    const { bits, width, height } = patToRgbaBits(data);

    expect(width).toBe(2);
    expect(height).toBe(2);
    expect(bits.length).toBe(2);
    expect(bits[0]!.length).toBe(2);
    expect(bits[0]![0]).toEqual(new Uint8Array([0, 128, 255, 255]));
  });

  it("rejects unknown file headers", () => {
    const data = buildMinimalPat();
    data[0] = 0x58;
    try {
      patPatternFromBytes(data);
      fail("expected PatPatternConverterError");
    } catch (error) {
      expect(error instanceof PatPatternConverterError).toBe(true);
      expect((error as PatPatternConverterError).code).toBe(-4);
    }
  });

  it("rejects dimensions above the DAK limit", () => {
    const data = buildMinimalPat({ width: 501, height: 2 });
    try {
      patPatternFromBytes(data);
      fail("expected PatPatternConverterError");
    } catch (error) {
      expect(error instanceof PatPatternConverterError).toBe(true);
      expect((error as PatPatternConverterError).code).toBe(-2);
    }
  });
});
