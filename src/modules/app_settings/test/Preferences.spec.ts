import "jasmine/src/jasmine";
import { Preferences } from "app_settings/src/Preferences";
import { InMemoryPreferenceStorage } from "app_settings/src/PreferenceStorage";
import { Machine } from "state_machine/src/Machine";
import { Mode, Alignment } from "constants/src/StateMachineConstants";

describe("Preferences", () => {
  it("loads defaults from empty storage", async () => {
    const storage = new InMemoryPreferenceStorage();
    const prefs = new Preferences(storage);
    await prefs.initialize();
    expect(prefs.machine).toBe(Machine.KH910_KH950);
    expect(prefs.defaultKnittingMode).toBe(Mode.SINGLEBED);
    expect(prefs.quietMode).toBe(Preferences.DEFAULT_QUIET_MODE);
    expect(prefs.disableHardwareBeep).toBe(
      Preferences.DEFAULT_DISABLE_HARDWARE_BEEP,
    );
  });

  it("persists machine changes", async () => {
    const storage = new InMemoryPreferenceStorage();
    const prefs = new Preferences(storage);
    await prefs.initialize();
    prefs.machine = Machine.KH270;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const reloaded = new Preferences(storage);
    await reloaded.initialize();
    expect(reloaded.machine).toBe(Machine.KH270);
  });

  it("reset restores defaults but keeps language", async () => {
    const storage = new InMemoryPreferenceStorage();
    const prefs = new Preferences(storage);
    await prefs.initialize();
    prefs.language = "de_DE";
    prefs.quietMode = true;
    prefs.machine = Machine.KH270;
    await prefs.reset();
    expect(prefs.quietMode).toBe(Preferences.DEFAULT_QUIET_MODE);
    expect(prefs.disableHardwareBeep).toBe(
      Preferences.DEFAULT_DISABLE_HARDWARE_BEEP,
    );
    expect(prefs.machine as Machine).toBe(Machine.KH910_KH950);
    expect(prefs.language).toBe("de_DE");
  });

  it("refresh clears cache and reloads from storage", async () => {
    const storage = new InMemoryPreferenceStorage();
    await storage.storeString("quiet_mode", JSON.stringify(true));
    const prefs = new Preferences(storage);
    await prefs.initialize();
    expect(prefs.quietMode).toBe(true);
    (prefs as unknown as { _quietMode?: boolean })._quietMode = false;
    await prefs.refresh();
    expect(prefs.quietMode).toBe(true);
  });

  it("stores alignment and infinite repeat preferences", async () => {
    const storage = new InMemoryPreferenceStorage();
    const prefs = new Preferences(storage);
    await prefs.initialize();
    prefs.defaultAlignment = Alignment.LEFT;
    prefs.defaultInfiniteRepeat = true;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const reloaded = new Preferences(storage);
    await reloaded.initialize();
    expect(reloaded.defaultAlignment).toBe(Alignment.LEFT);
    expect(reloaded.defaultInfiniteRepeat).toBe(true);
  });

  it("persists first-run tour completion", async () => {
    const storage = new InMemoryPreferenceStorage();
    const prefs = new Preferences(storage);
    await prefs.initialize();
    expect(prefs.firstRunTourCompleted).toBe(false);
    prefs.firstRunTourCompleted = true;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const reloaded = new Preferences(storage);
    await reloaded.initialize();
    expect(reloaded.firstRunTourCompleted).toBe(true);
  });
});
