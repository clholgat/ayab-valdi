import { Component } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { Layout } from "valdi_tsx/src/NativeTemplateElements";
import { BUTTON_FONT_SMALL } from "constants/src/Typography";
import {
  CoreButton,
  CoreButtonColoring,
  CoreButtonSizing,
} from "widgets/src/components/button/CoreButton";
import { SettingsSectionTitle } from "./ImageSettingsFieldControls";

export interface ImageSettingsTransformSectionViewModel {
  hasImage?: boolean;
  onFlipH?: () => void;
  onFlipV?: () => void;
  onRotate?: () => void;
  onInvert?: () => void;
}

export class ImageSettingsTransformSection extends Component<ImageSettingsTransformSectionViewModel> {
  onRender(): void {
    const vm = this.viewModel;
    const disabled = !vm.hasImage;
    <layout>
      <SettingsSectionTitle title="Transform" />
      <layout style={styles.transformButtonRow}>
        <layout style={styles.transformButtonSlot}>
          <CoreButton
            accessibilityId="preview-flip-h"
            key="preview-flip-h"
            text="Flip H"
            onTap={vm.onFlipH}
            coloring={CoreButtonColoring.SECONDARY}
            sizing={CoreButtonSizing.SMALL}
            font={BUTTON_FONT_SMALL}
            disabled={disabled}
            width="100%"
          />
        </layout>
        <layout style={styles.transformButtonSlot}>
          <CoreButton
            accessibilityId="preview-flip-v"
            key="preview-flip-v"
            text="Flip V"
            onTap={vm.onFlipV}
            coloring={CoreButtonColoring.SECONDARY}
            sizing={CoreButtonSizing.SMALL}
            font={BUTTON_FONT_SMALL}
            disabled={disabled}
            width="100%"
          />
        </layout>
        <layout style={styles.transformButtonSlot}>
          <CoreButton
            accessibilityId="preview-rotate"
            key="preview-rotate"
            text="Rotate"
            onTap={vm.onRotate}
            coloring={CoreButtonColoring.SECONDARY}
            sizing={CoreButtonSizing.SMALL}
            font={BUTTON_FONT_SMALL}
            disabled={disabled}
            width="100%"
          />
        </layout>
        <layout style={styles.transformButtonSlotLast}>
          <CoreButton
            accessibilityId="preview-invert"
            key="preview-invert"
            text="Invert"
            onTap={vm.onInvert}
            coloring={CoreButtonColoring.SECONDARY}
            sizing={CoreButtonSizing.SMALL}
            font={BUTTON_FONT_SMALL}
            disabled={disabled}
            width="100%"
          />
        </layout>
      </layout>
    </layout>;
  }
}

const styles = {
  transformButtonRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    flexWrap: "no-wrap",
    alignItems: "center",
    marginBottom: 4,
  }),
  transformButtonSlot: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    marginRight: 6,
    marginBottom: 4,
  }),
  transformButtonSlotLast: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    marginBottom: 4,
  }),
};
