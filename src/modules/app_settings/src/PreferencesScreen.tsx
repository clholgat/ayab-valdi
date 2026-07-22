/**
 * Application preferences screen — desktop PrefsDialog parity (English-only, no locale).
 */

import { StatefulComponent } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { Label, Layout, View } from "valdi_tsx/src/NativeTemplateElements";
import { sansBoldFont, sansFont, BUTTON_FONT_SMALL } from "constants/src/Typography";
import { PickerTrigger } from "constants/src/PickerTrigger";
import {
  ActivePickerConfig,
  OptionPickerModal,
} from "constants/src/OptionPickerModal";
import { Preferences } from "./Preferences";
import { PreferencesProvider } from "./PreferencesProvider";
import { AspectRatio } from "./Types";
import { Machine } from "state_machine/src/Machine";
import {
  withProviders,
  ProvidersValuesViewModel,
} from "valdi_core/src/provider/withProviders";
import {
  CoreButton,
  CoreButtonColoring,
  CoreButtonSizing,
} from "widgets/src/components/button/CoreButton";
import { CoreToggle } from "widgets/src/components/toggle/CoreToggle";
import { ModalCloseButton } from "constants/src/ModalCloseButton";
import { AboutScreen } from "./AboutScreen";
import {
  SIDEBAR_CARD_BACKGROUND,
  SIDEBAR_CARD_BORDER,
  sidebarCardInnerStyle,
  sidebarCardStyle,
  SIDEBAR_FIELD_HEIGHT,
} from "constants/src/SidebarStyles";

/** Which (if any) of the field option-picker modals is currently open. */
type PickerKind = "machine" | "aspectRatio";

export interface PreferencesScreenViewModel {
  onClose: () => void;
  onMachineChange?: () => void;
  onChange?: () => void;
  onHardwareTest?: () => void;
  onRestartTour?: () => void;
  hardwareTestDisabled?: boolean;
  isHardwareTesting?: boolean;
  restartTourDisabled?: boolean;
  machineTourHighlighted?: boolean;
}

interface PreferencesScreenInnerViewModel
  extends PreferencesScreenViewModel, ProvidersValuesViewModel<[Preferences]> {}

interface State {
  machineIndex: number;
  aspectRatioIndex: number;
  quietMode: boolean;
  disableHardwareBeep: boolean;
  subView: "main" | "about";
  openPicker: PickerKind | null;
}

class PreferencesScreenInner extends StatefulComponent<
  PreferencesScreenInnerViewModel,
  State
