import { componentTypeFind } from "foundation/test/util/componentTypeFind";
import { componentGetElements } from "foundation/test/util/componentGetElements";
import { elementKeyFind } from "foundation/test/util/elementKeyFind";
import { tapNodeWithKey } from "foundation/test/util/tapNodeWithKey";
import "jasmine/src/jasmine";
import { View } from "valdi_tsx/src/NativeTemplateElements";
import { App } from "ayab_valdi/src/App";
import { AppSidebar } from "ayab_valdi/src/AppSidebar";
import { CoreButton } from "widgets/src/components/button/CoreButton";
import { IComponentTestDriver, valdiIt } from "valdi_test/test/JSXTestUtils";

function renderApp(driver: IComponentTestDriver): App {
  const nodes = driver.render(() => {
    <App enableMachineIo={false} />;
  });
  return nodes[0].component as App;
}

function layoutRootAt(app: App, width: number): void {
  const root = elementKeyFind<View>(componentGetElements(app), "app-root")[0];
  root?.getAttribute("onLayout")?.({ x: 0, y: 0, width, height: 800 });
}

function controlsButton(app: App): CoreButton | undefined {
  return componentTypeFind(app, CoreButton).find(
    button => button.viewModel.text === "Controls",
  );
}

describe("App compact layout", () => {
  valdiIt("Verify wide layouts keep the inline sidebar and no bottom bar", async driver => {
    const app = renderApp(driver);
    layoutRootAt(app, 1280);
    expect(componentTypeFind(app, AppSidebar).length).toBe(1);
    expect(controlsButton(app)).toBeUndefined();
  });

  valdiIt("Verify narrow layouts hide the sidebar behind the bottom-bar Controls button", async driver => {
    const app = renderApp(driver);
    layoutRootAt(app, 390);
    expect(componentTypeFind(app, AppSidebar).length).toBe(0);
    expect(controlsButton(app)).toBeDefined();
  });

  valdiIt("Verify the drawer opens with the sidebar and closes again", async driver => {
    const app = renderApp(driver);
    layoutRootAt(app, 390);
    controlsButton(app)!.viewModel.onTap!();
    expect(componentTypeFind(app, AppSidebar).length).toBe(1);
    expect(elementKeyFind(componentGetElements(app), "sidebar-drawer")[0]).toBeDefined();
    await tapNodeWithKey(app, "sidebar-drawer-close");
    expect(componentTypeFind(app, AppSidebar).length).toBe(0);
  });

  valdiIt("Verify resizing back to wide restores the inline sidebar", async driver => {
    const app = renderApp(driver);
    layoutRootAt(app, 390);
    expect(componentTypeFind(app, AppSidebar).length).toBe(0);
    layoutRootAt(app, 1280);
    expect(componentTypeFind(app, AppSidebar).length).toBe(1);
    expect(controlsButton(app)).toBeUndefined();
  });
});
