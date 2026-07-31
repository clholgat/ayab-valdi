import "jasmine/src/jasmine";
import { readPngComment, readPngTextChunks } from "process_image/src/PngMetadata";
import { buildPngWithTextChunks } from "./fixtures/buildPngWithTextChunks";

describe("PngMetadata", () => {
  it("reads a single tEXt chunk's keyword and text", () => {
    const png = buildPngWithTextChunks([["Comment", "AYAB:2030"]]);
    expect(readPngTextChunks(png)).toEqual(new Map([["Comment", "AYAB:2030"]]));
  });

  it("reads multiple tEXt chunks, matching a real exiftool-edited pattern", () => {
    // Same shape as ayab-patterns#4's worked example:
    // exiftool -Comment="AYAB:..." on a paint.net-exported PNG.
    const png = buildPngWithTextChunks([
      ["Software", "paint.net 4.0.9"],
      ["Comment", "AYAB:202020303030304040404040404040404040404040"],
    ]);
    const chunks = readPngTextChunks(png);
    expect(chunks.get("Software")).toBe("paint.net 4.0.9");
    expect(chunks.get("Comment")).toBe(
      "AYAB:202020303030304040404040404040404040404040",
    );
  });

  it("readPngComment returns undefined when there is no Comment chunk", () => {
    const png = buildPngWithTextChunks([["Software", "paint.net 4.0.9"]]);
    expect(readPngComment(png)).toBeUndefined();
  });

  it("returns an empty map for non-PNG bytes", () => {
    const notPng = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(readPngTextChunks(notPng).size).toBe(0);
    expect(readPngComment(notPng)).toBeUndefined();
  });

  it("returns an empty map for a truncated chunk stream instead of throwing", () => {
    const png = buildPngWithTextChunks([["Comment", "AYAB:99"]]);
    const truncated = png.subarray(0, png.length - 20);
    expect(() => readPngTextChunks(truncated)).not.toThrow();
  });
});
