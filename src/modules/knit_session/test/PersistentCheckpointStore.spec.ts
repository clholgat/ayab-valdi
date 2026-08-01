import "jasmine/src/jasmine";
import {
  PersistentCheckpointStore,
  PersistentStringStore,
} from "knit_session/src/PersistentCheckpointStore";

class FakePersistentStore implements PersistentStringStore {
  values: { [key: string]: string } = {};
  exists(key: string): Promise<boolean> {
    return Promise.resolve(this.values[key] !== undefined);
  }
  fetchString(key: string): Promise<string> {
    const value = this.values[key];
    return value === undefined
      ? Promise.reject(new Error("missing"))
      : Promise.resolve(value);
  }
  storeString(key: string, value: string): Promise<void> {
    this.values[key] = value;
    return Promise.resolve();
  }
}

describe("PersistentCheckpointStore", () => {
  it("maps missing keys and completed replacements", async () => {
    const nativeStore = new FakePersistentStore();
    const store = new PersistentCheckpointStore(nativeStore);
    expect(await store.read("current")).toBeUndefined();
    await store.atomicReplace("current", "one");
    expect(await store.read("current")).toBe("one");
    await store.atomicReplace("current", "two");
    expect(await store.read("current")).toBe("two");
  });
});
