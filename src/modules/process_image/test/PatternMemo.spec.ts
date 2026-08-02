import "jasmine/src/jasmine";
import {
  imageRowsToStoredAyabMemos,
  hasAnyMemo,
  parseAyabMemos,
  storedAyabMemosToImageRows,
} from "process_image/src/PatternMemo";

describe("parseAyabMemos", () => {
  it("parses one memo digit per row from the ayab-patterns#4 worked example", () => {
    const memos = parseAyabMemos(
      "AYAB:202020303030304040404040404040404040404040",
    );
    expect(memos.length).toBe(42);
    expect(memos[0]).toBe("2");
    expect(memos[6]).toBe("3");
    expect(memos[14]).toBe("4");
    expect(memos[memos.length - 2]).toBe("4");
    expect(memos[memos.length - 1]).toBe("0");
  });

  it("returns [] when the comment is missing", () => {
    expect(parseAyabMemos(undefined)).toEqual([]);
  });

  it("returns [] when the comment lacks the AYAB: header", () => {
    expect(parseAyabMemos("paint.net 4.0.9")).toEqual([]);
  });

  it("preserves letter memo codes, matching real StitchWorld/215.png data", () => {
    // ~7% of the 480 genuinely AYAB:-tagged patterns in ayab-patterns use
    // letter codes (not just the spec's suggested digits 0-9) -- the parser
    // must not coerce them to "0" and silently drop real memo data.
    const memos = parseAyabMemos("AYAB:FFF2FFF2FFF2FFF2NNNNNNN2NNNNN2NNN2");
    expect(memos[0]).toBe("F");
    expect(memos[3]).toBe("2");
    expect(memos[16]).toBe("N");
    expect(memos.length).toBe(34);
  });

  it("returns [] for an empty header with no codes", () => {
    expect(parseAyabMemos("AYAB:")).toEqual([]);
  });
});

describe("AYAB memo row orientation", () => {
  it("maps bottom-up stored knitting rows to top-down bitmap rows", () => {
    expect(storedAyabMemosToImageRows(["2", "0", "3", "4"])).toEqual(["4", "3", "0", "2"]);
  });

  it("maps top-down editor rows back to bottom-up PNG storage", () => {
    expect(imageRowsToStoredAyabMemos(["4", "3", "0", "2"])).toEqual(["2", "0", "3", "4"]);
  });
});

describe("hasAnyMemo", () => {
  it("is false when every row is 0", () => {
    expect(hasAnyMemo(["0", "0", "0"])).toBe(false);
  });

  it("is false for an empty list", () => {
    expect(hasAnyMemo([])).toBe(false);
  });

  it("is true when any row has a non-zero memo", () => {
    expect(hasAnyMemo(["0", "0", "3"])).toBe(true);
  });
});
