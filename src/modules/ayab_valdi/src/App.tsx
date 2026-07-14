import { StatefulComponent } from "valdi_core/src/Component";
import { View, Layout, Label } from "valdi_tsx/src/NativeTemplateElements";
import { ElementFrame } from "valdi_tsx/src/Geometry";
import { Style } from "valdi_core/src/Style";
import { Device } from "valdi_core/src/Device";
import {
  ImageSettings,
} from "image_settings/src/ImageSettingsComponent";
import { Preferences } from "app_settings/src/Preferences";
import { PreferencesProvider } from "app_settings/src/PreferencesProvider";
import { Machine } from "state_machine/src/Machine";
import { KnitSession } from "./KnitSession";
import { HardwareTestSession } from "./HardwareTestSession";
import { Token } from "constants/src/SerialConstants";
import { FeedbackMessage } from "./Feedback";
import { shouldShowKnitActionBanner } from "./KnitSessionUiLogic";
import { SettingsModal } from "./SettingsModal";
import { HardwareTestModal } from "./HardwareTestModal";
import {
  getKnitDisabledReason,
  isKnitButtonDisabled,
} from "./AppUiState";
import { APP_BACKGROUND } from "constants/src/UiTheme";
import { BUTTON_FONT_SMALL } from "constants/src/Typography";
import { PreviewPanel } from "./PreviewPanel";
import { ValueNotifier } from "./ValueNotifier";
import {
  AudioFeedbackSink,
  NullAudioFeedback,
} from "./AudioFeedback";
import { PlatformAudioFeedback } from "./PlatformAudioFeedback";
import { AppSidebar } from "./AppSidebar";
import { reportBug } from "app_settings/src/BugReport";
import { computePreviewPalette } from "./PreviewPalette";
import { createAppImageHandlers } from "./AppImageHandlers";
import { ActiveTourBubble, InlineTourBubble } from "./InlineTourBubble";
import { AppKnitFooter } from "./AppKnitFooter";
import {
  CoreButton,
  CoreButtonColoring,
  CoreButtonSizing,
} from "widgets/src/components/button/CoreButton";
import {
  FIRST_RUN_TOUR_STEP_COUNT,
  FirstRunTourStep,
  getFirstRunTourStep,
  nextTourStepIndex,
  previousTourStepIndex,
  tourHighlightActive,
} from "./FirstRunTour";
import {
  closeAppHardwareTest,
  KNIT_FINISHED_MESSAGE,
  resetHardwareTestNotifiers,
  runAppHardwareTest,
  runAppKnit,
  sendAppHardwareTestCommand,
  awaitActiveKnitRun,
} from "./AppSessions";

/**
 * @ViewModel
 * @ExportModel
 */
export interface AppViewModel {
  /**
   * Lets an external caller (e.g. a pattern-generator tool) inject a
   * pre-loaded image, bypassing the file picker. Only applied when
   * `initialImageRevision` increases, mirroring Preview's
   * `syncedBits`/`imageBitsRevision` mechanism.
   */
  initialImageBits?: Uint8Array[][];
  initialImageRevision?: number;
  /**
   * When false, hides machine-connection UI (serial-port picker, knit
   * footer) so the app serves pattern prep/preview only — e.g. on Android,
   * where knitting stays desktop-driven. Defaults to true.
   */
  enableMachineIo?: boolean;
}

/**
 * @Context
 * @ExportModel
 */
export interface AppComponentContext {}

