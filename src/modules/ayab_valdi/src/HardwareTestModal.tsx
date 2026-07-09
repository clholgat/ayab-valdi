import { StatefulComponent } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { View, Layout } from "valdi_tsx/src/NativeTemplateElements";
import { BUTTON_FONT_SMALL } from "constants/src/Typography";
import { Token } from "constants/src/SerialConstants";
import {
  CoreButton,
  CoreButtonColoring,
  CoreButtonSizing,
} from "widgets/src/components/button/CoreButton";
import { HardwareTestPanel } from "./HardwareTestPanel";
import { ValueNotifier } from "./ValueNotifier";

export interface HardwareTestModalViewModel {
  logNotifier: ValueNotifier<string>;
  readyNotifier: ValueNotifier<boolean>;
  onClose: () => void;
  onCommand: (token: Token) => void;
}

interface HardwareTestCommand {
  id: string;
  label: string;
  token: Token;
}

const HARDWARE_TEST_COMMANDS: HardwareTestCommand[] = [
  { id: "hw-cmd-help", label: "help", token: Token.helpCmd },
  { id: "hw-cmd-send", label: "send", token: Token.sendCmd },
  { id: "hw-cmd-beep", label: "beep", token: Token.beepCmd },
  { id: "hw-cmd-readEOL", label: "readEOL", token: Token.readEOLsensorsCmd },
  { id: "hw-cmd-readEnc", label: "readEnc", token: Token.readEncodersCmd },
  { id: "hw-cmd-autoRead", label: "autoRead", token: Token.autoReadCmd },
  { id: "hw-cmd-autoTest", label: "autoTest", token: Token.autoTestCmd },
];

interface HardwareTestModalState {
  log: string;
  ready: boolean;
}

export class HardwareTestModal extends StatefulComponent<
  HardwareTestModalViewModel,
  HardwareTestModalState
> {
  state: HardwareTestModalState = { log: "", ready: false };

  private unsubscribeLog?: () => void;
  private unsubscribeReady?: () => void;

  onCreate(): void {
    this.subscribeToNotifiers();
  }

  onViewModelUpdate(previous?: HardwareTestModalViewModel): void {
    if (
      previous?.logNotifier !== this.viewModel.logNotifier ||
      previous?.readyNotifier !== this.viewModel.readyNotifier
    ) {
      this.subscribeToNotifiers();
    }
  }

  onDestroy(): void {
    this.unsubscribeLog?.();
    this.unsubscribeReady?.();
    this.unsubscribeLog = undefined;
    this.unsubscribeReady = undefined;
  }

  private subscribeToNotifiers(): void {
    this.unsubscribeLog?.();
    this.unsubscribeReady?.();
    this.unsubscribeLog = this.viewModel.logNotifier.subscribe((log) => {
      if (!this.isDestroyed()) {
        this.setState({ log });
      }
    });
    this.unsubscribeReady = this.viewModel.readyNotifier.subscribe((ready) => {
      if (!this.isDestroyed()) {
        this.setState({ ready });
      }
    });
  }

  onRender(): void {
    const vm = this.viewModel;
    <view accessibilityId="hardware-test-modal" key="hardware-test-modal" style={styles.overlay}>
      <view
        accessibilityId="hardware-test-modal-backdrop"
        key="hardware-test-modal-backdrop"
        style={styles.backdrop}
        onTap={vm.onClose}
      />
      <layout style={styles.dialog}>
        <HardwareTestPanel
          log={this.state.log}
          ready={this.state.ready}
          onClose={vm.onClose}
        />
        <layout style={styles.commandRow}>
          {HARDWARE_TEST_COMMANDS.map((command) => (
            <CoreButton
              accessibilityId={command.id}
              key={command.id}
              text={command.label}
              onTap={() => vm.onCommand(command.token)}
              coloring={CoreButtonColoring.SECONDARY}
              sizing={CoreButtonSizing.SMALL}
              font={BUTTON_FONT_SMALL}
              disabled={!this.state.ready}
            />
          ))}
          <CoreButton
            accessibilityId="hw-cmd-quit"
            key="hw-cmd-quit"
            text="quit"
            onTap={vm.onClose}
            coloring={CoreButtonColoring.SECONDARY}
            sizing={CoreButtonSizing.SMALL}
            font={BUTTON_FONT_SMALL}
          />
        </layout>
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
    maxWidth: 520,
    flexShrink: 0,
  }),
  commandRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  }),
};
