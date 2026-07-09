import { Device } from "valdi_core/src/Device";
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

/** Web fallback: survives full page reload (unlike in-memory PersistentStore native). */
export class LocalStoragePreferenceStorage implements PreferenceStorage {
  constructor(private readonly prefix: string) {}

  private storageKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async fetchString(key: string): Promise<string | undefined> {
    if (typeof localStorage === "undefined") {
      return undefined;
    }
    return localStorage.getItem(this.storageKey(key)) ?? undefined;
  }

  async storeString(key: string, value: string): Promise<void> {
    if (typeof localStorage === "undefined") {
      return;
    }
    localStorage.setItem(this.storageKey(key), value);
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
  if (Device.isWeb()) {
    return new LocalStoragePreferenceStorage(storeName);
  }
  return new PersistentStorePreferenceStorage(
    new PersistentStore(storeName, {
      deviceGlobal: true,
      enableEncryption: false,
    }),
  );
}