interface State {
  preferences: Preferences;
  currentImageSettings?: ImageSettings;
  selectedSerialPort?: string;
  isKnitting: boolean;
  knitSession?: KnitSession;
  imageBits?: Uint8Array[][];
  imageWidth?: number;
  imageHeight?: number;
  /** Pattern before repeat tiling — updated when preview loads or transforms. */
  sourceImageBits?: Uint8Array[][];
  stretchH: number;
  stretchV: number;
  repeatH: number;
  repeatV: number;
  /** Bumped when image bits change from outside Preview (e.g. repeat in Image Settings). */
  imageBitsRevision: number;
  /** Bumped when persisted preferences change. */
  preferencesRevision: number;
  /** Bump when machine type changes so image settings reclamp needle range. */
  machineRevision: number;
  userMessage?: FeedbackMessage;
  showPreferences: boolean;
  isHardwareTesting: boolean;
  hwTestSession?: HardwareTestSession;
  firstRunTourStep: number | null;
  /** Narrow-viewport mode: the sidebar moves into a slide-over drawer. */
  compactLayout: boolean;
  sidebarDrawerOpen: boolean;
}

/**
 * @Component
 * @ExportModel
 */
export class App extends StatefulComponent<AppViewModel, AppComponentContext> {
  private readonly audioSink: AudioFeedbackSink = Device.isWeb()
    ? new PlatformAudioFeedback()
    : new NullAudioFeedback();

  private readonly knitStatusNotifier = new ValueNotifier(0);
  private readonly hwTestLogNotifier = new ValueNotifier("");
  private readonly hwTestReadyNotifier = new ValueNotifier(false);
  private readonly imageHandlers = createAppImageHandlers(() => ({
    sourceImageBits: this.state.sourceImageBits,
    stretchH: this.state.stretchH,
    stretchV: this.state.stretchV,
    repeatH: this.state.repeatH,
    repeatV: this.state.repeatV,
    imageBitsRevision: this.state.imageBitsRevision,
  }));
  private unsubscribePreferences?: () => void;
  private paletteCache: { key: string; palette: number[] } | null = null;

  state: State = {
    preferences: new Preferences(),
    isKnitting: false,
    preferencesRevision: 0,
    machineRevision: 0,
    imageBitsRevision: 0,
    stretchH: 1,
    stretchV: 1,
    repeatH: 1,
    repeatV: 1,
    showPreferences: false,
    isHardwareTesting: false,
    firstRunTourStep: null,
    compactLayout: false,
    sidebarDrawerOpen: false,
  };

  onCreate(): void {
    if (Device.isWeb()) {
      const e2eWs = (globalThis as { __E2E_WEBSOCKET_URI__?: string })
        .__E2E_WEBSOCKET_URI__;
      if (e2eWs) {
        this.state.selectedSerialPort = e2eWs;
      }
    }

    this.unsubscribePreferences = this.state.preferences.onChanged(() => {
      if (!this.isDestroyed()) {
        this.setState({
          preferencesRevision: this.state.preferencesRevision + 1,
        });
      }
    });

    this.state.preferences
      .initialize()
      .then(() => {
        if (this.isDestroyed()) {
          return;
        }
        const startTour = !this.state.preferences.firstRunTourCompleted;
        this.setState({
          firstRunTourStep: startTour ? 0 : null,
          showPreferences: startTour ? true : this.state.showPreferences,
        });
      })
      .catch((error) => {
        console.error("Failed to initialize preferences:", error);
      });
  }

  onDestroy(): void {
    this.unsubscribePreferences?.();
    this.state.knitSession?.cancel();
    this.state.hwTestSession?.cancel();
  }

  onViewModelUpdate(previous?: AppViewModel): void {
    const revision = this.viewModel.initialImageRevision;
    if (
      revision == null ||
      revision === previous?.initialImageRevision ||
      this.viewModel.initialImageBits == null
    ) {
      return;
    }
    const bits = this.viewModel.initialImageBits;
    const height = bits.length;
    const width = height > 0 ? bits[0]!.length : 0;
    this.handleBitsLoaded(bits, width, height);
  }

  private handleBitsLoaded = (
    bits: Uint8Array[][],
    width: number,
    height: number,
  ): void => {
    this.setState(this.imageHandlers.handleBitsLoaded(bits, width, height));
  };

