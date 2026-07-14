import { componentTypeFind } from "foundation/test/util/componentTypeFind";
import "jasmine/src/jasmine";
import { Preferences } from "app_settings/src/Preferences";
import { PreferencesProvider } from "app_settings/src/PreferencesProvider";
import { InMemoryPreferenceStorage } from "app_settings/src/PreferenceStorage";
import { AppKnitFooter } from "ayab_valdi/src/AppKnitFooter";
import { AppSidebar, AppSidebarViewModel } from "ayab_valdi/src/AppSidebar";
import { SerialPortPicker } from "ayab_valdi/src/SerialPortPicker";
import { IComponentTestDriver, valdiIt } from "valdi_test/test/JSXTestUtils";

const noop = (): void => {};

const makeViewModel = (
  overrides?: Partial<AppSidebarViewModel>,
): AppSidebarViewModel => ({
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
): AppSidebar {
  const nodes = driver.render(() => {
    <PreferencesProvider value={prefs}>
      <AppSidebar {...viewModel} />
    </PreferencesProvider>;
  });
  return componentTypeFind(nodes[0].component!, AppSidebar)[0]!;
}

// The enabled path (default) renders SerialPortPicker, which loads the native
// serial module — unavailable in the JS-only test runtime. That path is
// covered by pattern_website's AyabSidebar_desktop layout snapshot, whose CLI
// links the real macOS serial impl.
describe("AppSidebar machine IO gating", () => {
  valdiIt("Verify serial picker and knit footer are omitted when disabled", async driver => {
    const sidebar = renderSidebar(driver, await makePreferences(), makeViewModel({ enableMachineIo: false }));
    expect(componentTypeFind(sidebar, SerialPortPicker).length).toBe(0);
    expect(componentTypeFind(sidebar, AppKnitFooter).length).toBe(0);
  });
});
