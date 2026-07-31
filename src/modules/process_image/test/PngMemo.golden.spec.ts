import "jasmine/src/jasmine";
import { readPngComment } from "process_image/src/PngMetadata";
import { parseAyabMemos } from "process_image/src/PatternMemo";
import {
  decodePngMemoFixtureBase64,
  pngMemoGoldenFixtures,
} from "./fixtures/pngMemoGoldenFixtures";

describe("PNG memo golden parity (real ayab-patterns/StitchWorld patterns)", () => {
  for (const [name, fixture] of Object.entries(pngMemoGoldenFixtures)) {
    it(`matches real memo data for ${name}`, () => {
      const bytes = decodePngMemoFixtureBase64(fixture.base64);
      const comment = readPngComment(bytes);
      expect(comment).toBe(fixture.comment);

      const memos = parseAyabMemos(comment);
      expect(memos).toEqual([...fixture.memos]);
      expect(memos.length).toBe(fixture.height);
    });
  }
});
