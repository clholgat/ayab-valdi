import { findNodeWithKey } from "foundation/test/util/findNodeWithKey";
import { getAttributeFromNode } from "foundation/test/util/getAttributeFromNode";
import { tapNodeWithKey } from "foundation/test/util/tapNodeWithKey";
import "jasmine/src/jasmine";
import { IComponent } from "valdi_core/src/IComponent";
import { Token } from "constants/src/SerialConstants";
import {
  HardwareTestModal,
  HardwareTestModalViewModel,
} from "ayab_valdi/src/HardwareTestModal";
import { ValueNotifier } from "ayab_valdi/src/ValueNotifier";
import { IComponentTestDriver, valdiIt } from "valdi_test/test/JSXTestUtils";

const failOnClose = (): void => fail("onClose should not be called");

const makeViewModel = (
  overrides?: Partial<HardwareTestModalViewModel>,
): HardwareTestModalViewModel => ({
  logNotifier: new ValueNotifier(""),
  readyNotifier: new ValueNotifier(true),
  onClose: failOnClose,
  onCommand: () => {},
  ...overrides,
});

function renderHardwareTestModal(
  driver: IComponentTestDriver,
  viewModel: HardwareTestModalViewModel,
): IComponent {
  const nodes = driver.render(() => {
    <HardwareTestModal {...viewModel} />;
  });
  return nodes[0].component!;
}

function isButtonDisabled(root: IComponent, buttonId: string): boolean | undefined {
  const node = findNodeWithKey(root, buttonId)[0];
  if (!node) {
    return undefined;
  }
  const disabled = getAttributeFromNode<boolean>(node, "disabled");
  return disabled === true;
}

describe("HardwareTestModal", () => {
  valdiIt("renders the hardware test shell", async (driver) => {
    const root = renderHardwareTestModal(driver, makeViewModel());
    expect(findNodeWithKey(root, "hardware-test-modal")[0]).toBeDefined();
    expect(findNodeWithKey(root, "hardware-test-panel")[0]).toBeDefined();
  });

  valdiIt("calls onClose when backdrop is tapped", async (driver) => {
    const onClose = jasmine.createSpy("onClose");
    const root = renderHardwareTestModal(driver, { ...makeViewModel(), onClose });
    await tapNodeWithKey(root, "hardware-test-modal-backdrop");
    expect(onClose).toHaveBeenCalled();
  });

  valdiIt("disables command buttons when not ready", async (driver) => {
    const root = renderHardwareTestModal(
      driver,
      makeViewModel({ readyNotifier: new ValueNotifier(false) }),
    );
    expect(isButtonDisabled(root, "hw-cmd-help")).toBe(true);
    expect(isButtonDisabled(root, "hw-cmd-beep")).toBe(true);
  });

  valdiIt("invokes command callbacks when ready", async (driver) => {
    const onCommand = jasmine.createSpy("onCommand");
    const onClose = jasmine.createSpy("onClose");
    const root = renderHardwareTestModal(
      driver,
      makeViewModel({ onCommand, onClose }),
    );
    await tapNodeWithKey(root, "hw-cmd-beep");
    await tapNodeWithKey(root, "hw-cmd-quit");
    expect(onCommand).toHaveBeenCalledWith(Token.beepCmd);
    expect(onClose).toHaveBeenCalled();
  });
});
