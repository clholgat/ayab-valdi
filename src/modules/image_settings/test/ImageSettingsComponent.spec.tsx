import { findNodeWithKey } from "foundation/test/util/findNodeWithKey";
import { getAttributeFromNode } from "foundation/test/util/getAttributeFromNode";
import { tapNodeWithKey } from "foundation/test/util/tapNodeWithKey";
import "jasmine/src/jasmine";
import { IComponent } from "valdi_core/src/IComponent";
import { Preferences } from "app_settings/src/Preferences";
import { PreferencesProvider } from "app_settings/src/PreferencesProvider";
import { InMemoryPreferenceStorage } from "app_settings/src/PreferenceStorage";
import { Alignment } from "constants/src/StateMachineConstants";
import {
  ImageSettingsComponent,
  ImageSettingsViewModel,
} from "image_settings/src/ImageSettingsComponent";
import { IComponentTestDriver, valdiIt } from "valdi_test/test/JSXTestUtils";

const makeViewModel = (
  overrides?: Partial<ImageSettingsViewModel>,
): ImageSettingsViewModel => ({
  hasImage: true,
  repeatH: 1,
  repeatV: 1,
  ...overrides,
});

async function makePreferences(): Promise<Preferences> {
  const storage = new InMemoryPreferenceStorage();
  const prefs = new Preferences(storage);
  await prefs.initialize();
  return prefs;
}

function renderImageSettings(
  driver: IComponentTestDriver,
  prefs: Preferences,
  viewModel: ImageSettingsViewModel,
): IComponent {
  const nodes = driver.render(() => {
    <PreferencesProvider value={prefs}>
      <ImageSettingsComponent {...viewModel} />
    </PreferencesProvider>;
  });
  return nodes[0].component!;
}

function getFieldValue(root: IComponent, fieldId: string): string | undefined {
  const node = findNodeWithKey(root, fieldId)[0];
  const value = node ? getAttributeFromNode<string>(node, "value") : undefined;
  return typeof value === "string" ? value : undefined;
}

function getLabelValue(root: IComponent, labelId: string): string | undefined {
  const node = findNodeWithKey(root, labelId)[0];
  const value = node ? getAttributeFromNode<string>(node, "value") : undefined;
  return typeof value === "string" ? value : undefined;
}

