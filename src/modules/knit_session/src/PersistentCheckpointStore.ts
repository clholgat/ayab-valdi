import { PersistentStore } from "persistence/src/PersistentStore";
import { AtomicCheckpointStore } from "./CheckpointRepository";

export interface PersistentStringStore {
  exists(key: string): Promise<boolean>;
  fetchString(key: string): Promise<string>;
  storeString(key: string, value: string): Promise<void>;
}

/**
 * PersistentStore completes each immediate write only after its native store
 * has replaced that key. CheckpointRepository supplies the two generations.
 */
export class PersistentCheckpointStore implements AtomicCheckpointStore {
  constructor(private readonly store: PersistentStringStore) {}

  async read(key: string): Promise<string | undefined> {
    if (!(await this.store.exists(key))) return undefined;
    return this.store.fetchString(key);
  }

  async atomicReplace(key: string, value: string): Promise<void> {
    await this.store.storeString(key, value);
  }
}

export function createDefaultCheckpointStore(): PersistentCheckpointStore {
  return new PersistentCheckpointStore(
    new PersistentStore("ayab_machine_job_checkpoints", {
      disableBatchWrites: true,
      deviceGlobal: true,
      enableEncryption: false,
    }),
  );
}
