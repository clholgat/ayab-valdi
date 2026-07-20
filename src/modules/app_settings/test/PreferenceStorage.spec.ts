import "jasmine/src/jasmine";
import { InMemoryPreferenceStorage } from "app_settings/src/PreferenceStorage";

describe("PreferenceStorage", () => {
  it("InMemoryPreferenceStorage round-trips values", async () => {
    const storage = new InMemoryPreferenceStorage();
    await storage.storeString("quiet_mode", "true");
    expect(await storage.fetchString("quiet_mode")).toBe("true");
    expect(await storage.fetchString("missing")).toBeUndefined();
  });
});
