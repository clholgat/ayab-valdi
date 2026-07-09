import "jasmine/src/jasmine";
import {
  LocalStoragePreferenceStorage,
  InMemoryPreferenceStorage,
} from "app_settings/src/PreferenceStorage";

describe("PreferenceStorage", () => {
  it("InMemoryPreferenceStorage round-trips values", async () => {
    const storage = new InMemoryPreferenceStorage();
    await storage.storeString("quiet_mode", "true");
    expect(await storage.fetchString("quiet_mode")).toBe("true");
    expect(await storage.fetchString("missing")).toBeUndefined();
  });

  it("LocalStoragePreferenceStorage uses prefixed keys when available", async () => {
    if (typeof localStorage === "undefined") {
      return;
    }
    const storage = new LocalStoragePreferenceStorage("test_ayab_prefs");
    await storage.storeString("machine", "42");
    expect(localStorage.getItem("test_ayab_prefs:machine")).toBe("42");
    expect(await storage.fetchString("machine")).toBe("42");
    localStorage.removeItem("test_ayab_prefs:machine");
  });
});
