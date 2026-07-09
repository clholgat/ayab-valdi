import { findNodeWithKey } from "foundation/test/util/findNodeWithKey";
import { tapNodeWithKey } from "foundation/test/util/tapNodeWithKey";
import "jasmine/src/jasmine";
import { IComponent } from "valdi_core/src/IComponent";
import { Preferences } from "app_settings/src/Preferences";
import { PreferencesProvider } from "app_settings/src/PreferencesProvider";
import { InMemoryPreferenceStorage } from "app_settings/src/PreferenceStorage";
import { SettingsModal, SettingsModalViewModel } from "ayab_valdi/src/SettingsModal";
import { IComponentTestDriver, valdiIt } from "valdi_test/test/JSXTestUtils";

const failOnClose = (): void => fail("onClose should not be called");

const makeViewModel = (
  overrides?: Partial<SettingsModalViewModel>,
): SettingsModalViewModel => ({
  onClose: failOnClose,
  ...overrides,
});

async function makePreferences(): Promise<Preferences> {
  const storage = new InMemoryPreferenceStorage();
  const prefs = new Preferences(storage);
  await prefs.initialize();
  return prefs;
}

function renderSettingsModal(
  driver: IComponentTestDriver,
  prefs: Preferences,
  viewModel: SettingsModalViewModel,
): IComponent {
  const nodes = driver.render(() => {
    <PreferencesProvider value={prefs}>
      <SettingsModal {...viewModel} />
    </PreferencesProvider>;
  });
  return nodes[0].component!;
}

describe("SettingsModal", () => {
  valdiIt("renders preferences inside the modal shell", async (driver) => {
    const prefs = await makePreferences();
    const root = renderSettingsModal(driver, prefs, makeViewModel());
    expect(findNodeWithKey(root, "settings-modal")[0]).toBeDefined();
    expect(findNodeWithKey(root, "preferences-panel")[0]).toBeDefined();
  });

  valdiIt("calls onClose when backdrop is tapped", async (driver) => {
    const onClose = jasmine.createSpy("onClose");
    const prefs = await makePreferences();
    const root = renderSettingsModal(driver, prefs, { onClose });
    await tapNodeWithKey(root, "settings-modal-backdrop");
    expect(onClose).toHaveBeenCalled();
  });

  valdiIt("calls onClose when modal close button is tapped", async (driver) => {
    const onClose = jasmine.createSpy("onClose");
    const prefs = await makePreferences();
    const root = renderSettingsModal(driver, prefs, { onClose });
    await tapNodeWithKey(root, "settings-modal-close");
    expect(onClose).toHaveBeenCalled();
  });
});
