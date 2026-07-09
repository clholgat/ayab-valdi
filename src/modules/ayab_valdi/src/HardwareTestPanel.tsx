import { StatefulComponent } from "valdi_core/src/Component";
import { ElementRef } from "valdi_core/src/ElementRef";
import { Style } from "valdi_core/src/Style";
import { Layout, Label, ScrollView, ScrollViewInteractive } from "valdi_tsx/src/NativeTemplateElements";
import { sansFont, sansBoldFont, BUTTON_FONT_TINY } from "constants/src/Typography";
import {
  SIDEBAR_CARD_BACKGROUND,
  SIDEBAR_CARD_BORDER,
  sidebarCardInnerStyle,
  sidebarCardStyle,
} from "constants/src/SidebarStyles";
import {
  CoreButton,
  CoreButtonColoring,
  CoreButtonSizing,
} from "widgets/src/components/button/CoreButton";
import { ModalCloseButton } from "constants/src/ModalCloseButton";

export interface HardwareTestPanelViewModel {
  log: string;
  ready: boolean;
  onClose: () => void;
}

const SCROLL_TO_END_BASE = 1_000_000_000;

export class HardwareTestPanel extends StatefulComponent<
  HardwareTestPanelViewModel,
  Record<string, never>
> {
  private logScrollRef = new ElementRef<ScrollViewInteractive>();
  private scrollSeq = 0;
  private pendingScrollHandle?: ReturnType<typeof setTimeout> | number;

  onCreate(): void {
    if (this.viewModel.log.length > 0) {
      this.scrollLogToBottom();
    }
  }

  onViewModelUpdate(prev?: HardwareTestPanelViewModel): void {
    if (prev && prev.log !== this.viewModel.log) {
      this.scrollLogToBottom();
    }
  }

  onDestroy(): void {
    this.cancelPendingScroll();
  }

  private cancelPendingScroll(): void {
    if (this.pendingScrollHandle == null) {
      return;
    }
    if (typeof this.pendingScrollHandle === "number") {
      if (typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(this.pendingScrollHandle);
      }
    } else {
      clearTimeout(this.pendingScrollHandle);
    }
    this.pendingScrollHandle = undefined;
  }

  private scrollLogToBottom(): void {
    this.cancelPendingScroll();
    const schedule =
      typeof requestAnimationFrame !== "undefined"
        ? requestAnimationFrame
        : (cb: () => void) => setTimeout(cb, 0);
    this.pendingScrollHandle = schedule(() => {
      this.pendingScrollHandle = undefined;
      if (this.isDestroyed()) {
        return;
      }
      this.scrollSeq += 1;
      this.logScrollRef.setAttribute(
        "contentOffsetY",
        SCROLL_TO_END_BASE + this.scrollSeq,
      );
    });
  }

  onRender(): void {
    const status = this.viewModel.ready ? "Connected" : "Connecting…";
    <view
      accessibilityId="hardware-test-panel"
      key="hardware-test-panel"
      style={sidebarCardStyle}
      backgroundColor={SIDEBAR_CARD_BACKGROUND}
      borderColor={SIDEBAR_CARD_BORDER}
      borderWidth={1}
    >
      <layout style={sidebarCardInnerStyle}>
        <layout style={styles.headerRow}>
          <label style={styles.title} value="Hardware Test" />
          <layout style={styles.headerRight}>
            <view accessibilityId="hardware-test-status">
              <label style={styles.status} value={status} />
            </view>
            <ModalCloseButton
              accessibilityId="hardware-test-modal-close"
              onTap={this.viewModel.onClose}
            />
          </layout>
        </layout>
        <scroll
          ref={this.logScrollRef}
          accessibilityId="hardware-test-log"
          style={styles.consoleScroll}
        >
          <label
            style={styles.consoleText}
            value={this.viewModel.log.length > 0 ? this.viewModel.log : " "}
          />
        </scroll>
        <layout style={styles.footerRow}>
          <CoreButton
            accessibilityId="hardware-test-close"
            text="Close"
            onTap={this.viewModel.onClose}
            coloring={CoreButtonColoring.PRIMARY}
            sizing={CoreButtonSizing.TINY}
            font={BUTTON_FONT_TINY}
            width="100%"
          />
        </layout>
      </layout>
    </view>;
  }
}

const styles = {
  headerRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  }),
  title: new Style<Label>({
    font: sansBoldFont(16),
    color: "#111827",
    flexGrow: 1,
    flexShrink: 1,
  }),
  headerRight: new Style<Layout>({
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  }),
  status: new Style<Label>({
    font: sansFont(12),
    color: "#6B7280",
    marginRight: 4,
  }),
  consoleScroll: new Style<ScrollView>({
    width: "100%",
    height: 220,
    marginBottom: 8,
    backgroundColor: "#111827",
    borderRadius: 6,
    padding: 8,
  }),
  consoleText: new Style<Label>({
    font: sansFont(12),
    color: "#E5E7EB",
    numberOfLines: 0,
  }),
  footerRow: new Style<Layout>({
    width: "100%",
  }),
};
