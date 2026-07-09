import "jasmine/src/jasmine";
import { stpPatternFromBytes } from "process_image/src/StpPatternConverter";
import {
  decodeStpFixtureBase64,
  stpGoldenFixtures,
} from "./fixtures/stpGoldenFixtures";

describe("StpPatternConverter golden parity", () => {
  for (const [name, golden] of Object.entries(stpGoldenFixtures)) {
    it(`matches ayab-desktop Python oracle for ${name}.stp`, () => {
      const bytes = decodeStpFixtureBase64(golden.base64);
      expect(bytes.length).toBe(golden.byteLength);

      const result = stpPatternFromBytes(bytes);
      expect(result.width).toBe(golden.width);
      expect(result.height).toBe(golden.height);
      expect(Array.from(result.rgb)).toEqual(Array.from(golden.rgb));
    });
  }
});
