import { findNodeWithKey } from "foundation/test/util/findNodeWithKey";
import "jasmine/src/jasmine";
import { IComponent } from "valdi_core/src/IComponent";
import { UserMessage, UserMessageViewModel } from "ayab_valdi/src/UserMessage";
import { IComponentTestDriver, valdiIt } from "valdi_test/test/JSXTestUtils";

function renderUserMessage(
  driver: IComponentTestDriver,
  viewModel: UserMessageViewModel,
): IComponent {
  const nodes = driver.render(() => {
    <UserMessage {...viewModel} />;
  });
  return nodes[0].component!;
}

describe("UserMessage", () => {
  valdiIt("does not render a banner when message is empty", async (driver) => {
    const root = renderUserMessage(driver, { message: "" });
    expect(findNodeWithKey(root, "user-message").length).toBe(0);
  });

  valdiIt("renders a banner for success messages", async (driver) => {
    const root = renderUserMessage(driver, {
      message: "Image transmission finished.",
      level: "success",
    });
    expect(findNodeWithKey(root, "user-message")[0]).toBeDefined();
  });
});