> {
  state: State = {
    machineIndex: Machine.KH910_KH950,
    aspectRatioIndex: AspectRatio.FAIRISLE,
    quietMode: Preferences.DEFAULT_QUIET_MODE,
    disableHardwareBeep: Preferences.DEFAULT_DISABLE_HARDWARE_BEEP,
    subView: "main",
    openPicker: null,
  };

  private get preferences(): Preferences {
    return this.viewModel.providersValues[0];
  }

  onCreate(): void {
    this.syncFromPreferences();
  }

  private syncFromPreferences(): void {
    const prefs = this.preferences;
    const machine = prefs.machine;
    const machineIndex =
      machine >= 0 && machine < Machine.getAllLabels().length
        ? machine
        : Machine.KH910_KH950;
    this.setState({
      machineIndex,
      aspectRatioIndex: prefs.aspectRatio,
      quietMode: prefs.quietMode,
      disableHardwareBeep: prefs.disableHardwareBeep,
    });
  };

  private handleMachineChange = (index: number): void => {
    const machine = index as Machine;
    this.setState({ machineIndex: index });
    this.preferences.machine = machine;
    this.viewModel.onMachineChange?.();
  };

  private handleAspectRatioChange = (index: number): void => {
    this.setState({ aspectRatioIndex: index });
    this.preferences.aspectRatio = index as AspectRatio;
  };

  private handleAppBeepsToggle = (): void => {
    const quietMode = !this.state.quietMode;
    this.setState({ quietMode });
    this.preferences.quietMode = quietMode;
  };

  private handleHardwareBeepsToggle = (): void => {
    const disableHardwareBeep = !this.state.disableHardwareBeep;
    this.setState({ disableHardwareBeep });
    this.preferences.disableHardwareBeep = disableHardwareBeep;
  };

  private handleDone = (): void => {
    this.viewModel.onClose();
  };

  private handleReset = (): void => {
    void this.preferences.reset().then(() => {
      if (!this.isDestroyed()) {
        this.syncFromPreferences();
        this.viewModel.onMachineChange?.();
      }
    });
  };

  private handleShowAbout = (): void => {
    this.setState({ subView: "about" });
  };

  private handleAboutBack = (): void => {
    this.setState({ subView: "main" });
  };

  private handleHardwareTest = (): void => {
    this.viewModel.onHardwareTest?.();
  };

  private handleRestartTour = (): void => {
    this.viewModel.onRestartTour?.();
  };

  private openMachinePicker = (): void => {
    this.setState({ openPicker: "machine" });
  };

  private openAspectRatioPicker = (): void => {
    this.setState({ openPicker: "aspectRatio" });
  };

  private closePicker = (): void => {
    this.setState({ openPicker: null });
  };

  /**
   * Rendered once, as the last child of the top-level settings card, so its
   * absolute-position overlay paints over every field regardless of which
   * one triggered it (matches ImageSettingsComponent's shared-picker-modal
   * approach in the image_settings module).
   */
  private getActivePickerConfig(): ActivePickerConfig | null {
    switch (this.state.openPicker) {
      case "machine":
        return {
          title: "Machine",
          labels: Machine.getAllLabels(),
          selectedIndex: this.state.machineIndex,
          onSelect: this.handleMachineChange,
        };
      case "aspectRatio":
        return {
          title: "Aspect ratio",
          labels: AspectRatio.getAllLabels(),
          selectedIndex: this.state.aspectRatioIndex,
          onSelect: this.handleAspectRatioChange,
        };
      default:
        return null;
    }
  }

  private handleActivePickerSelect = (index: number): void => {
    this.getActivePickerConfig()?.onSelect(index);
    this.closePicker();
  };

  private renderPickerRow(
    label: string,
    value: string,
    accessibilityId: string,
    onOpen: () => void,
  ): void {
    <layout style={styles.fieldRow}>
      <label style={styles.fieldLabel} value={label} />
      <layout style={styles.pickerWrap}>
        <PickerTrigger
          accessibilityId={accessibilityId}
          style={styles.picker}
          value={value}
          onTap={onOpen}
        />
      </layout>
    </layout>;
  }

  private renderBeepRow(
    label: string,
    enabled: boolean,
    onToggle: () => void,
    toggleAccessibilityId: string,
  ): void {
    <layout style={styles.fieldRow}>
      <label style={styles.fieldLabel} value={label} />
      <layout style={styles.controlColumn}>
        <CoreToggle
          key={toggleAccessibilityId}
          accessibilityId={toggleAccessibilityId}
          on={enabled}
          onTap={onToggle}
        />
      </layout>
    </layout>;
  }

  private renderAboutView(): void {
    <AboutScreen
      onClose={this.handleAboutBack}
      closeLabel="Back"
      closeAccessibilityId="about-back"
    />;
  }

  private renderMainView(): void {
    const machineHighlighted = this.viewModel.machineTourHighlighted === true;
    <layout style={styles.mainContent}>
      <view accessibilityId="app-beeps-status" key="app-beeps-status">
        <label
          accessibilityId="app-beeps-status-value"
          key="app-beeps-status-value"
          style={styles.hiddenProbe}
          value={this.state.quietMode ? "off" : "on"}
        />
      </view>
      <view accessibilityId="hardware-beeps-status" key="hardware-beeps-status">
        <label
          accessibilityId="hardware-beeps-status-value"
          key="hardware-beeps-status-value"
          style={styles.hiddenProbe}
          value={this.state.disableHardwareBeep ? "off" : "on"}
        />
      </view>
      <view
        accessibilityId="checklist-target-machine"
        key="checklist-target-machine"
        style={styles.machineSection}
        borderColor={machineHighlighted ? "#2563EB" : "transparent"}
        borderWidth={machineHighlighted ? 2 : 0}
      >
        {this.renderPickerRow(
          "Machine",
          Machine.getAllLabels()[this.state.machineIndex] ?? "",
          "machine-picker",
          this.openMachinePicker,
        )}
        <label
          style={styles.fieldHint}
          value="Brother model — sets needle-bed width and behavior."
        />
      </view>
      {this.renderPickerRow(
        "Aspect ratio",
        AspectRatio.getAllLabels()[this.state.aspectRatioIndex] ?? "",
        "aspect-ratio-picker",
        this.openAspectRatioPicker,
      )}
      {this.renderBeepRow(
        "App beeps",
        !this.state.quietMode,
        this.handleAppBeepsToggle,
        "app-beeps-toggle",
      )}
      {this.renderBeepRow(
        "Hardware beeps",
        !this.state.disableHardwareBeep,
        this.handleHardwareBeepsToggle,
        "hardware-beeps-toggle",
      )}
      <layout style={styles.buttonRow}>
        <layout style={styles.buttonSlotLast}>
          <CoreButton
            accessibilityId="restart-tour-button"
            key="restart-tour-button"
            text="Show getting started tour"
            onTap={this.handleRestartTour}
            coloring={CoreButtonColoring.SECONDARY}
            sizing={CoreButtonSizing.SMALL}
            font={BUTTON_FONT_SMALL}
            disabled={this.viewModel.restartTourDisabled}
            width="100%"
          />
        </layout>
      </layout>
      <layout style={styles.toolsRow}>
        <layout style={styles.buttonSlot}>
          <CoreButton
            accessibilityId="hardware-test-button"
            text={
              this.viewModel.isHardwareTesting ? "Testing..." : "Hardware Test"
            }
            onTap={this.handleHardwareTest}
            coloring={CoreButtonColoring.SECONDARY}
            sizing={CoreButtonSizing.SMALL}
            font={BUTTON_FONT_SMALL}
            disabled={this.viewModel.hardwareTestDisabled}
            width="100%"
          />
        </layout>
        <layout style={styles.buttonSlotLast}>
          <CoreButton
            accessibilityId="about-button"
            text="About"
            onTap={this.handleShowAbout}
            coloring={CoreButtonColoring.SECONDARY}
            sizing={CoreButtonSizing.SMALL}
            font={BUTTON_FONT_SMALL}
            width="100%"
          />
        </layout>
      </layout>
      <layout style={styles.buttonRow}>
        <layout style={styles.buttonSlot}>
          <CoreButton
            text="Reset defaults"
            onTap={this.handleReset}
            coloring={CoreButtonColoring.SECONDARY}
            sizing={CoreButtonSizing.SMALL}
            font={BUTTON_FONT_SMALL}
            width="100%"
          />
        </layout>
        <layout style={styles.buttonSlot}>
          <CoreButton
            accessibilityId="preferences-done"
            key="preferences-done"
            text="Done"
            onTap={this.handleDone}
            coloring={CoreButtonColoring.PRIMARY}
            sizing={CoreButtonSizing.SMALL}
            font={BUTTON_FONT_SMALL}
            width="100%"
          />
        </layout>
      </layout>
    </layout>;
  }

  onRender(): void {
    const activePicker = this.getActivePickerConfig();
    <view
      accessibilityId={
        this.state.subView === "about" ? "about-panel" : "preferences-panel"
      }
      key={this.state.subView === "about" ? "about-panel" : "preferences-panel"}
      style={sidebarCardStyle}
      backgroundColor={SIDEBAR_CARD_BACKGROUND}
      borderColor={SIDEBAR_CARD_BORDER}
      borderWidth={1}
    >
      <layout style={sidebarCardInnerStyle}>
        <layout style={styles.titleRow}>
          <label
            style={styles.title}
            value={this.state.subView === "about" ? "About" : "Settings"}
          />
          <ModalCloseButton
            accessibilityId="settings-modal-close"
            onTap={this.viewModel.onClose}
          />
        </layout>
        {this.state.subView === "about"
          ? this.renderAboutView()
          : this.renderMainView()}
      </layout>
      {activePicker ? (
        <OptionPickerModal
          accessibilityId="preferences-picker-modal"
          title={activePicker.title}
          labels={activePicker.labels}
          selectedIndex={activePicker.selectedIndex}
          onSelect={this.handleActivePickerSelect}
          onClose={this.closePicker}
        />
      ) : undefined}
    </view>;
  }
}