describe("ImageSettingsComponent", () => {
  valdiIt("increments colors via stepper", async (driver) => {
    const prefs = await makePreferences();
    const root = renderImageSettings(driver, prefs, makeViewModel());
    expect(getFieldValue(root, "colors-input")).toBe("2");
    await tapNodeWithKey(root, "colors-increment");
    expect(getFieldValue(root, "colors-input")).toBe("3");
  });

  valdiIt("calls onStretchChange when stretch H is incremented", async (driver) => {
    const onStretchChange = jasmine.createSpy("onStretchChange");
    const prefs = await makePreferences();
    const root = renderImageSettings(
      driver,
      prefs,
      makeViewModel({ onStretchChange }),
    );
    await tapNodeWithKey(root, "preview-stretch-h-increment");
    expect(onStretchChange).toHaveBeenCalledWith(2, 1);
    expect(getFieldValue(root, "preview-stretch-h-count")).toBe("2");
  });

  valdiIt("calls onRepeatChange when repeat H is incremented", async (driver) => {
    const onRepeatChange = jasmine.createSpy("onRepeatChange");
    const prefs = await makePreferences();
    const root = renderImageSettings(
      driver,
      prefs,
      makeViewModel({ onRepeatChange }),
    );
    await tapNodeWithKey(root, "preview-repeat-h-increment");
    expect(onRepeatChange).toHaveBeenCalledWith(2, 1);
    expect(getFieldValue(root, "preview-repeat-h-count")).toBe("2");
  });

  valdiIt("does not call onRepeatChange when no image is loaded", async (driver) => {
    const onRepeatChange = jasmine.createSpy("onRepeatChange");
    const prefs = await makePreferences();
    const root = renderImageSettings(
      driver,
      prefs,
      makeViewModel({ hasImage: false, onRepeatChange }),
    );
    expect(getFieldValue(root, "preview-repeat-h-count")).toBe("1");
    expect(onRepeatChange).not.toHaveBeenCalled();
  });

  valdiIt("calls transform callbacks from buttons", async (driver) => {
    const onFlipH = jasmine.createSpy("onFlipH");
    const onRotate = jasmine.createSpy("onRotate");
    const prefs = await makePreferences();
    const root = renderImageSettings(
      driver,
      prefs,
      makeViewModel({ onFlipH, onRotate }),
    );
    await tapNodeWithKey(root, "preview-flip-h");
    await tapNodeWithKey(root, "preview-rotate");
    expect(onFlipH).toHaveBeenCalled();
    expect(onRotate).toHaveBeenCalled();
  });

  valdiIt("does not show a color legend when no palette is loaded", async (driver) => {
    const prefs = await makePreferences();
    const root = renderImageSettings(driver, prefs, makeViewModel());
    expect(findNodeWithKey(root, "color-legend-label-0").length).toBe(0);
  });

  valdiIt("shows a labeled swatch per palette color once an image has loaded", async (driver) => {
    const prefs = await makePreferences();
    const root = renderImageSettings(
      driver,
      prefs,
      makeViewModel({ palette: [0x000000, 0xff0000, 0xffffff] }),
    );
    expect(getLabelValue(root, "color-legend-label-0")).toBe("Color 1");
    expect(getLabelValue(root, "color-legend-label-1")).toBe("Color 2");
    expect(getLabelValue(root, "color-legend-label-2")).toBe("Color 3");
    expect(findNodeWithKey(root, "color-legend-swatch-2").length).toBe(1);
    expect(findNodeWithKey(root, "color-legend-label-3").length).toBe(0);
  });

  valdiIt("shows knit side image help after tapping ?", async (driver) => {
    const prefs = await makePreferences();
    const root = renderImageSettings(driver, prefs, makeViewModel());
    expect(getLabelValue(root, "knit-side-image-help-text")).toBeUndefined();
    await tapNodeWithKey(root, "knit-side-image-help-button");
    expect(getLabelValue(root, "knit-side-image-help-text")).toContain(
      "finished knit",
    );
  });

  valdiIt("shows needle range suggestion for a loaded pattern", async (driver) => {
    const prefs = await makePreferences();
    const root = renderImageSettings(
      driver,
      prefs,
      makeViewModel({ imageWidth: 60, imageHeight: 10 }),
    );
    expect(getLabelValue(root, "needle-range-suggestion")).toBe(
      "Suggested for this 60-stitch pattern: Left 30 – Right 30.",
    );
  });

  valdiIt("expands needle range help when ? is tapped", async (driver) => {
    const prefs = await makePreferences();
    const root = renderImageSettings(
      driver,
      prefs,
      makeViewModel({ imageWidth: 60, imageHeight: 10 }),
    );
    expect(getLabelValue(root, "needle-range-help-text")).toBeUndefined();
    await tapNodeWithKey(root, "needle-range-help-button");
    expect(getLabelValue(root, "needle-range-help-text")).toContain(
      "Match your cast-on",
    );
  });

  valdiIt(
    "picks up preference resets while mounted instead of showing stale values",
    async (driver) => {
      const prefs = await makePreferences();
      // Start from a non-default alignment so the reset is observable.
      prefs.defaultAlignment = Alignment.RIGHT;

      const onSettingsChange = jasmine.createSpy("onSettingsChange");
      renderImageSettings(driver, prefs, makeViewModel({ onSettingsChange }));

      expect(onSettingsChange).toHaveBeenCalledWith(
        jasmine.objectContaining({ alignment: Alignment.RIGHT }),
      );
      onSettingsChange.calls.reset();

      // Simulates tapping "Reset defaults" in PreferencesScreen while this
      // panel is still mounted elsewhere in the tree.
      await prefs.reset();

      expect(onSettingsChange).toHaveBeenCalledWith(
        jasmine.objectContaining({ alignment: Alignment.CENTER }),
      );
    },
  );
});
