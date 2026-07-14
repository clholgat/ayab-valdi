import { Component } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { Layout, ScrollView } from "valdi_tsx/src/NativeTemplateElements";
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

    <layout style={styles.rightPanel}>
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
    if (!machineIo) {
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
  // flexShrink 1 + minWidth 0: full 408 on desktop (no shrink pressure), but
  // compresses on narrow viewports (Android phones) instead of overflowing.
  rightPanel: new Style<Layout>({
    width: 408,
    flexShrink: 1,
    flexGrow: 0,
    minWidth: 0,
    height: "100%",
    minHeight: 0,
    flexDirection: "column",
    alignSelf: "stretch",
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
