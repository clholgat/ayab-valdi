import {
  EXECUTION_CHECKPOINT_VERSION,
  ExecutionCheckpoint,
  MachineJobIdentity,
  PassSide,
  YarnAssignment,
} from "./ExecutionCheckpoint";

export interface NewCheckpointParams {
  identity: MachineJobIdentity;
  machineProfileId: string;
  expectedSide?: PassSide;
  yarnAssignments?: YarnAssignment[];
  now: string;
}

export function createCheckpoint(params: NewCheckpointParams): ExecutionCheckpoint {
  return {
    version: EXECUTION_CHECKPOINT_VERSION,
    revision: 0,
    identity: { ...params.identity },
    machineProfileId: params.machineProfileId,
    status: "active",
    nextPassIndex: 0,
    expectedSide: params.expectedSide ?? "unknown",
    acknowledgedPromptIds: [],
    yarnAssignments: (params.yarnAssignments ?? []).slice(),
    corrections: [],
    createdAt: params.now,
    updatedAt: params.now,
  };
}

function updated(
  checkpoint: ExecutionCheckpoint,
  now: string,
  changes: Partial<ExecutionCheckpoint>,
): ExecutionCheckpoint {
  if (checkpoint.status !== "active") {
    throw new Error(`Cannot update a ${checkpoint.status} checkpoint.`);
  }
  return { ...checkpoint, ...changes, revision: checkpoint.revision + 1, updatedAt: now };
}

export function completePass(
  checkpoint: ExecutionCheckpoint,
  passIndex: number,
  passId: string,
  expectedSide: PassSide,
  now: string,
): ExecutionCheckpoint {
  if (passIndex !== checkpoint.nextPassIndex) {
    throw new Error(`Expected pass ${checkpoint.nextPassIndex}, got ${passIndex}.`);
  }
  return updated(checkpoint, now, {
    nextPassIndex: passIndex + 1,
    lastCompletedPassId: passId,
    expectedSide,
  });
}

export function acknowledgePrompt(
  checkpoint: ExecutionCheckpoint,
  promptId: string,
  now: string,
): ExecutionCheckpoint {
  if (checkpoint.acknowledgedPromptIds.indexOf(promptId) >= 0) return checkpoint;
  return updated(checkpoint, now, {
    acknowledgedPromptIds: checkpoint.acknowledgedPromptIds.concat(promptId),
  });
}

export function rewindToPass(
  checkpoint: ExecutionCheckpoint,
  passIndex: number,
  previousPassId: string | undefined,
  expectedSide: PassSide,
  now: string,
): ExecutionCheckpoint {
  if (passIndex < 0 || passIndex >= checkpoint.nextPassIndex) {
    throw new Error("Rewind target must be before the next pass.");
  }
  return updated(checkpoint, now, {
    nextPassIndex: passIndex,
    lastCompletedPassId: previousPassId,
    expectedSide,
    corrections: checkpoint.corrections.concat({
      kind: "rewind",
      fromPassIndex: checkpoint.nextPassIndex,
      toPassIndex: passIndex,
      recordedAt: now,
    }),
  });
}

export function finishCheckpoint(
  checkpoint: ExecutionCheckpoint,
  status: "completed" | "cancelled",
  now: string,
): ExecutionCheckpoint {
  return updated(checkpoint, now, { status });
}
