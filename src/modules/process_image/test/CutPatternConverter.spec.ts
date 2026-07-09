import "jasmine/src/jasmine";
import { cutPatternFromBytes } from "process_image/src/CutPatternConverter";

function buildMinimalCut(width: number, height: number, color: number): Uint8Array {
  const rowChunks: Uint8Array[] = [];
  for (let row = 0; row < height; row++) {
    // Row body: RLE run + EOL marker (run == 0).
    const body = new Uint8Array(3);
    body[0] = 0x80 | width;
    body[1] = color;
    body[2] = 0;
    const chunk = new Uint8Array(2 + body.length);
    chunk[0] = body.length;
    chunk[1] = 0;
    chunk.set(body, 2);
    rowChunks.push(chunk);
  }
  const bodySize = rowChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buf = new Uint8Array(6 + bodySize);
  buf[0] = width & 0xff;
  buf[1] = (width >> 8) & 0xff;
  buf[2] = height & 0xff;
  buf[3] = (height >> 8) & 0xff;
  buf[4] = 0;
  buf[5] = 0;
  let pos = 6;
  for (const chunk of rowChunks) {
    buf.set(chunk, pos);
    pos += chunk.length;
  }
  return buf;
}

describe("CutPatternConverter", () => {
  it("decodes a minimal grey .cut pattern", () => {
    const bytes = buildMinimalCut(2, 2, 128);
    const result = cutPatternFromBytes(bytes);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.rgb.length).toBe(12);
    expect(result.rgb[0]).toBe(128);
  });

  it("rejects invalid headers", () => {
    const bytes = buildMinimalCut(2, 2, 1);
    bytes[4] = 1;
    try {
      cutPatternFromBytes(bytes);
      fail("expected PatternImportError");
    } catch (error) {
      expect((error as Error).name).toBe("PatternImportError");
    }
  });
});