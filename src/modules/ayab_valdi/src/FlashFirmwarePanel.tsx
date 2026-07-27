import { StatefulComponent } from "valdi_core/src/Component";
import { ElementRef } from "valdi_core/src/ElementRef";
import { Style } from "valdi_core/src/Style";
import { Layout, View, Label, ScrollView, ScrollViewInteractive } from "valdi_tsx/src/NativeTemplateElements";
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

export interface FlashFirmwarePanelViewModel {
  log: string;
  /** 0..1 */
  progress: number;
  finished: boolean;
  onClose: () => void;
}

const SCROLL_TO_END_BASE = 1_000_000_000;

export class FlashFirmwarePanel extends StatefulComponent<
  FlashFirmwarePanelViewModel,
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

  onViewModelUpdate(prev?: FlashFirmwarePanelViewModel): void {
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
    const vm = this.viewModel;
    const percent = Math.max(0, Math.min(100, Math.round(vm.progress * 100)));
    const status = vm.finished ? "Done" : `${percent}%`;
    <view
      accessibilityId="flash-firmware-panel"
      key="flash-firmware-panel"
      style={sidebarCardStyle}
      backgroundColor={SIDEBAR_CARD_BACKGROUND}
      borderColor={SIDEBAR_CARD_BORDER}
      borderWidth={1}
    >
      <layout style={sidebarCardInnerStyle}>
        <layout style={styles.headerRow}>
          <label style={styles.title} value="Flash AYAB Firmware" />
          <layout style={styles.headerRight}>
            <view accessibilityId="flash-firmware-status">
              <label style={styles.status} value={status} />
            </view>
            <ModalCloseButton
              accessibilityId="flash-firmware-modal-close"
              onTap={vm.onClose}
            />
          </layout>
        </layout>
        <view accessibilityId="flash-firmware-progress-bar" style={styles.progressTrack}>
          <view style={styles.progressFill(percent)} />
        </view>
        <scroll
          ref={this.logScrollRef}
          accessibilityId="flash-firmware-log"
          style={styles.consoleScroll}
        >
          <label
            style={styles.consoleText}
            value={vm.log.length > 0 ? vm.log : " "}
          />
        </scroll>
        <layout style={styles.footerRow}>
          <CoreButton
            accessibilityId="flash-firmware-close"
            text={vm.finished ? "Close" : "Cancel"}
            onTap={vm.onClose}
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
  progressTrack: new Style<View>({
    width: "100%",
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
    marginBottom: 8,
  }),
  progressFill: (percent: number) =>
    new Style<View>({
      width: `${percent}%`,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#2563EB",
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
