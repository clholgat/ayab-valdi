import { StatefulComponent } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { Label, Layout, ScrollView, View } from "valdi_tsx/src/NativeTemplateElements";
import { sansFont, BUTTON_FONT_SMALL } from "./Typography";
import { TEXT_PRIMARY } from "./UiTheme";
import { SIDEBAR_CARD_BACKGROUND, SIDEBAR_CARD_BORDER } from "./SidebarStyles";
import { ModalCloseButton } from "./ModalCloseButton";
import {
  CoreButton,
  CoreButtonColoring,
  CoreButtonSizing,
} from "widgets/src/components/button/CoreButton";

/** Shape of a currently-open picker: what to show and where selection goes. */
export interface ActivePickerConfig {
  title: string;
  labels: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/** Tap-to-open modal replacement for the native drum-roll IndexPicker widget. */
export interface OptionPickerModalViewModel {
  accessibilityId: string;
  title: string;
  labels: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export class OptionPickerModal extends StatefulComponent<
  OptionPickerModalViewModel,
  Record<string, never>
> {
  private selectHandlers: Array<() => void> = [];

  onCreate(): void {
    this.rebuildHandlers();
  }

  onViewModelUpdate(): void {
    this.rebuildHandlers();
  }

  private rebuildHandlers(): void {
    this.selectHandlers = this.viewModel.labels.map(
      (_, index) => () => this.viewModel.onSelect(index),
    );
  }

  onRender(): void {
    const vm = this.viewModel;
    <view
      accessibilityId={vm.accessibilityId}
      key={vm.accessibilityId}
      style={styles.overlay}
    >
      <view
        accessibilityId={`${vm.accessibilityId}-backdrop`}
        key={`${vm.accessibilityId}-backdrop`}
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
            <label style={styles.title} value={vm.title} />
            <ModalCloseButton
              accessibilityId={`${vm.accessibilityId}-close`}
              onTap={vm.onClose}
            />
          </layout>
          <scroll
            accessibilityId={`${vm.accessibilityId}-scroll`}
            style={styles.scrollArea}
          >
            <layout style={styles.scrollContent}>
              {vm.labels.map((label, index) => {
                const selected = index === vm.selectedIndex;
                return (
                  <view
                    key={`${vm.accessibilityId}-option-${index}`}
                    accessibilityId={`${vm.accessibilityId}-option-${index}`}
                    style={styles.listRow}
                    backgroundColor={selected ? "#E8EEF9" : "transparent"}
                    onTap={this.selectHandlers[index]}
                    touchAreaExtension={4}
                  >
                    <label
                      style={selected ? styles.listLabelSelected : styles.listLabel}
                      value={label}
                    />
                    {selected ? (
                      <label style={styles.checkmark} value="✓" />
                    ) : (
                      <layout />
                    )}
                  </view>
                );
              })}
            </layout>
          </scroll>
          <layout style={styles.footerRow}>
            <CoreButton
              accessibilityId={`${vm.accessibilityId}-cancel`}
              key={`${vm.accessibilityId}-cancel`}
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
    maxWidth: 360,
    minHeight: 160,
    maxHeight: 480,
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
    minHeight: 0,
  }),
  scrollContent: new Style<Layout>({
    width: "100%",
    flexDirection: "column",
    paddingLeft: 8,
    paddingRight: 8,
    paddingBottom: 8,
    flexShrink: 0,
  }),
  listRow: new Style<View>({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 8,
    flexShrink: 0,
  }),
  listLabel: new Style<Label>({
    font: sansFont(15),
    color: TEXT_PRIMARY,
    flexGrow: 1,
    flexShrink: 1,
  }),
  listLabelSelected: new Style<Label>({
    font: sansFont(15),
    color: "#2563EB",
    flexGrow: 1,
    flexShrink: 1,
  }),
  checkmark: new Style<Label>({
    font: sansFont(15),
    color: "#2563EB",
    flexShrink: 0,
    marginLeft: 8,
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
