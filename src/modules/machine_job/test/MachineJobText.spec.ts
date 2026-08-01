import "jasmine/src/jasmine";
import { decodeMachineJobText } from "machine_job/src/MachineJobText";

describe("decodeMachineJobText", () => {
  it("decodes ASCII JSON and strips a UTF-8 BOM", () => {
    expect(
      decodeMachineJobText(
        new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x22, 0x61, 0x22, 0x3a, 0x31, 0x7d]),
      ),
    ).toBe('{"a":1}');
  });

  it("decodes multibyte producer text", () => {
    const bytes = new Uint8Array([0x4b, 0x6e, 0x69, 0x74, 0x20, 0xe2, 0x9c, 0xa8]);
    expect(decodeMachineJobText(bytes)).toBe("Knit ✨");
  });

  it("rejects invalid UTF-8", () => {
    expect(() => decodeMachineJobText(new Uint8Array([0xc2, 0x20]))).toThrow();
  });
});