  private handleStretchChange = (stretchH: number, stretchV: number): void => {
    const next = this.imageHandlers.handleStretchChange(stretchH, stretchV);
    if (next) {
      this.setState(next);
    }
  };

  private handleRepeatChange = (repeatH: number, repeatV: number): void => {
    const next = this.imageHandlers.handleRepeatChange(repeatH, repeatV);
    if (next) {
      this.setState(next);
    }
  };

  private handleFlipH = (): void => {
    const next = this.imageHandlers.handleFlipH();
    if (next) {
      this.setState(next);
    }
  };

  private handleFlipV = (): void => {
    const next = this.imageHandlers.handleFlipV();
    if (next) {
      this.setState(next);
    }
  };

  private handleRotateLeft = (): void => {
    const next = this.imageHandlers.handleRotateLeft();
    if (next) {
      this.setState(next);
    }
  };

  private handleInvert = (): void => {
    const next = this.imageHandlers.handleInvert();
    if (next) {
      this.setState(next);
    }
  };

  private handleMachineChange = (): void => {
    this.setState({ machineRevision: this.state.machineRevision + 1 });
  };

  private handleSerialPortChange = (serialPort: string): void => {
    this.setState({ selectedSerialPort: serialPort });
  };

  private handleSettingsChange = (settings: ImageSettings): void => {
    this.setState({ currentImageSettings: settings });
  };

  /**
   * RGB palette for the currently loaded pattern, memoized by the inputs
   * that actually affect it - recomputing this full quantization pass on
   * every unrelated render (e.g. a userMessage text change) would be wasted
   * work.
   */
  private getPreviewPalette(machineWidth: number): number[] {
    const { imageBits, imageWidth, imageHeight, imageBitsRevision, currentImageSettings, sourceImageBits } =
      this.state;
    if (!sourceImageBits || !imageBits || !imageWidth || !imageHeight || !currentImageSettings) {
      this.paletteCache = null;
      return [];
    }
    const key = [
      imageBitsRevision,
      currentImageSettings.numColors,
      currentImageSettings.mode,
      machineWidth,
      currentImageSettings.startNeedle,
      currentImageSettings.stopNeedle,
    ].join(":");
    if (this.paletteCache && this.paletteCache.key === key) {
      return this.paletteCache.palette;
    }
    const palette = computePreviewPalette({
      imageBits,
      imageWidth,
      imageHeight,
      numColors: currentImageSettings.numColors,
      mode: currentImageSettings.mode,
      machineWidth,
      startNeedle: currentImageSettings.startNeedle,
      stopNeedle: currentImageSettings.stopNeedle,
    });
    this.paletteCache = { key, palette };
    return palette;
  }

  private handleKnit = (): void => {
    void this.startKnit();
  };

  private handleHardwareTestClose = (): void => {
    closeAppHardwareTest(
      this.state.hwTestSession,
      this.hwTestLogNotifier,
      this.hwTestReadyNotifier,
    );
    this.setState({
      isHardwareTesting: false,
      hwTestSession: undefined,
    });
  };

  private handleHardwareTestCommand = (
    token: Token,
    payload: number[] = [],
  ): void => {
    sendAppHardwareTestCommand(
      this.state.hwTestSession,
      this.hwTestLogNotifier,
      token,
      payload,
    );
  };

  private handleHardwareTestFromSettings = (): void => {
    this.setState({ showPreferences: false });
    void this.startHardwareTest();
  };

  private handleRestartTourFromSettings = (): void => {
    this.setState({ showPreferences: true, firstRunTourStep: 0 });
  };

  private handleCancel = (): void => {
    if (!this.state.isKnitting || !this.state.knitSession) {
      return;
    }
    this.state.knitSession.cancel();
    this.knitStatusNotifier.set(0);
    this.setState({ isKnitting: false, knitSession: undefined });
    // Wait for the cancelled run (and Web Serial unlock/close) before a new knit.
    void awaitActiveKnitRun();
  };

  private handleOpenSettings = (): void => {
    this.setState({ showPreferences: true });
  };

