import { findNodeWithKey } from "foundation/test/util/findNodeWithKey";
import { getAttributeFromNode } from "foundation/test/util/getAttributeFromNode";
import "jasmine/src/jasmine";
import { IComponent } from "valdi_core/src/IComponent";
import {
  KnitActionBanner,
  KnitActionBannerViewModel,
} from "ayab_valdi/src/KnitActionBanner";
import { IComponentTestDriver, valdiIt } from "valdi_test/test/JSXTestUtils";

function renderBanner(
  driver: IComponentTestDriver,
  viewModel: KnitActionBannerViewModel,
): IComponent {
  const nodes = driver.render(() => {
    <KnitActionBanner {...viewModel} />;
  });
  return nodes[0].component!;
}

describe("KnitActionBanner", () => {
  valdiIt("renders row counter during knitting", async (driver) => {
    const root = renderBanner(driver, {
      message: "Please knit.",
      currentRow: 7,
      totalRows: 120,
    });
    expect(findNodeWithKey(root, "knit-action-banner").length).toBe(1);
    const rowNode = findNodeWithKey(root, "knit-action-row-counter")[0];
    expect(getAttributeFromNode<string>(rowNode, "value")).toBe("Row 7 of 120");
  });

  valdiIt("renders completion phase copy", async (driver) => {
    const root = renderBanner(driver, {
      message: "Pattern completed",
      level: "success",
    });
    expect(findNodeWithKey(root, "knit-action-banner").length).toBe(1);
  });
});
