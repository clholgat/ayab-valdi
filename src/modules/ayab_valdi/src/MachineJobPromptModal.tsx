import { Component } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { Label, View } from "valdi_tsx/src/NativeTemplateElements";
import { OperatorPrompt } from "machine_job/src/MachineJobTypes";
import { BUTTON_FONT_SMALL } from "constants/src/Typography";
import {
  CoreButton,
  CoreButtonColoring,
  CoreButtonSizing,
} from "widgets/src/components/button/CoreButton";

export interface MachineJobPromptModalViewModel {
  prompt: OperatorPrompt;
  timing: "before" | "after";
  passIndex: number;
  onAcknowledge: () => void;
}

function promptTitle(prompt: OperatorPrompt): string {
  switch (prompt.kind) {
    case "shape": return "Shape the work";
    case "yarnChange": return "Change yarn";
    case "carriageChange": return "Change carriage";
    case "manualAction": return "Manual step";
    case "confirm": return "Check before continuing";
    default: return "Machine-job note";
  }
}

/** Blocking operator instruction shown at a safe Simulation pass boundary. */
export class MachineJobPromptModal extends Component<MachineJobPromptModalViewModel> {
  onRender(): void {
    const vm = this.viewModel;
    const boundary = vm.timing === "before" ? "Before" : "After";
    <view key="machine-job-prompt-modal" accessibilityId="machine-job-prompt-modal" style={styles.overlay}>
      <view style={styles.backdrop} />
      <view style={styles.dialog}>
        <label style={styles.eyebrow} value={`${boundary} pass ${vm.passIndex + 1}`} />
        <label style={styles.title} value={promptTitle(vm.prompt)} numberOfLines={0} />
        <label style={styles.body} value={vm.prompt.text} numberOfLines={0} />
        <label
          style={styles.hint}
          value="Complete this step at the machine, then acknowledge it to continue Simulation."
          numberOfLines={0}
        />
        <CoreButton
          key="machine-job-prompt-acknowledge"
          accessibilityId="machine-job-prompt-acknowledge"
          text={vm.prompt.acknowledgementRequired ? "Done — continue" : "Continue"}
          onTap={vm.onAcknowledge}
          coloring={CoreButtonColoring.PRIMARY}
          sizing={CoreButtonSizing.LARGE}
          font={BUTTON_FONT_SMALL}
        />
      </view>
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
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  }),
  dialog: new Style<View>({
    width: "100%",
    maxWidth: 520,
    padding: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    flexShrink: 0,
  }),
  eyebrow: new Style<Label>({
    font: "system-bold 14",
    color: "#6b7280",
    marginBottom: 8,
  }),
  title: new Style<Label>({
    font: "system-bold 24",
    color: "#111827",
    marginBottom: 12,
  }),
  body: new Style<Label>({
    font: "system 19",
    color: "#111827",
    marginBottom: 12,
  }),
  hint: new Style<Label>({
    font: "system 16",
    color: "#4b5563",
    marginBottom: 20,
  }),
};
