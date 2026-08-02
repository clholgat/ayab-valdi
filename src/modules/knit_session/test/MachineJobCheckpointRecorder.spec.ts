import "jasmine/src/jasmine";
import { AtomicCheckpointStore, CheckpointRepository } from "knit_session/src/CheckpointRepository";
import { MachineJobCheckpointRecorder } from "knit_session/src/MachineJobCheckpointRecorder";

class MemoryStore implements AtomicCheckpointStore {
  values: { [key: string]: string } = {};
  read(key: string): Promise<string | undefined> { return Promise.resolve(this.values[key]); }
  atomicReplace(key: string, value: string): Promise<void> {
    this.values[key] = value;
    return Promise.resolve();
  }
}

describe("MachineJobCheckpointRecorder", () => {
  it("writes the initial state and marks the final safe pass completed", async () => {
    const store = new MemoryStore();
    const recorder = await MachineJobCheckpointRecorder.start(
      new CheckpointRepository(store, "active"),
      {
        identity: { jobId: "job", checksum: "sha256:value" },
        machineProfileId: "machine:0",
        totalPasses: 1,
        now: () => "now",
      },
    );
    expect(recorder.snapshot().nextPassIndex).toBe(0);
    await recorder.recordCompletedPass(0, "pass-1", "right");
    expect(recorder.snapshot().nextPassIndex).toBe(1);
    expect(recorder.snapshot().status).toBe("completed");
    expect(store.values["active.previous"]).toBeDefined();
  });

  it("continues an active checkpoint at its next pass", async () => {
    const store = new MemoryStore();
    const repository = new CheckpointRepository(store, "active");
    const first = await MachineJobCheckpointRecorder.start(repository, {
      identity: { jobId: "job", checksum: "sha256:value" },
      machineProfileId: "machine:0",
      totalPasses: 2,
      now: () => "now",
    });
    await first.recordCompletedPass(0, "pass-1", "right");
    const resumed = MachineJobCheckpointRecorder.resume(
      repository,
      first.snapshot(),
      2,
      () => "later",
    );
    await resumed.recordCompletedPass(1, "pass-2", "left");
    expect(resumed.snapshot().status).toBe("completed");
  });

  it("persists operator acknowledgements before the next pass", async () => {
    const store = new MemoryStore();
    const recorder = await MachineJobCheckpointRecorder.start(
      new CheckpointRepository(store, "active"),
      {
        identity: { jobId: "job", checksum: "sha256:value" },
        machineProfileId: "machine:0",
        totalPasses: 2,
        now: () => "now",
      },
    );
    await recorder.recordAcknowledgedPrompt("shape-before");
    expect(recorder.snapshot().acknowledgedPromptIds).toEqual(["shape-before"]);
    expect(store.values["active"]).toContain("shape-before");
  });

  it("persists the knitted boundary before an after-pass acknowledgement", async () => {
    const store = new MemoryStore();
    const recorder = await MachineJobCheckpointRecorder.start(
      new CheckpointRepository(store, "active"),
      {
        identity: { jobId: "job", checksum: "sha256:value" },
        machineProfileId: "machine:0",
        totalPasses: 2,
        now: () => "now",
      },
    );
    await recorder.recordPassKnitted(0, "pass-1", "right");
    expect(recorder.snapshot().nextPassIndex).toBe(0);
    expect(recorder.snapshot().pendingAfterPass?.passId).toBe("pass-1");
    expect(store.values.active).toContain("pendingAfterPass");
  });
});