  private handleReportBug = (): void => {
    const result = reportBug();
    if (!result.opened) {
      this.setState({
        userMessage: {
          text: "Bug report link copied to clipboard — paste it into your browser.",
          level: "info",
        },
      });
    }
  };

  private handleCloseSettings = (): void => {
    this.setState({ showPreferences: false });
  };

  private completeFirstRunTour = (): void => {
    this.state.preferences.firstRunTourCompleted = true;
    this.setState({ firstRunTourStep: null });
  };

  private handleTourNext = (): void => {
    const step = this.state.firstRunTourStep;
    if (step == null) {
      return;
    }
    const next = nextTourStepIndex(step);
    if (next === "complete") {
      this.setState({ showPreferences: false });
      this.completeFirstRunTour();
      return;
    }
    this.setState({
      firstRunTourStep: next,
      showPreferences: next === 0,
    });
  };

  private handleTourBack = (): void => {
    const step = this.state.firstRunTourStep;
    if (step == null || step <= 0) {
      return;
    }
    const previous = previousTourStepIndex(step);
    this.setState({
      firstRunTourStep: previous,
      showPreferences: previous === 0,
    });
  };

  private handleRootLayout = (frame: ElementFrame): void => {
    const compact = frame.width > 0 && frame.width <= COMPACT_LAYOUT_MAX_WIDTH;
    if (compact !== this.state.compactLayout) {
      this.setState({ compactLayout: compact, sidebarDrawerOpen: false });
    }
  };

  private handleOpenSidebarDrawer = (): void => {
    this.setState({ sidebarDrawerOpen: true });
  };

  private handleCloseSidebarDrawer = (): void => {
    this.setState({ sidebarDrawerOpen: false });
  };

  private renderAppSidebar(
    previewPalette: number[] | undefined,
    knitDisabled: boolean,
    knitDisabledReason: string | null,
    tourStep: FirstRunTourStep | undefined,
    tourBubble: ActiveTourBubble | null,
    inDrawer: boolean,
  ): void {
    <AppSidebar
      enableMachineIo={this.viewModel.enableMachineIo}
      fillWidth={inDrawer}
      omitKnitFooter={inDrawer}
      onClose={inDrawer ? this.handleCloseSidebarDrawer : undefined}
      sessionLocked={this.state.isKnitting || this.state.isHardwareTesting}
      machineRevision={this.state.machineRevision}
      imageWidth={this.state.imageWidth}
      imageHeight={this.state.imageHeight}
      imageBitsRevision={this.state.imageBitsRevision}
      hasImage={this.state.sourceImageBits != null}
      repeatH={this.state.repeatH}
      repeatV={this.state.repeatV}
      stretchH={this.state.stretchH}
      stretchV={this.state.stretchV}
      palette={previewPalette}
      knitDisabled={knitDisabled}
      knitDisabledReason={knitDisabledReason}
      isKnitting={this.state.isKnitting}
      userMessageText={this.state.userMessage?.text}
      userMessageLevel={this.state.userMessage?.level}
      activeTourTargetId={tourStep?.targetId}
      tourBubble={tourBubble}
      onOpenSettings={this.handleOpenSettings}
      onReportBug={this.handleReportBug}
      onSerialPortChange={this.handleSerialPortChange}
      onSettingsChange={this.handleSettingsChange}
      onStretchChange={this.handleStretchChange}
      onRepeatChange={this.handleRepeatChange}
      onFlipH={this.handleFlipH}
      onFlipV={this.handleFlipV}
      onRotate={this.handleRotateLeft}
      onInvert={this.handleInvert}
      onKnit={this.handleKnit}
      onCancel={this.handleCancel}
    />;
  }

  private renderInlineSidebar(
    previewPalette: number[] | undefined,
    knitDisabled: boolean,
    knitDisabledReason: string | null,
    tourStep: FirstRunTourStep | undefined,
    tourBubble: ActiveTourBubble | null,
  ): void {
    if (this.state.compactLayout) {
      return;
    }
    this.renderAppSidebar(previewPalette, knitDisabled, knitDisabledReason, tourStep, tourBubble, false);
  }

