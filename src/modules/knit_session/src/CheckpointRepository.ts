import {
  EXECUTION_CHECKPOINT_VERSION,
  ExecutionCheckpoint,
  ResumeContext,
  validateCheckpointForResume,
} from "./ExecutionCheckpoint";

export interface AtomicCheckpointStore {
  read(key: string): Promise<string | undefined>;
  /** Replace one value atomically; a failed write must preserve the old value. */
  atomicReplace(key: string, value: string): Promise<void>;
}

export type CheckpointLoadResult =
  | { ok: true; checkpoint: ExecutionCheckpoint; generation: "current" | "previous"; warnings: string[] }
  | { ok: false; message: string; warnings: string[] };

function isStringArray(value: any): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseExecutionCheckpoint(text: string): ExecutionCheckpoint {
  const value: any = JSON.parse(text);
  if (!value || value.version !== EXECUTION_CHECKPOINT_VERSION) throw new Error("Unsupported checkpoint version.");
  if (!value.identity || typeof value.identity.jobId !== "string" || typeof value.identity.checksum !== "string") throw new Error("Invalid checkpoint job identity.");
  if (typeof value.machineProfileId !== "string" || typeof value.revision !== "number") throw new Error("Invalid checkpoint metadata.");
  if (["active", "completed", "cancelled"].indexOf(value.status) < 0) throw new Error("Invalid checkpoint status.");
  if (!Number.isInteger(value.nextPassIndex) || value.nextPassIndex < 0) throw new Error("Invalid checkpoint pass position.");
  if (!isStringArray(value.acknowledgedPromptIds) || !Array.isArray(value.yarnAssignments) || !Array.isArray(value.corrections)) throw new Error("Invalid checkpoint execution state.");
  if (typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") throw new Error("Invalid checkpoint timestamps.");
  return value as ExecutionCheckpoint;
}

export class CheckpointRepository {
  constructor(private store: AtomicCheckpointStore, private key: string) {}

  async save(checkpoint: ExecutionCheckpoint): Promise<void> {
    const serialized = JSON.stringify(checkpoint);
    // Validate before touching either durable generation.
    parseExecutionCheckpoint(serialized);
    const current = await this.store.read(this.key);
    if (current !== undefined) await this.store.atomicReplace(`${this.key}.previous`, current);
    await this.store.atomicReplace(this.key, serialized);
  }

  async load(context: ResumeContext): Promise<CheckpointLoadResult> {
    const warnings: string[] = [];
    const candidates: Array<{ key: string; generation: "current" | "previous" }> = [
      { key: this.key, generation: "current" },
      { key: `${this.key}.previous`, generation: "previous" },
    ];
    for (const candidate of candidates) {
      const text = await this.store.read(candidate.key);
      if (text === undefined) continue;
      try {
        const checkpoint = parseExecutionCheckpoint(text);
        if (
          candidate.generation === "current" &&
          checkpoint.identity.jobId === context.identity.jobId &&
          checkpoint.identity.checksum === context.identity.checksum &&
          checkpoint.machineProfileId === context.machineProfileId &&
          checkpoint.status !== "active"
        ) {
          return {
            ok: false,
            message: `The latest checkpoint is ${checkpoint.status}.`,
            warnings,
          };
        }
        const validation = validateCheckpointForResume(checkpoint, context);
        if (!validation.ok) throw new Error(validation.message);
        return { ok: true, checkpoint, generation: candidate.generation, warnings };
      } catch (error) {
        warnings.push(`${candidate.generation}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { ok: false, message: "No resumable checkpoint was found.", warnings };
  }
}
