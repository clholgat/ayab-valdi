import { findNodeWithKey } from "foundation/test/util/findNodeWithKey";
import { tapNodeWithKey } from "foundation/test/util/tapNodeWithKey";
import "jasmine/src/jasmine";
import { IComponent } from "valdi_core/src/IComponent";
import {
  MachineJobPromptModal,
  MachineJobPromptModalViewModel,
} from "ayab_valdi/src/MachineJobPromptModal";
import { IComponentTestDriver, valdiIt } from "valdi_test/test/JSXTestUtils";

function renderModal(
  driver: IComponentTestDriver,
  viewModel: MachineJobPromptModalViewModel,
): IComponent {
  return driver.render(() => <MachineJobPromptModal {...viewModel} />)[0].component!;
}

describe("MachineJobPromptModal", () => {
  valdiIt("renders a blocking instruction and acknowledges explicitly", async (driver) => {
    const onAcknowledge = jasmine.createSpy("onAcknowledge");
    const root = renderModal(driver, {
      prompt: {
        id: "shape-1",
        kind: "shape",
        severity: "warning",
        text: "Decrease one stitch at each edge.",
        acknowledgementRequired: true,
      },
      timing: "before",
      passIndex: 3,
      onAcknowledge,
    });
    expect(findNodeWithKey(root, "machine-job-prompt-modal")[0]).toBeDefined();
    await tapNodeWithKey(root, "machine-job-prompt-acknowledge");
    expect(onAcknowledge).toHaveBeenCalled();
  });
});
