import { Component } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { View, Layout } from "valdi_tsx/src/NativeTemplateElements";
import { PreferencesScreen } from "app_settings/src/PreferencesScreen";
import { ActiveTourBubble, InlineTourBubble } from "./InlineTourBubble";
import { tourHighlightActive } from "./FirstRunTour";

export interface SettingsModalViewModel {
  onClose: () => void;
  onMachineChange?: () => void;
  onChange?: () => void;
  onHardwareTest?: () => void;
  onRestartTour?: () => void;
  hardwareTestDisabled?: boolean;
  isHardwareTesting?: boolean;
  restartTourDisabled?: boolean;
  activeTourTargetId?: string;
  tourBubble?: ActiveTourBubble | null;
}

export class SettingsModal extends Component<SettingsModalViewModel> {
  onRender(): void {
    const vm = this.viewModel;
    <view accessibilityId="settings-modal" key="settings-modal" style={styles.overlay}>
      <view
        accessibilityId="settings-modal-backdrop"
        key="settings-modal-backdrop"
        style={styles.backdrop}
        onTap={vm.onClose}
      />
      <layout style={styles.dialog}>
        <PreferencesScreen
          onClose={vm.onClose}
          onMachineChange={vm.onMachineChange}
          onChange={vm.onChange}
          onHardwareTest={vm.onHardwareTest}
          onRestartTour={vm.onRestartTour}
          hardwareTestDisabled={vm.hardwareTestDisabled}
          isHardwareTesting={vm.isHardwareTesting}
          restartTourDisabled={vm.restartTourDisabled}
          machineTourHighlighted={tourHighlightActive(
            vm.activeTourTargetId,
            "checklist-target-machine",
          )}
        />
        <InlineTourBubble
          targetId="checklist-target-machine"
          bubble={vm.tourBubble}
        />
      </layout>
    </view>;
  }
}

const styles = {
  overlay: new Style<View>({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    padding: 24,
  }),
  backdrop: new Style<View>({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  }),
  dialog: new Style<Layout>({
    width: "100%",
    maxWidth: 440,
    flexShrink: 0,
  }),
};