  /**
   * Compact mode: a fixed bottom action bar keeps the primary action (Knit /
   * Cancel + status) always visible — matching the desktop's pinned footer —
   * next to a Controls button that opens the settings drawer.
   */
  private renderCompactSidebarControls(
    previewPalette: number[] | undefined,
    knitDisabled: boolean,
    knitDisabledReason: string | null,
    tourStep: FirstRunTourStep | undefined,
    tourBubble: ActiveTourBubble | null,
  ): void {
    if (!this.state.compactLayout) {
      return;
    }
    <layout key="compact-bottom-bar" style={styles.compactBottomBar}>
      <layout style={styles.compactControlsWrap}>
        <CoreButton
          accessibilityId="sidebar-drawer-toggle"
          key="sidebar-drawer-toggle"
          text="Controls"
          onTap={this.handleOpenSidebarDrawer}
          coloring={CoreButtonColoring.SECONDARY}
          sizing={CoreButtonSizing.SMALL}
          font={BUTTON_FONT_SMALL}
          width="100%"
        />
      </layout>
      {this.renderCompactKnitFooter(knitDisabled, knitDisabledReason, tourStep, tourBubble)}
    </layout>;
    if (!this.state.sidebarDrawerOpen) {
      return;
    }
    <view key="sidebar-drawer-scrim" style={styles.drawerScrim} onTap={this.handleCloseSidebarDrawer} />;
    <view key="sidebar-drawer" style={styles.drawer}>
      {this.renderAppSidebar(previewPalette, knitDisabled, knitDisabledReason, tourStep, tourBubble, true)}
    </view>;
  }

  private renderCompactKnitFooter(
    knitDisabled: boolean,
    knitDisabledReason: string | null,
    tourStep: FirstRunTourStep | undefined,
    tourBubble: ActiveTourBubble | null,
  ): void {
    if (this.viewModel.enableMachineIo === false) {
      return;
    }
    // The prominent action banner at the top already shows the live knit
    // message; suppress the footer's copy while it does (same gating as the
    // desktop sidebar).
    const showActionBanner = shouldShowKnitActionBanner(
      this.state.isKnitting,
      this.state.userMessage?.text,
    );
    <layout style={styles.compactKnitWrap}>
      <AppKnitFooter
        isKnitting={this.state.isKnitting}
        knitDisabled={knitDisabled}
        knitDisabledReason={knitDisabledReason}
        userMessageText={showActionBanner ? undefined : this.state.userMessage?.text}
        userMessageLevel={showActionBanner ? undefined : this.state.userMessage?.level}
        tourHighlighted={tourHighlightActive(tourStep?.targetId, "checklist-target-knit")}
        onKnit={this.handleKnit}
        onCancel={this.handleCancel}
      />
      <InlineTourBubble targetId="checklist-target-knit" bubble={tourBubble} />
    </layout>;
  }

