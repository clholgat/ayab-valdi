import "jasmine/src/jasmine";
import { machineJobTextChecksum } from "machine_job/src/MachineJobChecksum";

describe("machineJobTextChecksum", () => {
  it("matches standard SHA-256 vectors", () => {
    expect(machineJobTextChecksum("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(machineJobTextChecksum("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(machineJobTextChecksum("Knit ✨")).toBe("907895c2b4debc3bbf38a918ccf55fcbb99d366fe01efdeab020d6a79e950d66");
  });
});