export const PreferencesScreen = withProviders(PreferencesProvider)(
  PreferencesScreenInner,
);

const styles = {
  titleRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  }),
  title: new Style<Label>({
    font: sansBoldFont(16),
    color: "#111827",
    flexGrow: 1,
    flexShrink: 1,
  }),
  mainContent: new Style<Layout>({
    width: "100%",
    flexDirection: "column",
  }),
  fieldRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  }),
  fieldLabel: new Style<Label>({
    font: sansFont(13),
    color: "#374151",
    width: 140,
    flexShrink: 0,
  }),
  controlColumn: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  }),
  pickerWrap: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  }),
  picker: new Style<View>({
    width: "100%",
    height: SIDEBAR_FIELD_HEIGHT,
    flexShrink: 0,
  }),
  machineSection: new Style<View>({
    width: "100%",
    borderRadius: 8,
    padding: 4,
    marginBottom: 4,
  }),
  fieldHint: new Style<Label>({
    font: sansFont(12),
    color: "#6B7280",
    marginTop: 2,
    marginBottom: 4,
    numberOfLines: 0,
  }),
  buttonRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    marginTop: 8,
  }),
  toolsRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    marginTop: 12,
  }),
  buttonSlot: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
    marginRight: 8,
  }),
  buttonSlotLast: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
  }),
  aboutContent: new Style<Layout>({
    width: "100%",
    flexDirection: "column",
  }),
  aboutName: new Style<Label>({
    font: sansBoldFont(15),
    color: "#111827",
    marginBottom: 4,
  }),
  aboutDetail: new Style<Label>({
    font: sansFont(13),
    color: "#374151",
    marginBottom: 4,
  }),
  aboutLink: new Style<Label>({
    font: sansFont(12),
    color: "#2563EB",
    marginBottom: 12,
    numberOfLines: 0,
  }),
  hiddenProbe: new Style<Label>({
    font: sansFont(1),
    color: "#FFFFFF",
    height: 1,
    width: 1,
  }),
};
