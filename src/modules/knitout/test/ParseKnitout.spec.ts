import "jasmine/src/jasmine";
import { analyzeKnitout } from "knitout/src/AnalyzeKnitout";
import { parseKnitout } from "knitout/src/ParseKnitout";

describe("parseKnitout", () => {
  it("parses headers, source comments, carriers, and every core operand shape", () => {
    const result = parseKnitout(`;!knitout-2
;;Carriers: A B
inhook A
stitch 2 3
rack -1.5
knit + f1 A ;!source: pattern.ts:7
tuck - b2 B
miss + fs3 A
split - b2 f3 B
drop f1
amiss b2
xfer f1 b1
pause
x-speed-number 5
outhook A
`);
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.document.version).toBe(2);
    expect(result.document.declaredCarriers).toEqual(["A", "B"]);
    expect(result.document.operations.map((operation) => operation.opcode)).toEqual([
      "inhook",
      "stitch",
      "rack",
      "knit",
      "tuck",
      "miss",
      "split",
      "drop",
      "amiss",
      "xfer",
      "pause",
      "x-speed-number",
      "outhook",
    ]);
    const knit = result.document.operations[3];
    expect(knit?.source).toBe("pattern.ts:7");
  });

  it("reports line-specific syntax errors without throwing", () => {
    const result = parseKnitout(`;!knitout-2
;;Carriers: A
knit sideways f1 A
xfer f1 nope
mystery + f2 A
`);
    expect(result.ok).toBeFalse();
    if (result.ok) return;
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "invalidDirection",
      "invalidNeedle",
      "unknownOpcode",
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.line)).toEqual([3, 4, 5]);
  });

  it("accepts future versions and CRLF with warnings", () => {
    const result = parseKnitout(";!knitout-3\r\n;;Carriers: A\r\nknit + f1 A\r\n");
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "nonStandardLineEnding",
      "unsupportedVersion",
    ]);
  });

  it("analyzes used beds, carriers, extents, and pass candidates", () => {
    const parsed = parseKnitout(`;!knitout-2
;;Carriers: A B
knit + f-2 A
knit + f-1 B
pause
knit - b4 A
`);
    expect(parsed.ok).toBeTrue();
    if (!parsed.ok) return;
    const analysis = analyzeKnitout(parsed.document, parsed.diagnostics);
    expect(analysis.operationCount).toBe(4);
    expect(analysis.candidatePasses).toBe(2);
    expect(analysis.carriers).toEqual(["A", "B"]);
    expect(analysis.usedBeds).toEqual(["f", "b"]);
    expect(analysis.minNeedle).toBe(-2);
    expect(analysis.maxNeedle).toBe(4);
  });
});
