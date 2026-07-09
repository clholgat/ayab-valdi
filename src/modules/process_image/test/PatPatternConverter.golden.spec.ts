import "jasmine/src/jasmine";
import { patPatternFromBytes } from "process_image/src/PatPatternConverter";
import {
  decodePatFixtureBase64,
  patGoldenFixtures,
} from "./fixtures/patGoldenFixtures";

describe("PatPatternConverter golden parity", () => {
  for (const [name, golden] of Object.entries(patGoldenFixtures)) {
    it(`matches ayab-desktop Python oracle for ${name}.pat`, () => {
      const bytes = decodePatFixtureBase64(golden.base64);
      expect(bytes.length).toBe(golden.byteLength);

      const result = patPatternFromBytes(bytes);
      expect(result.width).toBe(golden.width);
      expect(result.height).toBe(golden.height);
      expect(Array.from(result.rgb)).toEqual(Array.from(golden.rgb));
    });
  }
});
