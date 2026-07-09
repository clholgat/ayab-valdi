import "jasmine/src/jasmine";
import {
  loadPatternFromSelection,
  resolvePatternFileBytes,
} from "process_image/src/PatternFileLoader";
import { buildMinimalPat } from "./fixtures/buildMinimalPat";

describe("PatFileLoader", () => {
  it("resolvePatternFileBytes decodes dataUrl", () => {
    const pat = buildMinimalPat();
    let binary = "";
    for (let i = 0; i < pat.length; i++) {
      binary += String.fromCharCode(pat[i]!);
    }
    const dataUrl = `data:application/octet-stream;base64,${btoa(binary)}`;
    const bytes = resolvePatternFileBytes({ dataUrl });
    expect(Array.from(bytes)).toEqual(Array.from(pat));
  });

  it("loadPatternFromSelection converts .pat dataUrl to rgba bits", () => {
    const pat = buildMinimalPat();
    let binary = "";
    for (let i = 0; i < pat.length; i++) {
      binary += String.fromCharCode(pat[i]!);
    }
    const dataUrl = `data:application/octet-stream;base64,${btoa(binary)}`;
    const { bits, width, height } = loadPatternFromSelection({
      dataUrl,
      fileName: "test.pat",
    });
    expect(width).toBe(2);
    expect(height).toBe(2);
    expect(bits.length).toBe(2);
    expect(bits[0]![0]![0]).toBe(255);
  });

  it("resolvePatternFileBytes throws when no contents", () => {
    expect(() => resolvePatternFileBytes({})).toThrowError(
      /No pattern file contents/,
    );
  });
});
