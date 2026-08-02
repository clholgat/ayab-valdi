export const EXECUTION_CHECKPOINT_VERSION = 2;

export type CheckpointStatus = "active" | "completed" | "cancelled";
export type PassSide = "left" | "right" | "unknown";

export interface MachineJobIdentity {
  jobId: string;
  /** Digest of the immutable imported job bytes or canonical representation. */
  checksum: string;
}

export interface YarnAssignment {
  yarnId: string;
  carrier: string;
}

export interface ExecutionCorrection {
  kind: "rewind";
  fromPassIndex: number;
  toPassIndex: number;
  recordedAt: string;
}

export interface ExecutionCheckpoint {
  version: typeof EXECUTION_CHECKPOINT_VERSION;
  revision: number;
  identity: MachineJobIdentity;
  machineProfileId: string;
  status: CheckpointStatus;
  /** The first pass that has not reached a safe completion boundary. */
  nextPassIndex: number;
  /** The machine has knitted this pass, but its after-pass prompts have not all reached
   * their durable acknowledgement boundary. Resume must not knit this pass again. */
  pendingAfterPass?: {
    passIndex: number;
    passId: string;
    expectedSide: PassSide;
  };
  lastCompletedPassId?: string;
  expectedSide: PassSide;
  acknowledgedPromptIds: string[];
  yarnAssignments: YarnAssignment[];
  corrections: ExecutionCorrection[];
  createdAt: string;
  updatedAt: string;
}

export interface ResumeContext {
  identity: MachineJobIdentity;
  machineProfileId: string;
  passIds: string[];
}

export type CheckpointValidation =
  | { ok: true }
  | { ok: false; message: string };

export function validateCheckpointForResume(
  checkpoint: ExecutionCheckpoint,
  context: ResumeContext,
): CheckpointValidation {
  if (checkpoint.status !== "active") {
    return { ok: false, message: `Checkpoint is ${checkpoint.status}.` };
  }
  if (
    checkpoint.identity.jobId !== context.identity.jobId ||
    checkpoint.identity.checksum !== context.identity.checksum
  ) {
    return { ok: false, message: "Checkpoint belongs to a different job." };
  }
  if (checkpoint.pendingAfterPass) {
    const pending = checkpoint.pendingAfterPass;
    if (
      pending.passIndex !== checkpoint.nextPassIndex ||
      context.passIds[pending.passIndex] !== pending.passId
    ) {
      return { ok: false, message: "Checkpoint pending pass identity does not match the job." };
    }
  }
  if (checkpoint.machineProfileId !== context.machineProfileId) {
    return { ok: false, message: "Checkpoint uses a different machine profile." };
  }
  if (
    checkpoint.nextPassIndex < 0 ||
    checkpoint.nextPassIndex > context.passIds.length
  ) {
    return { ok: false, message: "Checkpoint pass position is out of range." };
  }
  if (checkpoint.nextPassIndex > 0) {
    const expected = context.passIds[checkpoint.nextPassIndex - 1];
    if (checkpoint.lastCompletedPassId !== expected) {
      return { ok: false, message: "Checkpoint pass identity does not match the job." };
    }
  }
  return { ok: true };
}
