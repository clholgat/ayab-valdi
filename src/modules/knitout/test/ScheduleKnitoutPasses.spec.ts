import "jasmine/src/jasmine";
import { parseKnitout } from "knitout/src/ParseKnitout";
import { scheduleKnitoutPasses } from "knitout/src/ScheduleKnitoutPasses";

function schedule(text: string): ReturnType<typeof scheduleKnitoutPasses> {
  const parsed = parseKnitout(text);
  if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message);
  return scheduleKnitoutPasses(parsed.document);
}

describe("scheduleKnitoutPasses", () => {
  it("groups monotonic knits and retains prompts at safe boundaries", () => {
    const result = schedule(`;!knitout-2
;;Carriers: A
inhook A
knit - f3 A
knit - f2 A
knit - f1 A
pause ;Change yarn now.
knit + f1 A
knit + f2 A
knit + f3 A
outhook A
`);
    expect(result.diagnostics).toEqual([]);
    expect(result.passes.length).toBe(2);
    expect(result.passes[0]!.promptsBefore[0]!.kind).toBe("yarnChange");
    expect(result.passes[1]!.promptsBefore[0]!.text).toBe("Change yarn now.");
    expect(result.passes[1]!.promptsAfter[0]!.kind).toBe("yarnChange");
  });

  it("rejects non-alternating, non-contiguous, back-bed, and unsupported operations", () => {
    const result = schedule(`;!knitout-2
;;Carriers: A
knit + f1 A
knit + f3 A
pause
knit + b1 A
xfer f1 b1
`);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "nonContiguousPass",
      "unsupportedBed",
      "nonAlternatingDirection",
      "unsupportedOpcode",
    ]);
  });

  it("rejects unknown extensions for execution", () => {
    const result = schedule(`;!knitout-2
;;Carriers: A
;;X-Foo: bar
x-speed-number 5
knit + f1 A
`);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "unsupportedExtensionHeader",
      "unsupportedExtensionOpcode",
    ]);
  });

  it("rejects lifecycle prompts for carriers absent from executable passes", () => {
    const result = schedule(`;!knitout-2
;;Carriers: A B
inhook B
knit + f1 A
`);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "unusedLifecycleCarrier",
    ]);
    expect(result.diagnostics[0]!.line).toBe(3);
  });
});
