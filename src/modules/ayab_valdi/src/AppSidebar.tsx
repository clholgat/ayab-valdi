import { Component } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { Label, Layout, ScrollView, View } from "valdi_tsx/src/NativeTemplateElements";
import { ImageSettings, ImageSettingsComponent } from "image_settings/src/ImageSettingsComponent";
import { BUTTON_FONT_SMALL } from "constants/src/Typography";
import {
  CoreButton,
  CoreButtonColoring,
  CoreButtonSizing,
} from "widgets/src/components/button/CoreButton";
import { SerialPortPicker } from "./SerialPortPicker";
import { AppKnitFooter } from "./AppKnitFooter";
import { FeedbackLevel } from "./Feedback";
import { shouldShowKnitActionBanner } from "./KnitSessionUiLogic";
import { tourHighlightActive } from "./FirstRunTour";
import { ActiveTourBubble, InlineTourBubble } from "./InlineTourBubble";

export interface AppSidebarViewModel {
  /**
   * When false, hides the machine-connection UI (serial-port picker and knit
   * footer) so the sidebar serves pattern prep/preview only — e.g. the
   * Android app, where knitting stays desktop-driven. Defaults to true.
   */
  enableMachineIo?: boolean;
  /** Fill the parent instead of the fixed 408px column (drawer hosting). */
  fillWidth?: boolean;
  /** When provided, renders a close row at the top (drawer hosting). */
  onClose?: () => void;
  /** Drawer hosting: the knit footer lives in the compact bottom bar instead. */
  omitKnitFooter?: boolean;
  sessionLocked: boolean;
  machineRevision: number;
  imageWidth?: number;
  imageHeight?: number;
  imageBitsRevision: number;
  hasImage: boolean;
  repeatH: number;
  repeatV: number;
  stretchH: number;
  stretchV: number;
  /** RGB palette (0xRRGGBB per color index) for the currently loaded pattern. */
  palette?: number[];
  /** Live settings for hydrating a freshly mounted panel (drawer reopen). */
  currentImageSettings?: ImageSettings;
  knitDisabled: boolean;
  knitDisabledReason: string | null;
  isKnitting: boolean;
  userMessageText?: string;
  userMessageLevel?: FeedbackLevel;
  activeTourTargetId?: string;
  tourBubble?: ActiveTourBubble | null;
  onOpenSettings: () => void;
  onReportBug: () => void;
  onSerialPortChange: (serialPort: string) => void;
  onSettingsChange: (settings: ImageSettings) => void;
  onStretchChange: (stretchH: number, stretchV: number) => void;
  onRepeatChange: (repeatH: number, repeatV: number) => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate: () => void;
  onInvert: () => void;
  onKnit: () => void;
  onCancel: () => void;
}

export class AppSidebar extends Component<AppSidebarViewModel> {
  onRender(): void {
    const vm = this.viewModel;
    const machineIo = vm.enableMachineIo !== false;
    const target = vm.activeTourTargetId;
    const showActionBanner = shouldShowKnitActionBanner(
      vm.isKnitting,
      vm.userMessageText,
    );

    <layout style={vm.fillWidth ? styles.rightPanelFill : styles.rightPanel}>
      {this.renderCloseRow()}
      <scroll style={styles.sidebarScroll}>
        <layout style={styles.sidebarScrollInner}>
          <layout style={styles.settingsButtonRow}>
            <CoreButton
              accessibilityId="settings-button"
              text="Settings"
              onTap={vm.onOpenSettings}
              coloring={CoreButtonColoring.SECONDARY}
              sizing={CoreButtonSizing.SMALL}
              font={BUTTON_FONT_SMALL}
              disabled={vm.sessionLocked}
              width="100%"
            />
          </layout>
          <layout style={styles.settingsButtonRow}>
            <CoreButton
              accessibilityId="sidebar-report-bug-button"
              text="Report a bug"
              onTap={vm.onReportBug}
              coloring={CoreButtonColoring.SECONDARY}
              sizing={CoreButtonSizing.SMALL}
              font={BUTTON_FONT_SMALL}
              width="100%"
            />
          </layout>
          {this.renderSerialPicker(machineIo)}
          <ImageSettingsComponent
            initialSettings={vm.currentImageSettings}
            machineRevision={vm.machineRevision}
            imageWidth={vm.imageWidth}
            imageHeight={vm.imageHeight}
            imageBitsRevision={vm.imageBitsRevision}
            hasImage={vm.hasImage}
            repeatH={vm.repeatH}
            repeatV={vm.repeatV}
            stretchH={vm.stretchH}
            stretchV={vm.stretchV}
            palette={vm.palette}
            tourHighlighted={tourHighlightActive(target, "checklist-target-needles")}
            onSettingsChange={vm.onSettingsChange}
            onStretchChange={vm.onStretchChange}
            onRepeatChange={vm.onRepeatChange}
            onFlipH={vm.onFlipH}
            onFlipV={vm.onFlipV}
            onRotate={vm.onRotate}
            onInvert={vm.onInvert}
          />
          <InlineTourBubble
            targetId="checklist-target-needles"
            bubble={vm.tourBubble}
          />
        </layout>
      </scroll>
      {this.renderKnitFooter(machineIo, showActionBanner)}
    </layout>;
  }

