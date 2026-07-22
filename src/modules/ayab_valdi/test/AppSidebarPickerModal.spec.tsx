import { findNodeWithKey } from "foundation/test/util/findNodeWithKey";
import { tapNodeWithKey } from "foundation/test/util/tapNodeWithKey";
import "jasmine/src/jasmine";
import { Preferences } from "app_settings/src/Preferences";
import { PreferencesProvider } from "app_settings/src/PreferencesProvider";
import { InMemoryPreferenceStorage } from "app_settings/src/PreferenceStorage";
import { AppSidebar, AppSidebarViewModel } from "ayab_valdi/src/AppSidebar";
import { IComponent } from "valdi_core/src/IComponent";
import { IComponentTestDriver, valdiIt } from "valdi_test/test/JSXTestUtils";

const noop = (): void => {};

const makeViewModel = (
  overrides?: Partial<AppSidebarViewModel>,
): AppSidebarViewModel => ({
  // Machine IO disabled: SerialPortPicker needs the native serial module,
  // unavailable in this JS-only test runtime (see AppSidebarMachineIo.spec).
  enableMachineIo: false,
  sessionLocked: false,
  machineRevision: 0,
  imageBitsRevision: 0,
  hasImage: false,
  repeatH: 1,
  repeatV: 1,
  stretchH: 1,
  stretchV: 1,
  knitDisabled: true,
  knitDisabledReason: null,
  isKnitting: false,
  onOpenSettings: noop,
  onReportBug: noop,
  onSerialPortChange: noop,
  onSettingsChange: noop,
  onStretchChange: noop,
  onRepeatChange: noop,
  onFlipH: noop,
  onFlipV: noop,
  onRotate: noop,
  onInvert: noop,
  onKnit: noop,
  onCancel: noop,
  ...overrides,
});

async function makePreferences(): Promise<Preferences> {
  const storage = new InMemoryPreferenceStorage();
  const prefs = new Preferences(storage);
  await prefs.initialize();
  return prefs;
}

function renderSidebar(
  driver: IComponentTestDriver,
  prefs: Preferences,
  viewModel: AppSidebarViewModel,
): IComponent {
  const nodes = driver.render(() => {
    <PreferencesProvider value={prefs}>
      <AppSidebar {...viewModel} />
    </PreferencesProvider>;
  });
  return nodes[0].component!;
}

describe("AppSidebar picker modal", () => {
  valdiIt(
    "opens the shared picker modal when a field trigger inside the scrollable panel is tapped",
    async (driver) => {
      const prefs = await makePreferences();
      const root = renderSidebar(driver, prefs, makeViewModel());
      expect(findNodeWithKey(root, "sidebar-picker-modal").length).toBe(0);

      await tapNodeWithKey(root, "mode-picker");

      expect(findNodeWithKey(root, "sidebar-picker-modal")[0]).toBeDefined();
    },
  );

  valdiIt(
    "renders the picker modal as a sibling of the scroll container, not nested inside it",
    async (driver) => {
      const prefs = await makePreferences();
      const root = renderSidebar(driver, prefs, makeViewModel());
      await tapNodeWithKey(root, "mode-picker");

      const scrollNode = findNodeWithKey(root, "sidebar-scroll")[0];
      expect(scrollNode).toBeDefined();
      // If the modal were still nested inside the scroll (the original bug),
      // it would show up when searching from the scroll node too.
      expect(findNodeWithKey(scrollNode!, "sidebar-picker-modal").length).toBe(0);
      expect(findNodeWithKey(root, "sidebar-picker-modal")[0]).toBeDefined();
    },
  );

  valdiIt(
    "applies the selected mode and closes the modal",
    async (driver) => {
      const onSettingsChange = jasmine.createSpy("onSettingsChange");
      const prefs = await makePreferences();
      const root = renderSidebar(
        driver,
        prefs,
        makeViewModel({ onSettingsChange }),
      );

      await tapNodeWithKey(root, "mode-picker");
      onSettingsChange.calls.reset();

      await tapNodeWithKey(root, "sidebar-picker-modal-option-1");

      expect(onSettingsChange).toHaveBeenCalledWith(
        jasmine.objectContaining({ mode: 1 }),
      );
      expect(findNodeWithKey(root, "sidebar-picker-modal").length).toBe(0);
    },
  );
});
