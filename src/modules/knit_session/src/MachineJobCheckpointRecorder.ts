import { CheckpointRepository } from "./CheckpointRepository";
import {
  acknowledgePrompt,
  completePass,
  createCheckpoint,
  finishCheckpoint,
  markPassKnitted,
} from "./CheckpointTransitions";
import { ExecutionCheckpoint, MachineJobIdentity, PassSide } from "./ExecutionCheckpoint";

export interface CheckpointRecorderStartParams {
  identity: MachineJobIdentity;
  machineProfileId: string;
  totalPasses: number;
  now: () => string;
}

/** Owns the in-memory checkpoint and serializes every durable transition. */
export class MachineJobCheckpointRecorder {
  private checkpoint: ExecutionCheckpoint;

  private constructor(
    private readonly repository: CheckpointRepository,
    private readonly totalPasses: number,
    private readonly now: () => string,
    checkpoint: ExecutionCheckpoint,
  ) {
    this.checkpoint = checkpoint;
  }

  static async start(
    repository: CheckpointRepository,
    params: CheckpointRecorderStartParams,
  ): Promise<MachineJobCheckpointRecorder> {
    if (params.totalPasses <= 0) throw new Error("Cannot checkpoint an empty job.");
    const checkpoint = createCheckpoint({
      identity: params.identity,
      machineProfileId: params.machineProfileId,
      now: params.now(),
    });
    await repository.save(checkpoint);
    return new MachineJobCheckpointRecorder(
      repository,
      params.totalPasses,
      params.now,
      checkpoint,
    );
  }

  static resume(
    repository: CheckpointRepository,
    checkpoint: ExecutionCheckpoint,
    totalPasses: number,
    now: () => string,
  ): MachineJobCheckpointRecorder {
    if (checkpoint.status !== "active") {
      throw new Error(`Cannot resume a ${checkpoint.status} checkpoint.`);
    }
    if (checkpoint.nextPassIndex >= totalPasses) {
      throw new Error("Checkpoint has no remaining passes.");
    }
    return new MachineJobCheckpointRecorder(
      repository,
      totalPasses,
      now,
      checkpoint,
    );
  }

  async recordCompletedPass(
    passIndex: number,
    passId: string,
    expectedSide: PassSide,
  ): Promise<void> {
    let next = completePass(
      this.checkpoint,
      passIndex,
      passId,
      expectedSide,
      this.now(),
    );
    if (next.nextPassIndex === this.totalPasses) {
      next = finishCheckpoint(next, "completed", this.now());
    }
    await this.repository.save(next);
    this.checkpoint = next;
  }

  async recordPassKnitted(
    passIndex: number,
    passId: string,
    expectedSide: PassSide,
  ): Promise<void> {
    const next = markPassKnitted(
      this.checkpoint,
      passIndex,
      passId,
      expectedSide,
      this.now(),
    );
    if (next === this.checkpoint) return;
    await this.repository.save(next);
    this.checkpoint = next;
  }

  async recordAcknowledgedPrompt(promptId: string): Promise<void> {
    const next = acknowledgePrompt(this.checkpoint, promptId, this.now());
    if (next === this.checkpoint) return;
    await this.repository.save(next);
    this.checkpoint = next;
  }

  snapshot(): ExecutionCheckpoint {
    return this.checkpoint;
  }
}
