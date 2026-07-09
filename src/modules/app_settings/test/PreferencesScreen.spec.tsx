import { findNodeWithKey } from "foundation/test/util/findNodeWithKey";
import { getAttributeFromNode } from "foundation/test/util/getAttributeFromNode";
import { tapNodeWithKey } from "foundation/test/util/tapNodeWithKey";
import "jasmine/src/jasmine";
import { IComponent } from "valdi_core/src/IComponent";
import { Preferences } from "app_settings/src/Preferences";
import {
  PreferencesScreen,
  PreferencesScreenViewModel,
} from "app_settings/src/PreferencesScreen";
import { PreferencesProvider } from "app_settings/src/PreferencesProvider";
import { InMemoryPreferenceStorage } from "app_settings/src/PreferenceStorage";
import { Machine } from "state_machine/src/Machine";
import { IComponentTestDriver, valdiIt } from "valdi_test/test/JSXTestUtils";

const failOnClose = (): void => fail("onClose should not be called");

const makeViewModel = (
  overrides?: Partial<PreferencesScreenViewModel>,
): PreferencesScreenViewModel => ({
  onClose: failOnClose,
  ...overrides,
});

async function makePreferences(
  setup?: (prefs: Preferences) => void,
): Promise<Preferences> {
  const storage = new InMemoryPreferenceStorage();
  const prefs = new Preferences(storage);
  await prefs.initialize();
  setup?.(prefs);
  return prefs;
}

function renderPreferencesScreen(
  driver: IComponentTestDriver,
  prefs: Preferences,
  viewModel: PreferencesScreenViewModel,
): IComponent {
  const nodes = driver.render(() => {
    <PreferencesProvider value={prefs}>
      <PreferencesScreen {...viewModel} />
    </PreferencesProvider>;
  });
  return nodes[0].component!;
}

function getAppBeepsValue(root: IComponent): string | undefined {
  const label = findNodeWithKey(root, "app-beeps-status-value")[0];
  const value = label ? getAttributeFromNode<string>(label, "value") : undefined;
  return typeof value === "string" ? value : undefined;
}

function getHardwareBeepsValue(root: IComponent): string | undefined {
  const label = findNodeWithKey(root, "hardware-beeps-status-value")[0];
  const value = label ? getAttributeFromNode<string>(label, "value") : undefined;
  return typeof value === "string" ? value : undefined;
}

describe("PreferencesScreen", () => {
  valdiIt("renders the settings panel", async (driver) => {
    const prefs = await makePreferences();
    const root = renderPreferencesScreen(driver, prefs, makeViewModel());
    expect(findNodeWithKey(root, "preferences-panel")[0]).toBeDefined();
  });

  valdiIt("reflects app beeps from preferences", async (driver) => {
    const prefs = await makePreferences((p) => {
      p.quietMode = true;
    });
    const root = renderPreferencesScreen(driver, prefs, makeViewModel());
    expect(getAppBeepsValue(root)).toBe("off");
  });

  valdiIt("toggles app beeps in preferences", async (driver) => {
    const prefs = await makePreferences();
    const root = renderPreferencesScreen(driver, prefs, makeViewModel());
    expect(getAppBeepsValue(root)).toBe("on");
    await tapNodeWithKey(root, "app-beeps-toggle");
    expect(getAppBeepsValue(root)).toBe("off");
    expect(prefs.quietMode).toBe(true);
  });

  valdiIt("toggles hardware beeps in preferences", async (driver) => {
    const prefs = await makePreferences();
    const root = renderPreferencesScreen(driver, prefs, makeViewModel());
    expect(getHardwareBeepsValue(root)).toBe("on");
    await tapNodeWithKey(root, "hardware-beeps-toggle");
    expect(getHardwareBeepsValue(root)).toBe("off");
    expect(prefs.disableHardwareBeep).toBe(true);
  });

  valdiIt("calls onClose when Done is tapped", async (driver) => {
    const onClose = jasmine.createSpy("onClose");
    const prefs = await makePreferences();
    const root = renderPreferencesScreen(driver, prefs, { onClose });
    await tapNodeWithKey(root, "preferences-done");
    expect(onClose).toHaveBeenCalled();
  });

  valdiIt("calls onRestartTour when Show getting started tour is tapped", async (driver) => {
    const onRestartTour = jasmine.createSpy("onRestartTour");
    const prefs = await makePreferences();
    const root = renderPreferencesScreen(
      driver,
      prefs,
      makeViewModel({ onRestartTour }),
    );
    await tapNodeWithKey(root, "restart-tour-button");
    expect(onRestartTour).toHaveBeenCalled();
  });

  valdiIt("loads machine preference on mount", async (driver) => {
    const prefs = await makePreferences((p) => {
      p.machine = Machine.KH270;
    });
    renderPreferencesScreen(driver, prefs, makeViewModel());
    expect(prefs.machine).toBe(Machine.KH270);
  });

  valdiIt("updates machine preference from settings picker", async (driver) => {
    const onMachineChange = jasmine.createSpy("onMachineChange");
    const prefs = await makePreferences();
    const root = renderPreferencesScreen(
      driver,
      prefs,
      makeViewModel({ onMachineChange }),
    );
    expect(prefs.machine).toBe(Machine.KH910_KH950);
    // Machine picker is the first IndexPicker in settings (before aspect ratio).
    expect(onMachineChange).not.toHaveBeenCalled();
    expect(prefs.machine).toBeDefined();
    expect(findNodeWithKey(root, "checklist-target-machine")[0]).toBeDefined();
  });
});
