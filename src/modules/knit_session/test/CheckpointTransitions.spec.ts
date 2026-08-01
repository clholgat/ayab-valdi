import "jasmine/src/jasmine";
import {
  acknowledgePrompt,
  completePass,
  createCheckpoint,
  finishCheckpoint,
  rewindToPass,
} from "knit_session/src/CheckpointTransitions";
import { validateCheckpointForResume } from "knit_session/src/ExecutionCheckpoint";

const identity = { jobId: "job-1", checksum: "sha256:abc" };

describe("checkpoint transitions", () => {
  it("advances only at the expected pass boundary", () => {
    const initial = createCheckpoint({ identity, machineProfileId: "ayab-200", now: "t0" });
    const advanced = completePass(initial, 0, "pass-1", "right", "t1");
    expect(initial.nextPassIndex).toBe(0);
    expect(advanced.nextPassIndex).toBe(1);
    expect(advanced.lastCompletedPassId).toBe("pass-1");
    expect(() => completePass(advanced, 0, "pass-1", "right", "t2")).toThrow();
  });

  it("retains acknowledgements and an explicit rewind audit", () => {
    let checkpoint = createCheckpoint({ identity, machineProfileId: "ayab-200", now: "t0" });
    checkpoint = acknowledgePrompt(checkpoint, "prompt-1", "t1");
    checkpoint = completePass(checkpoint, 0, "pass-1", "right", "t2");
    checkpoint = rewindToPass(checkpoint, 0, undefined, "left", "t3");
    expect(checkpoint.acknowledgedPromptIds).toEqual(["prompt-1"]);
    expect(checkpoint.corrections[0]!.fromPassIndex).toBe(1);
    expect(checkpoint.nextPassIndex).toBe(0);
    expect(checkpoint.expectedSide).toBe("left");
  });

  it("rejects resume for changed jobs, profiles, or pass identities", () => {
    let checkpoint = createCheckpoint({ identity, machineProfileId: "ayab-200", now: "t0" });
    checkpoint = completePass(checkpoint, 0, "pass-1", "right", "t1");
    expect(validateCheckpointForResume(checkpoint, { identity, machineProfileId: "other", passIds: ["pass-1"] }).ok).toBeFalse();
    expect(validateCheckpointForResume(checkpoint, { identity: { ...identity, checksum: "changed" }, machineProfileId: "ayab-200", passIds: ["pass-1"] }).ok).toBeFalse();
    expect(validateCheckpointForResume(checkpoint, { identity, machineProfileId: "ayab-200", passIds: ["renamed"] }).ok).toBeFalse();
    checkpoint = finishCheckpoint(checkpoint, "completed", "t2");
    expect(validateCheckpointForResume(checkpoint, { identity, machineProfileId: "ayab-200", passIds: ["pass-1"] }).ok).toBeFalse();
  });
});
