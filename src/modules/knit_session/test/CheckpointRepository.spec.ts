import "jasmine/src/jasmine";
import { CheckpointRepository, AtomicCheckpointStore } from "knit_session/src/CheckpointRepository";
import { completePass, createCheckpoint } from "knit_session/src/CheckpointTransitions";
import { finishCheckpoint } from "knit_session/src/CheckpointTransitions";

class MemoryStore implements AtomicCheckpointStore {
  values: { [key: string]: string } = {};
  failKey?: string;
  read(key: string): Promise<string | undefined> { return Promise.resolve(this.values[key]); }
  atomicReplace(key: string, value: string): Promise<void> {
    if (key === this.failKey) return Promise.reject(new Error("interrupted write"));
    this.values[key] = value;
    return Promise.resolve();
  }
}

const identity = { jobId: "job-1", checksum: "sha256:abc" };
const context = { identity, machineProfileId: "ayab-200", passIds: ["pass-1", "pass-2"] };

describe("CheckpointRepository", () => {
  it("falls back to the previous generation when current is corrupt", async () => {
    const store = new MemoryStore();
    const repository = new CheckpointRepository(store, "execution");
    const initial = createCheckpoint({ identity, machineProfileId: "ayab-200", now: "t0" });
    await repository.save(initial);
    await repository.save(completePass(initial, 0, "pass-1", "right", "t1"));
    store.values.execution = "{broken";
    const loaded = await repository.load(context);
    expect(loaded.ok).toBeTrue();
    if (loaded.ok) {
      expect(loaded.generation).toBe("previous");
      expect(loaded.checkpoint.nextPassIndex).toBe(0);
      expect(loaded.warnings.length).toBe(1);
    }
  });

  it("preserves a resumable generation when replacing current fails", async () => {
    const store = new MemoryStore();
    const repository = new CheckpointRepository(store, "execution");
    const initial = createCheckpoint({ identity, machineProfileId: "ayab-200", now: "t0" });
    await repository.save(initial);
    store.failKey = "execution";
    let failed = false;
    try { await repository.save(completePass(initial, 0, "pass-1", "right", "t1")); } catch (_) { failed = true; }
    expect(failed).toBeTrue();
    const loaded = await repository.load(context);
    expect(loaded.ok).toBeTrue();
    if (loaded.ok) expect(loaded.checkpoint.nextPassIndex).toBe(0);
  });

  it("does not resurrect an older generation after the current one completed", async () => {
    const store = new MemoryStore();
    const repository = new CheckpointRepository(store, "execution");
    const initial = createCheckpoint({ identity, machineProfileId: "ayab-200", now: "t0" });
    await repository.save(initial);
    const advanced = completePass(initial, 0, "pass-1", "right", "t1");
    await repository.save(finishCheckpoint(advanced, "completed", "t2"));
    const loaded = await repository.load(context);
    expect(loaded.ok).toBeFalse();
    if (!loaded.ok) expect(loaded.message).toContain("completed");
  });
});
