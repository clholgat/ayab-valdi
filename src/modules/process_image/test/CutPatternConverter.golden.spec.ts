import "jasmine/src/jasmine";
import { cutPatternFromBytes } from "process_image/src/CutPatternConverter";
import {
  cutGoldenFixtures,
  decodeCutFixtureBase64,
} from "./fixtures/cutGoldenFixtures";

describe("CutPatternConverter golden parity", () => {
  for (const [name, golden] of Object.entries(cutGoldenFixtures)) {
    it(`matches golden RGB for ${name}.cut`, () => {
      const bytes = decodeCutFixtureBase64(golden.base64);
      expect(bytes.length).toBe(golden.byteLength);

      const palette =
        golden.paletteBase64 != null
          ? decodeCutFixtureBase64(golden.paletteBase64)
          : undefined;
      if (palette != null) {
        expect(palette.length).toBe(golden.paletteByteLength);
      }

      const result = cutPatternFromBytes(bytes, palette);
      expect(result.width).toBe(golden.width);
      expect(result.height).toBe(golden.height);
      expect(Array.from(result.rgb)).toEqual(Array.from(golden.rgb));
    });
  }
});
