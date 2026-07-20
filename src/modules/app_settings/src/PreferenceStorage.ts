import { PersistentStore } from "persistence/src/PersistentStore";

export interface PreferenceStorage {
  fetchString(key: string): Promise<string | undefined>;
  storeString(key: string, value: string): Promise<void>;
}

export class PersistentStorePreferenceStorage implements PreferenceStorage {
  constructor(private readonly store: PersistentStore) {}

  async fetchString(key: string): Promise<string | undefined> {
    try {
      return await this.store.fetchString(key);
    } catch {
      return undefined;
    }
  }

  async storeString(key: string, value: string): Promise<void> {
    await this.store.storeString(key, value);
  }
}

export class InMemoryPreferenceStorage implements PreferenceStorage {
  private readonly data = new Map<string, string>();

  async fetchString(key: string): Promise<string | undefined> {
    return this.data.get(key);
  }

  async storeString(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  snapshot(): Map<string, string> {
    return new Map(this.data);
  }
}

export function createDefaultPreferenceStorage(
  storeName: string = "ayab_preferences",
): PreferenceStorage {
  return new PersistentStorePreferenceStorage(
    new PersistentStore(storeName, {
      deviceGlobal: true,
      enableEncryption: false,
    }),
  );
}