  onRender(): void {
    const session = this.state.knitSession;
    const machine =
      this.state.isKnitting && session?.control.machine != null
        ? session.control.machine
        : this.state.preferences.machine;
    const previewPalette = this.getPreviewPalette(Machine.width(machine));
    const knitDisabled = isKnitButtonDisabled({
      isKnitting: this.state.isKnitting,
      isHardwareTesting: this.state.isHardwareTesting,
      currentImageSettings: this.state.currentImageSettings,
      imageBits: this.state.imageBits,
    });
    const knitDisabledReason = knitDisabled
      ? getKnitDisabledReason({
          isKnitting: this.state.isKnitting,
          isHardwareTesting: this.state.isHardwareTesting,
          currentImageSettings: this.state.currentImageSettings,
          imageBits: this.state.imageBits,
          imageWidth: this.state.imageWidth,
          imageHeight: this.state.imageHeight,
        })
      : null;
    const tourStep =
      this.state.firstRunTourStep != null
        ? getFirstRunTourStep(this.state.firstRunTourStep)
        : undefined;
    const tourBubble: ActiveTourBubble | null =
      tourStep != null && this.state.firstRunTourStep != null
        ? {
            step: tourStep,
            stepIndex: this.state.firstRunTourStep,
            totalSteps: FIRST_RUN_TOUR_STEP_COUNT,
            onBack: this.handleTourBack,
            onNext: this.handleTourNext,
            onSkip: this.completeFirstRunTour,
          }
        : null;

    <view key="app-root" accessibilityId="app-root" style={styles.main} onLayout={this.handleRootLayout}>
      <PreferencesProvider value={this.state.preferences}>
        <layout style={styles.contentLayout}>
          <layout style={this.state.compactLayout ? styles.leftPanelCompact : styles.leftPanel}>
            <PreviewPanel
              title="Pattern"
              machineWidth={Machine.width(machine)}
              startNeedle={this.state.currentImageSettings?.startNeedle}
              stopNeedle={this.state.currentImageSettings?.stopNeedle}
              alignment={this.state.currentImageSettings?.alignment}
              autoMirror={this.state.currentImageSettings?.autoMirror}
              aspectRatio={this.state.preferences.aspectRatio}
              onBitsLoaded={this.handleBitsLoaded}
              imageBitsRevision={this.state.imageBitsRevision}
              syncedBits={this.state.imageBits}
              knitSession={session}
              isKnitting={this.state.isKnitting}
              statusNotifier={this.knitStatusNotifier}
              userMessageText={this.state.userMessage?.text}
              userMessageLevel={this.state.userMessage?.level}
              tourHighlighted={
                tourStep?.targetId === "checklist-target-pattern"
              }
              tourBubble={tourBubble}
            />
          </layout>
          {this.renderInlineSidebar(previewPalette, knitDisabled, knitDisabledReason, tourStep, tourBubble)}
        </layout>
        {this.renderCompactSidebarControls(previewPalette, knitDisabled, knitDisabledReason, tourStep, tourBubble)}
        {this.state.showPreferences ? (
          <SettingsModal
            onClose={this.handleCloseSettings}
            onMachineChange={this.handleMachineChange}
            onHardwareTest={this.handleHardwareTestFromSettings}
            onRestartTour={this.handleRestartTourFromSettings}
            hardwareTestDisabled={
              this.state.isKnitting || this.state.isHardwareTesting
            }
            isHardwareTesting={this.state.isHardwareTesting}
            restartTourDisabled={
              this.state.isKnitting || this.state.isHardwareTesting
            }
            activeTourTargetId={tourStep?.targetId}
            tourBubble={tourBubble}
          />
        ) : undefined}
        {this.state.isHardwareTesting ? (
          <HardwareTestModal
            logNotifier={this.hwTestLogNotifier}
            readyNotifier={this.hwTestReadyNotifier}
            onClose={this.handleHardwareTestClose}
            onCommand={this.handleHardwareTestCommand}
          />
        ) : undefined}
      </PreferencesProvider>
    </view>;
  }

  private startKnit = async (): Promise<void> => {
    await runAppKnit(
      {
        settings: this.state.currentImageSettings,
        isKnitting: this.state.isKnitting,
        imageBits: this.state.imageBits,
        imageWidth: this.state.imageWidth,
        imageHeight: this.state.imageHeight,
        preferences: this.state.preferences,
        serialPort: this.state.selectedSerialPort,
        audio: this.audioSink,
      },
      {
        onValidationError: (message) => {
          this.setState({ userMessage: message });
        },
        onKnitStarted: (knitSession) => {
          this.setState({ isKnitting: true, knitSession });
        },
        onStatusVersion: (version) => {
          this.knitStatusNotifier.set(version);
        },
        onFeedback: (message) => {
          if (!this.isDestroyed()) {
            this.setState({ userMessage: message });
          }
        },
        onKnitFinished: () => {
          this.knitStatusNotifier.set(0);
          this.setState({
            isKnitting: false,
            knitSession: undefined,
            userMessage: KNIT_FINISHED_MESSAGE,
          });
        },
        onKnitRuntimeError: () => {
          this.knitStatusNotifier.set(0);
          this.setState({
            isKnitting: false,
            knitSession: undefined,
            userMessage: {
              text: "An error occurred while knitting.",
              level: "error",
            },
          });
        },
        isDestroyed: () => this.isDestroyed(),
      },
    );
  };

