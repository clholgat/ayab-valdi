import { StatefulComponent } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { View, Layout } from "valdi_tsx/src/NativeTemplateElements";
import { FlashFirmwarePanel } from "./FlashFirmwarePanel";
import { ValueNotifier } from "./ValueNotifier";

export interface FlashFirmwareModalViewModel {
  progressNotifier: ValueNotifier<number>;
  logNotifier: ValueNotifier<string>;
  doneNotifier: ValueNotifier<boolean>;
  onClose: () => void;
}

interface FlashFirmwareModalState {
  progress: number;
  log: string;
  finished: boolean;
}

export class FlashFirmwareModal extends StatefulComponent<
  FlashFirmwareModalViewModel,
  FlashFirmwareModalState
> {
  state: FlashFirmwareModalState = { progress: 0, log: "", finished: false };

  private unsubscribeProgress?: () => void;
  private unsubscribeLog?: () => void;
  private unsubscribeDone?: () => void;

  onCreate(): void {
    this.subscribeToNotifiers();
  }

  onViewModelUpdate(previous?: FlashFirmwareModalViewModel): void {
    if (
      previous?.progressNotifier !== this.viewModel.progressNotifier ||
      previous?.logNotifier !== this.viewModel.logNotifier ||
      previous?.doneNotifier !== this.viewModel.doneNotifier
    ) {
      this.subscribeToNotifiers();
    }
  }

  onDestroy(): void {
    this.unsubscribeProgress?.();
    this.unsubscribeLog?.();
    this.unsubscribeDone?.();
    this.unsubscribeProgress = undefined;
    this.unsubscribeLog = undefined;
    this.unsubscribeDone = undefined;
  }

  private subscribeToNotifiers(): void {
    this.unsubscribeProgress?.();
    this.unsubscribeLog?.();
    this.unsubscribeDone?.();
    this.unsubscribeProgress = this.viewModel.progressNotifier.subscribe((progress) => {
      if (!this.isDestroyed()) {
        this.setState({ progress });
      }
    });
    this.unsubscribeLog = this.viewModel.logNotifier.subscribe((log) => {
      if (!this.isDestroyed()) {
        this.setState({ log });
      }
    });
    this.unsubscribeDone = this.viewModel.doneNotifier.subscribe((finished) => {
      if (!this.isDestroyed()) {
        this.setState({ finished });
      }
    });
  }

  onRender(): void {
    const vm = this.viewModel;
    <view accessibilityId="flash-firmware-modal" key="flash-firmware-modal" style={styles.overlay}>
      <view
        accessibilityId="flash-firmware-modal-backdrop"
        key="flash-firmware-modal-backdrop"
        style={styles.backdrop}
        onTap={vm.onClose}
      />
      <layout style={styles.dialog}>
        <FlashFirmwarePanel
          log={this.state.log}
          progress={this.state.progress}
          finished={this.state.finished}
          onClose={vm.onClose}
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
    maxWidth: 520,
    flexShrink: 0,
  }),
};
