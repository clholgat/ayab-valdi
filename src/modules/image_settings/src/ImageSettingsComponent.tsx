import { StatefulComponent } from "valdi_core/src/Component";
import { EditTextEvent, Label, Layout } from "valdi_tsx/src/NativeTemplateElements";
import { Style } from "valdi_core/src/Style";
import { sansFont } from "constants/src/Typography";
import { parseRepeatCount } from "preview/src/ImageTransform";
import {
  buildImageSettings,
  buildNeedleRangeSuggestion,
  clampInt,
  clampNeedleOffsets,
  machineMaxNeedleOffset,
  NEEDLE_RANGE_CAST_ON_HINT,
  needleDefaultsForImageWidth,
} from "./ImageSettingsLogic";
import {
  IndexPickerField,
  IntegerStepperField,
  NeedleOffsetStepper,
  SettingsSectionTitle,
  ToggleField,
} from "./ImageSettingsFieldControls";
import { ImageSettingsTransformSection } from "./ImageSettingsTransformSection";
import { HelpHint } from "constants/src/HelpHint";
import { KNIT_SIDE_IMAGE_HINT } from "preview/src/KnitSidePreviewLogic";
import { Mode, Alignment } from "constants/src/StateMachineConstants";
import { NeedleColor } from "./Types";
import { Machine } from "state_machine/src/Machine";
import { Preferences } from "app_settings/src/Preferences";
import { PreferencesProvider } from "app_settings/src/PreferencesProvider";
import {
  withProviders,
  ProvidersValuesViewModel,
} from "valdi_core/src/provider/withProviders";
import {
  SIDEBAR_CARD_BACKGROUND,
  SIDEBAR_CARD_BORDER,
  sidebarCardInnerStyle,
  sidebarCardStyle,
  sidebarSectionLabelStyle,
} from "constants/src/SidebarStyles";
import { TEXT_SECONDARY } from "constants/src/UiTheme";

const STRETCH_SECTION_HINT =
  "Scale each stitch (1 = original size). Unlike repeat, enlarges pixels instead of tiling.";
const REPEAT_SECTION_HINT =
  "Total tiles in each direction (1 = use pattern once).";

export interface ImageSettingsViewModel {
  /** Incremented when machine type changes so needle offsets can be reclamped. */
  machineRevision?: number;
  imageWidth?: number;
  imageHeight?: number;
  /** Bumped when the source pattern changes (load/transform). */
  imageBitsRevision?: number;
  hasImage?: boolean;
  repeatH?: number;
  repeatV?: number;
  stretchH?: number;
  stretchV?: number;
  onSettingsChange?: (settings: ImageSettings) => void;
  onStretchChange?: (stretchH: number, stretchV: number) => void;
  onRepeatChange?: (repeatH: number, repeatV: number) => void;
  onFlipH?: () => void;
  onFlipV?: () => void;
  onRotate?: () => void;
  onInvert?: () => void;
  tourHighlighted?: boolean;
}

interface ImageSettingsInnerViewModel
  extends ImageSettingsViewModel, ProvidersValuesViewModel<[Preferences]> {}

export interface ImageSettings {
  mode: Mode;
  numColors: number;
  startRow: number;
  infRepeat: boolean;
  startNeedle: number;
  stopNeedle: number;
  alignment: Alignment;
  autoMirror: boolean;
}

interface State {
  mode: Mode;
  numColors: number;
  startRow: number;
  infRepeat: boolean;
  startNeedleColor: NeedleColor;
  startNeedleOffset: number;
  stopNeedleColor: NeedleColor;
  stopNeedleOffset: number;
  alignment: Alignment;
  autoMirror: boolean;
  numColorsText: string;
  startRowText: string;
  startNeedleOffsetText: string;
  stopNeedleOffsetText: string;
  repeatHText: string;
  repeatVText: string;
  stretchHText: string;
  stretchVText: string;
}