  private startHardwareTest = async (): Promise<void> => {
    await runAppHardwareTest(
      {
        isKnitting: this.state.isKnitting,
        isHardwareTesting: this.state.isHardwareTesting,
        preferences: this.state.preferences,
        serialPort: this.state.selectedSerialPort,
      },
      {
        onSessionStarted: (session) => {
          resetHardwareTestNotifiers(
            this.hwTestLogNotifier,
            this.hwTestReadyNotifier,
          );
          this.setState({
            isHardwareTesting: true,
            hwTestSession: session,
          });
        },
        onOutput: (text) => {
          this.hwTestLogNotifier.update((log) => log + text);
        },
        onReady: () => {
          this.hwTestReadyNotifier.set(true);
        },
        onFeedback: (message) => {
          if (!this.isDestroyed()) {
            this.setState({ userMessage: message });
          }
        },
        onRuntimeError: () => {
          this.setState({
            isHardwareTesting: false,
            hwTestSession: undefined,
            userMessage: {
              text: "Hardware test failed.",
              level: "error",
            },
          });
          this.hwTestReadyNotifier.set(false);
        },
        isDestroyed: () => this.isDestroyed(),
      },
    );
  };
}

/** Below this root width the sidebar moves into the slide-over drawer. */
const COMPACT_LAYOUT_MAX_WIDTH = 760;

const styles = {
  main: new Style<View>({
    backgroundColor: APP_BACKGROUND,
    width: "100%",
    height: "100%",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    flexDirection: "column",
    padding: 16,
    position: "relative",
  }),
  contentLayout: new Style<Layout>({
    flexDirection: "row",
    width: "100%",
    height: "100%",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    alignItems: "stretch",
    alignSelf: "stretch",
  }),
  leftPanel: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 280,
    minHeight: 0,
    height: "100%",
    paddingRight: 12,
    flexDirection: "column",
    alignItems: "stretch",
    alignSelf: "stretch",
  }),
  // Compact mode: the preview owns the full width (no sidebar gutter, and no
  // minWidth so a 320px viewport can't overflow).
  leftPanelCompact: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    minHeight: 0,
    height: "100%",
    flexDirection: "column",
    alignItems: "stretch",
    alignSelf: "stretch",
  }),
  // Controls stacked above the knit footer: both span the full width, so the
  // footer's status message and Knit/Cancel center on the page.
  compactBottomBar: new Style<Layout>({
    flexDirection: "column",
    flexShrink: 0,
    width: "100%",
    paddingTop: 8,
  }),
  compactControlsWrap: new Style<Layout>({
    width: "100%",
    flexShrink: 0,
    marginBottom: 8,
  }),
  compactKnitWrap: new Style<Layout>({
    width: "100%",
    flexShrink: 0,
    flexDirection: "column",
  }),
  drawerScrim: new Style<View>({
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  }),
  // Full width up to the standard sidebar width: phone-sized viewports get the
  // whole screen (image-settings rows need ~390px); the scrim only peeks
  // through on mid-sized ones.
  drawer: new Style<View>({
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "100%",
    maxWidth: 408,
    backgroundColor: APP_BACKGROUND,
    padding: 12,
    boxShadow: "-2 0 12 rgba(0, 0, 0, 0.3)",
  }),
};
