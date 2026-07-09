import { findNodeWithKey } from "foundation/test/util/findNodeWithKey";
import { getAttributeFromNode } from "foundation/test/util/getAttributeFromNode";
import { tapNodeWithKey } from "foundation/test/util/tapNodeWithKey";
import "jasmine/src/jasmine";
import { IComponent } from "valdi_core/src/IComponent";
import { AboutScreen, AboutScreenViewModel } from "app_settings/src/AboutScreen";
import { APP_NAME, APP_VERSION, APP_REPO_URL } from "constants/src/AppInfo";
import { IComponentTestDriver, valdiIt } from "valdi_test/test/JSXTestUtils";

const failOnClose = (): void => fail("onClose should not be called");

const makeViewModel = (
  overrides?: Partial<AboutScreenViewModel>,
): AboutScreenViewModel => ({
  onClose: failOnClose,
  ...overrides,
});

function renderAboutScreen(
  driver: IComponentTestDriver,
  viewModel: AboutScreenViewModel,
): IComponent {
  const nodes = driver.render(() => {
    <AboutScreen {...viewModel} />;
  });
  return nodes[0].component!;
}

function getLabelValue(root: IComponent, labelKey: string): string | undefined {
  const node = findNodeWithKey(root, labelKey)[0];
  const value = node ? getAttributeFromNode<string>(node, "value") : undefined;
  return typeof value === "string" ? value : undefined;
}

describe("AboutScreen", () => {
  valdiIt("renders app name and version", async (driver) => {
    const root = renderAboutScreen(driver, makeViewModel());
    expect(findNodeWithKey(root, "about-panel")[0]).toBeDefined();
    expect(getLabelValue(root, "about-app-name")).toBe(APP_NAME);
    expect(getLabelValue(root, "about-version")).toBe(`Version ${APP_VERSION}`);
    expect(getLabelValue(root, "about-experimental")).toContain("Experimental");
    expect(getLabelValue(root, "about-repo-link")).toBe(APP_REPO_URL);
  });

  valdiIt("calls onClose when Close is tapped", async (driver) => {
    const onClose = jasmine.createSpy("onClose");
    const root = renderAboutScreen(driver, { onClose });
    await tapNodeWithKey(root, "about-close");
    expect(onClose).toHaveBeenCalled();
  });
});
