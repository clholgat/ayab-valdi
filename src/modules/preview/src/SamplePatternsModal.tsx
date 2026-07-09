import { StatefulComponent } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import {
  ImageView,
  Label,
  Layout,
  ScrollView,
  View,
} from "valdi_tsx/src/NativeTemplateElements";
import { sansFont, BUTTON_FONT_SMALL } from "constants/src/Typography";
import { TEXT_PRIMARY, TEXT_SECONDARY } from "constants/src/UiTheme";
import {
  SIDEBAR_CARD_BACKGROUND,
  SIDEBAR_CARD_BORDER,
} from "constants/src/SidebarStyles";
import { ModalCloseButton } from "constants/src/ModalCloseButton";
import {
  CoreButton,
  CoreButtonColoring,
  CoreButtonSizing,
} from "widgets/src/components/button/CoreButton";
import {
  SAMPLE_PATTERN_LIST_ITEMS,
  SamplePattern,
  resolveSamplePatternImageSrc,
} from "./SamplePatterns";

export interface SamplePatternsModalViewModel {
  onClose: () => void;
  onSelect: (sample: SamplePattern) => void;
}

export class SamplePatternsModal extends StatefulComponent<
  SamplePatternsModalViewModel,
  Record<string, never>
> {
  private selectHandlers: Record<string, () => void> = {};

  onCreate(): void {
    for (const item of SAMPLE_PATTERN_LIST_ITEMS) {
      if (item.kind !== "pattern") {
        continue;
      }
      const pattern = item.sample;
      this.selectHandlers[pattern.id] = () => {
        this.viewModel.onSelect(pattern);
      };
    }
  }

  onRender(): void {
    const vm = this.viewModel;
    <view
      accessibilityId="preview-samples-modal"
      key="preview-samples-modal"
      style={styles.overlay}
    >
      <view
        accessibilityId="preview-samples-modal-backdrop"
        key="preview-samples-modal-backdrop"
        style={styles.backdrop}
        onTap={vm.onClose}
      />
      <view
        style={styles.dialog}
        backgroundColor={SIDEBAR_CARD_BACKGROUND}
        borderColor={SIDEBAR_CARD_BORDER}
        borderWidth={1}
      >
        <layout style={styles.dialogInner}>
          <layout style={styles.headerRow}>
            <label style={styles.title} value="Sample patterns" />
            <ModalCloseButton
              accessibilityId="preview-samples-modal-close"
              onTap={vm.onClose}
            />
          </layout>
          <scroll
            accessibilityId="preview-samples-scroll"
            style={styles.scrollArea}
          >
            <layout style={styles.scrollContent}>
              {SAMPLE_PATTERN_LIST_ITEMS.map((item) =>
                item.kind === "header" ? (
                  <label
                    key={item.id}
                    style={styles.sectionTitle}
                    value={item.title}
                  />
                ) : (
                  <view
                    key={item.sample.id}
                    accessibilityId={item.sample.accessibilityId}
                    style={styles.listRow}
                    onTap={this.selectHandlers[item.sample.id]}
                    touchAreaExtension={4}
                  >
                    <view style={styles.thumbnailFrame}>
                      <image
                        src={resolveSamplePatternImageSrc(item.sample)}
                        objectFit="contain"
                        style={styles.thumbnail}
                      />
                    </view>
                    <label
                      style={styles.listLabel}
                      value={item.sample.label}
                    />
                  </view>
                ),
              )}
            </layout>
          </scroll>
          <layout style={styles.footerRow}>
            <CoreButton
              accessibilityId="preview-samples-cancel"
              text="Cancel"
              onTap={vm.onClose}
              coloring={CoreButtonColoring.SECONDARY}
              sizing={CoreButtonSizing.SMALL}
              font={BUTTON_FONT_SMALL}
            />
          </layout>
        </layout>
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
    flexDirection: "column",
    padding: 16,
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
  dialog: new Style<View>({
    width: "100%",
    maxWidth: 420,
    minHeight: 320,
    maxHeight: 520,
    borderRadius: 12,
    flexDirection: "column",
    flexShrink: 1,
  }),
  dialogInner: new Style<Layout>({
    width: "100%",
    height: "100%",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    flexDirection: "column",
  }),
  headerRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 8,
    paddingTop: 12,
    paddingBottom: 8,
    flexShrink: 0,
  }),
  title: new Style<Label>({
    font: sansFont(18),
    color: TEXT_PRIMARY,
    flexGrow: 1,
    flexShrink: 1,
  }),
  scrollArea: new Style<ScrollView>({
    width: "100%",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 200,
  }),
  scrollContent: new Style<Layout>({
    width: "100%",
    flexDirection: "column",
    paddingLeft: 8,
    paddingRight: 8,
    paddingBottom: 8,
    flexShrink: 0,
  }),
  sectionTitle: new Style<Label>({
    font: sansFont(13),
    color: TEXT_SECONDARY,
    marginLeft: 8,
    marginTop: 8,
    marginBottom: 4,
    flexShrink: 0,
  }),
  listRow: new Style<View>({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 6,
    paddingBottom: 6,
    flexShrink: 0,
  }),
  thumbnailFrame: new Style<View>({
    width: 48,
    height: 48,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: SIDEBAR_CARD_BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  }),
  thumbnail: new Style<ImageView>({
    width: 42,
    height: 42,
    flexShrink: 0,
  }),
  listLabel: new Style<Label>({
    font: sansFont(14),
    color: TEXT_PRIMARY,
    flexGrow: 1,
    flexShrink: 1,
  }),
  footerRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexShrink: 0,
  }),
};