  private renderCloseRow(): void {
    const onClose = this.viewModel.onClose;
    if (!onClose) {
      return;
    }
    <layout style={styles.closeRow}>
      <label style={styles.closeTitle} value="Controls" />
      <view
        key="sidebar-drawer-close"
        accessibilityId="sidebar-drawer-close"
        style={styles.closeButton}
        touchAreaExtension={8}
        onTap={onClose}
      >
        <label style={styles.closeGlyph} value="✕" />
      </view>
    </layout>;
  }

  private renderSerialPicker(machineIo: boolean): void {
    if (!machineIo) {
      return;
    }
    const vm = this.viewModel;
    <SerialPortPicker
      tourHighlighted={tourHighlightActive(vm.activeTourTargetId, "checklist-target-connection")}
      onChange={vm.onSerialPortChange}
    />;
    <InlineTourBubble
      targetId="checklist-target-connection"
      bubble={vm.tourBubble}
    />;
  }

  private renderKnitFooter(machineIo: boolean, showActionBanner: boolean): void {
    if (!machineIo || this.viewModel.omitKnitFooter) {
      return;
    }
    const vm = this.viewModel;
    <InlineTourBubble targetId="checklist-target-knit" bubble={vm.tourBubble} />;
    <AppKnitFooter
      isKnitting={vm.isKnitting}
      knitDisabled={vm.knitDisabled}
      knitDisabledReason={vm.knitDisabledReason}
      userMessageText={
        showActionBanner ? undefined : vm.userMessageText
      }
      userMessageLevel={
        showActionBanner ? undefined : vm.userMessageLevel
      }
      tourHighlighted={tourHighlightActive(vm.activeTourTargetId, "checklist-target-knit")}
      onKnit={vm.onKnit}
      onCancel={vm.onCancel}
    />;
  }
}

const styles = {
  // Fixed 408 column: narrow viewports switch to the drawer (App compact
  // mode) instead of squeezing this inline.
  rightPanel: new Style<Layout>({
    width: 408,
    flexShrink: 0,
    flexGrow: 0,
    height: "100%",
    minHeight: 0,
    flexDirection: "column",
    alignSelf: "stretch",
  }),
  // Drawer hosting: the drawer container owns the width.
  rightPanelFill: new Style<Layout>({
    width: "100%",
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 0,
    height: "100%",
    minHeight: 0,
    flexDirection: "column",
    alignSelf: "stretch",
  }),
  closeRow: new Style<Layout>({
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
    paddingBottom: 8,
  }),
  closeTitle: new Style<Label>({
    font: BUTTON_FONT_SMALL,
    color: "#0F172A",
  }),
  closeButton: new Style<View>({
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  }),
  closeGlyph: new Style<Label>({
    font: BUTTON_FONT_SMALL,
    color: "#0F172A",
  }),
  sidebarScroll: new Style<ScrollView>({
    width: "100%",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    alignSelf: "stretch",
  }),
  sidebarScrollInner: new Style<Layout>({
    width: "100%",
    flexDirection: "column",
    paddingBottom: 8,
  }),
  settingsButtonRow: new Style<Layout>({
    width: "100%",
    marginBottom: 8,
  }),
};