export class ImageSettingsComponentInner extends StatefulComponent<
  ImageSettingsInnerViewModel,
  State
> {
  state: State = {
    mode: Mode.SINGLEBED,
    numColors: 2,
    startRow: 0,
    infRepeat: false,
    startNeedleColor: NeedleColor.ORANGE,
    startNeedleOffset: 20,
    stopNeedleColor: NeedleColor.GREEN,
    stopNeedleOffset: 20,
    alignment: Alignment.CENTER,
    autoMirror: false,
    numColorsText: "2",
    startRowText: "1",
    startNeedleOffsetText: "20",
    stopNeedleOffsetText: "20",
    repeatHText: "1",
    repeatVText: "1",
    stretchHText: "1",
    stretchVText: "1",
  };

  private unsubscribePreferences?: () => void;

  private get preferences(): Preferences {
    return this.viewModel.providersValues[0];
  }

  onCreate(): void {
    this.loadFromPreferences();
    this.applyMachineChange();
    if (
      this.viewModel.imageWidth != null &&
      this.viewModel.imageHeight != null
    ) {
      this.updateNeedlesFromImageDimensions();
    }
    // Keep in sync with e.g. "Reset defaults" in PreferencesScreen while this
    // panel stays mounted elsewhere in the tree.
    this.unsubscribePreferences = this.preferences.onChanged(() => {
      if (!this.isDestroyed()) {
        this.loadFromPreferences();
      }
    });
  }

  onDestroy(): void {
    this.unsubscribePreferences?.();
  }

  onViewModelUpdate(previous?: ImageSettingsInnerViewModel): void {
    if (this.isDestroyed()) return;

    if (
      previous != null &&
      previous.machineRevision !== this.viewModel.machineRevision
    ) {
      this.applyMachineChange();
    }
    if (
      this.viewModel.imageWidth != null &&
      this.viewModel.imageHeight != null &&
      (previous?.imageWidth !== this.viewModel.imageWidth ||
        previous?.imageHeight !== this.viewModel.imageHeight)
    ) {
      this.updateNeedlesFromImageDimensions();
    }
    if (
      this.viewModel.imageBitsRevision != null &&
      previous?.imageBitsRevision !== this.viewModel.imageBitsRevision
    ) {
      this.setState({
        repeatHText: String(this.viewModel.repeatH ?? 1),
        repeatVText: String(this.viewModel.repeatV ?? 1),
        stretchHText: String(this.viewModel.stretchH ?? 1),
        stretchVText: String(this.viewModel.stretchV ?? 1),
      });
    }
  }

  private loadFromPreferences(): void {

    const prefs = this.preferences;
    this.setState({
      mode: prefs.defaultKnittingMode || Mode.SINGLEBED,
      infRepeat: prefs.defaultInfiniteRepeat || false,
      alignment: prefs.defaultAlignment || Alignment.CENTER,
      autoMirror: prefs.defaultKnitSideImage || false,
    });
    this.notifySettingsChange();
  }

  private updateNeedlesFromImageDimensions(): void {
    const width = this.viewModel.imageWidth || 0;
    const defaults = needleDefaultsForImageWidth(width);
    const clamped = clampNeedleOffsets(
      defaults.startNeedleOffset,
      defaults.stopNeedleOffset,
      this.getMachineWidth(),
    );

    this.setState({
      ...defaults,
      startNeedleOffset: clamped.startNeedleOffset,
      stopNeedleOffset: clamped.stopNeedleOffset,
      startRowText: "1",
      startRow: 0,
      startNeedleOffsetText: clamped.startNeedleOffset.toString(),
      stopNeedleOffsetText: clamped.stopNeedleOffset.toString(),
    });
    this.notifySettingsChange();
  }

  private applyMachineChange(): void {
    const clamped = clampNeedleOffsets(
      this.state.startNeedleOffset,
      this.state.stopNeedleOffset,
      this.getMachineWidth(),
    );
    this.setState({
      startNeedleOffset: clamped.startNeedleOffset,
      stopNeedleOffset: clamped.stopNeedleOffset,
      startNeedleOffsetText: clamped.startNeedleOffset.toString(),
      stopNeedleOffsetText: clamped.stopNeedleOffset.toString(),
    });
    this.notifySettingsChange();
  }

  private getMachineWidth(): number {
    return Machine.width(this.preferences.machine || Machine.KH910_KH950);
  }

  private notifySettingsChange(): void {
    if (this.viewModel.onSettingsChange) {
      this.viewModel.onSettingsChange(
        buildImageSettings(this.state, this.preferences.machine),
      );
    }
  }

  private handleModeChange = (index: number): void => {
    this.setState({ mode: index as Mode });
    this.notifySettingsChange();
  };

  private handleAlignmentChange = (index: number): void => {
    this.setState({ alignment: index as Alignment });
    this.notifySettingsChange();
  };

  private handleStartNeedleColorChange = (index: number): void => {
    this.setState({ startNeedleColor: index as NeedleColor });
    this.notifySettingsChange();
  };

  private handleStopNeedleColorChange = (index: number): void => {
    this.setState({ stopNeedleColor: index as NeedleColor });
    this.notifySettingsChange();
  };

  private handleNumColorsChange = (e: EditTextEvent): void => {

    const value = e.text;
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 2 && num <= 6) {
      this.setState({
        numColors: num,
        numColorsText: value,
      });
      this.notifySettingsChange();
    } else {
      this.setState({ numColorsText: value });
    }
  };

  private adjustNumColors = (delta: number): void => {
    const next = clampInt(this.state.numColors + delta, 2, 6);
    this.setState({
      numColors: next,
      numColorsText: String(next),
    });
    this.notifySettingsChange();
  };

  private handleStartRowChange = (e: EditTextEvent): void => {
    const value = e.text;
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1) {
      this.setState({
        startRow: num - 1,
        startRowText: value,
      });
      this.notifySettingsChange();
    } else {
      this.setState({ startRowText: value });
    }
  };

  private adjustStartRow = (delta: number): void => {
    const displayRow = Math.max(1, this.state.startRow + 1 + delta);
    this.setState({
      startRow: displayRow - 1,
      startRowText: String(displayRow),
    });
    this.notifySettingsChange();
  };

  private handleStartNeedleOffsetChange = (e: EditTextEvent): void => {
    const value = e.text;
    const num = parseInt(value, 10);
    const maxOffset = machineMaxNeedleOffset(this.getMachineWidth());
    if (!isNaN(num) && num >= 1 && num <= maxOffset) {
      this.setState({
        startNeedleOffset: num,
        startNeedleOffsetText: value,
      });
      this.notifySettingsChange();
    } else {
      this.setState({ startNeedleOffsetText: value });
    }
  };

  private adjustStartNeedleOffset = (delta: number): void => {
    const maxOffset = machineMaxNeedleOffset(this.getMachineWidth());
    const next = clampInt(this.state.startNeedleOffset + delta, 1, maxOffset);
    this.setState({
      startNeedleOffset: next,
      startNeedleOffsetText: String(next),
    });
    this.notifySettingsChange();
  };

  private handleStopNeedleOffsetChange = (e: EditTextEvent): void => {
    const value = e.text;
    const num = parseInt(value, 10);
    const maxOffset = machineMaxNeedleOffset(this.getMachineWidth());
    if (!isNaN(num) && num >= 1 && num <= maxOffset) {
      this.setState({
        stopNeedleOffset: num,
        stopNeedleOffsetText: value,
      });
      this.notifySettingsChange();
    } else {
      this.setState({ stopNeedleOffsetText: value });
    }
  };

  private adjustStopNeedleOffset = (delta: number): void => {
    const maxOffset = machineMaxNeedleOffset(this.getMachineWidth());
    const next = clampInt(this.state.stopNeedleOffset + delta, 1, maxOffset);
    this.setState({
      stopNeedleOffset: next,
      stopNeedleOffsetText: String(next),
    });
    this.notifySettingsChange();
  };

  private handleInfRepeatToggle = (): void => {
    this.setState({ infRepeat: !this.state.infRepeat });
    this.notifySettingsChange();
  };

  private handleAutoMirrorToggle = (): void => {
    const autoMirror = !this.state.autoMirror;
    this.setState({ autoMirror });
    this.preferences.defaultKnitSideImage = autoMirror;
    this.notifySettingsChange();
  };

  private handleStretchHTextChange = (e: EditTextEvent): void => {
    this.setState({ stretchHText: e.text });
    if (!this.viewModel.hasImage) {
      return;
    }
    this.viewModel.onStretchChange?.(
      parseRepeatCount(e.text),
      parseRepeatCount(this.state.stretchVText),
    );
  };

  private adjustStretchH = (delta: number): void => {
    const next = clampInt(parseRepeatCount(this.state.stretchHText) + delta, 1, 99);
    this.setState({ stretchHText: String(next) });
    if (this.viewModel.hasImage) {
      this.viewModel.onStretchChange?.(
        next,
        parseRepeatCount(this.state.stretchVText),
      );
    }
  };

  private handleStretchVTextChange = (e: EditTextEvent): void => {
    this.setState({ stretchVText: e.text });
    if (!this.viewModel.hasImage) {
      return;
    }
    this.viewModel.onStretchChange?.(
      parseRepeatCount(this.state.stretchHText),
      parseRepeatCount(e.text),
    );
  };

  private adjustStretchV = (delta: number): void => {
    const next = clampInt(parseRepeatCount(this.state.stretchVText) + delta, 1, 99);
    this.setState({ stretchVText: String(next) });
    if (this.viewModel.hasImage) {
      this.viewModel.onStretchChange?.(
        parseRepeatCount(this.state.stretchHText),
        next,
      );
    }
  };

  private handleRepeatHTextChange = (e: EditTextEvent): void => {
    this.setState({ repeatHText: e.text });
    if (!this.viewModel.hasImage) {
      return;
    }
    this.viewModel.onRepeatChange?.(
      parseRepeatCount(e.text),
      parseRepeatCount(this.state.repeatVText),
    );
  };

  private adjustRepeatH = (delta: number): void => {
    const next = clampInt(parseRepeatCount(this.state.repeatHText) + delta, 1, 99);
    this.setState({ repeatHText: String(next) });
    if (this.viewModel.hasImage) {
      this.viewModel.onRepeatChange?.(
        next,
        parseRepeatCount(this.state.repeatVText),
      );
    }
  };

  private handleRepeatVTextChange = (e: EditTextEvent): void => {
    this.setState({ repeatVText: e.text });
    if (!this.viewModel.hasImage) {
      return;
    }
    this.viewModel.onRepeatChange?.(
      parseRepeatCount(this.state.repeatHText),
      parseRepeatCount(e.text),
    );
  };

  private adjustRepeatV = (delta: number): void => {
    const next = clampInt(parseRepeatCount(this.state.repeatVText) + delta, 1, 99);
    this.setState({ repeatVText: String(next) });
    if (this.viewModel.hasImage) {
      this.viewModel.onRepeatChange?.(
        parseRepeatCount(this.state.repeatHText),
        next,
      );
    }
  };

  private handleDecrementNumColors = (): void => {
    this.adjustNumColors(-1);
  };

  private handleIncrementNumColors = (): void => {
    this.adjustNumColors(1);
  };

  private handleDecrementStartRow = (): void => {
    this.adjustStartRow(-1);
  };

  private handleIncrementStartRow = (): void => {
    this.adjustStartRow(1);
  };

  private handleDecrementStartNeedle = (): void => {
    this.adjustStartNeedleOffset(-1);
  };

  private handleIncrementStartNeedle = (): void => {
    this.adjustStartNeedleOffset(1);
  };

  private handleDecrementStopNeedle = (): void => {
    this.adjustStopNeedleOffset(-1);
  };

  private handleIncrementStopNeedle = (): void => {
    this.adjustStopNeedleOffset(1);
  };

  private handleDecrementRepeatH = (): void => {
    this.adjustRepeatH(-1);
  };

  private handleIncrementRepeatH = (): void => {
    this.adjustRepeatH(1);
  };

  private handleDecrementStretchH = (): void => {
    this.adjustStretchH(-1);
  };

  private handleIncrementStretchH = (): void => {
    this.adjustStretchH(1);
  };

  private handleDecrementStretchV = (): void => {
    this.adjustStretchV(-1);
  };

  private handleIncrementStretchV = (): void => {
    this.adjustStretchV(1);
  };

  private handleDecrementRepeatV = (): void => {
    this.adjustRepeatV(-1);
  };

  private handleIncrementRepeatV = (): void => {
    this.adjustRepeatV(1);
  };

  private getNeedleRangeSuggestion(): string {
    if (!this.viewModel.hasImage) {
      return "";
    }
    return buildNeedleRangeSuggestion(
      this.viewModel.imageWidth ?? 0,
      this.getMachineWidth(),
    );
  }

  onRender(): void {
    const highlighted = this.viewModel.tourHighlighted === true;
    const needleRangeSuggestion = this.getNeedleRangeSuggestion();
    <view
      accessibilityId="checklist-target-needles"
      style={sidebarCardStyle}
      backgroundColor={SIDEBAR_CARD_BACKGROUND}
      borderColor={highlighted ? "#2563EB" : SIDEBAR_CARD_BORDER}
      borderWidth={highlighted ? 2 : 1}
    >
      <layout style={sidebarCardInnerStyle}>
        <label style={sidebarSectionLabelStyle} value="Image Settings" />

        <SettingsSectionTitle title="Pattern" />
        <IndexPickerField
          label="Mode"
          index={this.state.mode}
          labels={Mode.getAllLabels()}
          onChange={this.handleModeChange}
        />
        <IntegerStepperField
          label="Colors"
          value={this.state.numColorsText}
          onChange={this.handleNumColorsChange}
          onDecrement={this.handleDecrementNumColors}
          onIncrement={this.handleIncrementNumColors}
          inputId="colors-input"
          decrementId="colors-decrement"
          incrementId="colors-increment"
        />
        <IntegerStepperField
          label="Start row"
          value={this.state.startRowText}
          onChange={this.handleStartRowChange}
          onDecrement={this.handleDecrementStartRow}
          onIncrement={this.handleIncrementStartRow}
          inputId="start-row-input"
          decrementId="start-row-decrement"
          incrementId="start-row-increment"
        />

        <HelpHint
          title="Needle range"
          text={NEEDLE_RANGE_CAST_ON_HINT}
          hintId="needle-range-help"
        />
        {needleRangeSuggestion ? (
          <label
            accessibilityId="needle-range-suggestion"
            key="needle-range-suggestion"
            style={styles.needleSuggestion}
            value={needleRangeSuggestion}
          />
        ) : (
          <layout />
        )}
        <NeedleOffsetStepper
          label="Start"
          offsetText={this.state.startNeedleOffsetText}
          colorIndex={this.state.startNeedleColor}
          colorLabels={NeedleColor.getAllLabels()}
          onOffsetChange={this.handleStartNeedleOffsetChange}
          onDecrement={this.handleDecrementStartNeedle}
          onIncrement={this.handleIncrementStartNeedle}
          onColorChange={this.handleStartNeedleColorChange}
          decrementId="start-needle-decrement"
          incrementId="start-needle-increment"
        />
        <NeedleOffsetStepper
          label="Stop"
          offsetText={this.state.stopNeedleOffsetText}
          colorIndex={this.state.stopNeedleColor}
          colorLabels={NeedleColor.getAllLabels()}
          onOffsetChange={this.handleStopNeedleOffsetChange}
          onDecrement={this.handleDecrementStopNeedle}
          onIncrement={this.handleIncrementStopNeedle}
          onColorChange={this.handleStopNeedleColorChange}
          decrementId="stop-needle-decrement"
          incrementId="stop-needle-increment"
        />
        <IndexPickerField
          label="Alignment"
          index={this.state.alignment}
          labels={Alignment.getAllLabels()}
          onChange={this.handleAlignmentChange}
        />

        <ImageSettingsTransformSection
          hasImage={this.viewModel.hasImage}
          onFlipH={this.viewModel.onFlipH}
          onFlipV={this.viewModel.onFlipV}
          onRotate={this.viewModel.onRotate}
          onInvert={this.viewModel.onInvert}
        />

        <HelpHint
          title="Stretch"
          text={STRETCH_SECTION_HINT}
          hintId="stretch-help"
        />
        <IntegerStepperField
          label="Stretch H"
          value={this.state.stretchHText}
          onChange={this.handleStretchHTextChange}
          onDecrement={this.handleDecrementStretchH}
          onIncrement={this.handleIncrementStretchH}
          inputId="preview-stretch-h-count"
          decrementId="preview-stretch-h-decrement"
          incrementId="preview-stretch-h-increment"
          disabled={!this.viewModel.hasImage}
        />
        <IntegerStepperField
          label="Stretch V"
          value={this.state.stretchVText}
          onChange={this.handleStretchVTextChange}
          onDecrement={this.handleDecrementStretchV}
          onIncrement={this.handleIncrementStretchV}
          inputId="preview-stretch-v-count"
          decrementId="preview-stretch-v-decrement"
          incrementId="preview-stretch-v-increment"
          disabled={!this.viewModel.hasImage}
        />

        <HelpHint
          title="Repeat"
          text={REPEAT_SECTION_HINT}
          hintId="repeat-help"
        />
        <IntegerStepperField
          label="Repeat H"
          value={this.state.repeatHText}
          onChange={this.handleRepeatHTextChange}
          onDecrement={this.handleDecrementRepeatH}
          onIncrement={this.handleIncrementRepeatH}
          inputId="preview-repeat-h-count"
          decrementId="preview-repeat-h-decrement"
          incrementId="preview-repeat-h-increment"
          disabled={!this.viewModel.hasImage}
        />
        <IntegerStepperField
          label="Repeat V"
          value={this.state.repeatVText}
          onChange={this.handleRepeatVTextChange}
          onDecrement={this.handleDecrementRepeatV}
          onIncrement={this.handleIncrementRepeatV}
          inputId="preview-repeat-v-count"
          decrementId="preview-repeat-v-decrement"
          incrementId="preview-repeat-v-increment"
          disabled={!this.viewModel.hasImage}
        />

        <SettingsSectionTitle title="Options" />
        <ToggleField
          label="Infinite repeat"
          on={this.state.infRepeat}
          onTap={this.handleInfRepeatToggle}
        />
        <ToggleField
          label="Knit side image"
          on={this.state.autoMirror}
          onTap={this.handleAutoMirrorToggle}
          hint={KNIT_SIDE_IMAGE_HINT}
          hintId="knit-side-image-help"
          toggleId="knit-side-image-toggle"
        />
      </layout>
    </view>;
  }
}

export const ImageSettingsComponent = withProviders(PreferencesProvider)(
  ImageSettingsComponentInner,
);

const styles = {
  needleSuggestion: new Style<Label>({
    font: sansFont(13),
    color: TEXT_SECONDARY,
    marginBottom: 6,
  }),
};
