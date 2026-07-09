import { Component } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { View, Label } from "valdi_tsx/src/NativeTemplateElements";
import { sansFont } from "./Typography";

export interface ModalCloseButtonViewModel {
  onTap: () => void;
  accessibilityId: string;
}

export class ModalCloseButton extends Component<ModalCloseButtonViewModel> {
  onRender(): void {
    <view
      accessibilityId={this.viewModel.accessibilityId}
      key={this.viewModel.accessibilityId}
      style={styles.button}
      onTap={this.viewModel.onTap}
      touchAreaExtension={8}
    >
      <label style={styles.glyph} value="×" />
    </view>;
  }
}

const styles = {
  button: new Style<View>({
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  }),
  glyph: new Style<Label>({
    font: sansFont(22),
    color: "#6B7280",
  }),
};
