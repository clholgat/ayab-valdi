import "jasmine/src/jasmine";
import { PatternImportError } from "process_image/src/PatternImportBinary";
import { stpPatternFromBytes } from "process_image/src/StpPatternConverter";
import { decodeStpFixtureBase64, stpGoldenFixtures } from "./fixtures/stpGoldenFixtures";

describe("StpPatternConverter malformed input", () => {
  it("throws instead of hanging when no block ever matches the target height", () => {
    // A synthetic buffer with a valid header/dims but an entirely empty
    // (zero-filled) color-block region: checkStpHeader/checkStpDims pass,
    // but decryptNextBlock reads nothing but zero-height blocks and will
    // never find one matching the declared height. Before the fix this
    // looped forever (pos kept advancing on phantom zero-size blocks past
    // the end of the buffer); it must now throw instead.
    const data = new Uint8Array(260);
    data[0] = 0x44;
    data[1] = 0x37;
    data[2] = 0x63; // "D7c" header
    data[3] = 2;
    data[4] = 0; // width = 2
    data[5] = 2;
    data[6] = 0; // height = 2 (never actually present in the block region)

    expect(() => stpPatternFromBytes(data)).toThrow();
    try {
      stpPatternFromBytes(data);
      fail("expected PatternImportError");
    } catch (error) {
      expect(error instanceof PatternImportError).toBe(true);
      expect((error as PatternImportError).code).toBe(-5);
    }
  });

  it("still decodes a well-formed file correctly (no regression from the bounds check)", () => {
    const golden = stpGoldenFixtures.minimal_red_2x2;
    const bytes = decodeStpFixtureBase64(golden.base64);
    const result = stpPatternFromBytes(bytes);
    expect(result.width).toBe(golden.width);
    expect(result.height).toBe(golden.height);
    expect(Array.from(result.rgb)).toEqual(Array.from(golden.rgb));
  });
});
