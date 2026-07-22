import { Component, StatefulComponent } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import {
  EditTextEvent,
  Label,
  Layout,
  TextField,
  View,
} from "valdi_tsx/src/NativeTemplateElements";
import { sansFont } from "constants/src/Typography";
import {
  helpHintBodyStyle,
  helpHintButtonLabelStyle,
  helpHintButtonStyle,
} from "constants/src/HelpHint";
import { CoreToggle } from "widgets/src/components/toggle/CoreToggle";
import { SIDEBAR_FIELD_HEIGHT } from "constants/src/SidebarStyles";
import { TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from "constants/src/UiTheme";
import { PickerTrigger } from "constants/src/PickerTrigger";

const LABEL_WIDTH = 100;
const PICKER_EXTRA_WIDTH = 36;
const PICKER_CHAR_WIDTH = 8.2;
/** Sidebar card inner width (408px panel − 20px padding). */
const SIDEBAR_INNER_WIDTH = 388;
const MAX_PICKER_WIDTH = SIDEBAR_INNER_WIDTH - LABEL_WIDTH;

/** Width for an IndexPicker that fits its longest option label. */
export function estimateIndexPickerWidth(labels: string[]): number {
  const longestLabel = labels.reduce(
    (longest, label) => (label.length > longest.length ? label : longest),
    "",
  );
  const estimated = Math.ceil(
    longestLabel.length * PICKER_CHAR_WIDTH + PICKER_EXTRA_WIDTH,
  );
  return Math.min(estimated, MAX_PICKER_WIDTH);
}

const compactPickerStyleCache = new Map<number, Style<View>>();

function compactPickerStyle(width: number): Style<View> {
  let style = compactPickerStyleCache.get(width);
  if (!style) {
    style = new Style<View>({
      width,
      height: SIDEBAR_FIELD_HEIGHT,
      flexShrink: 0,
    });
    compactPickerStyleCache.set(width, style);
  }
  return style;
}

export interface SettingsSectionTitleViewModel {
  title: string;
}

export class SettingsSectionTitle extends Component<SettingsSectionTitleViewModel> {
  onRender(): void {
    <label style={fieldStyles.sectionTitle} value={this.viewModel.title} />;
  }
}

const STEPPER_BUTTON_SIZE = 44;
const INTEGER_INPUT_WIDTH = 52;

export interface IntegerStepperFieldViewModel {
  label: string;
  value: string;
  onChange: (event: EditTextEvent) => void;
  onDecrement: () => void;
  onIncrement: () => void;
  inputId?: string;
  decrementId?: string;
  incrementId?: string;
  disabled?: boolean;
}

export class IntegerStepperField extends Component<IntegerStepperFieldViewModel> {
  onRender(): void {
    const vm = this.viewModel;
    const disabled = vm.disabled ?? false;
    <layout style={fieldStyles.fieldRow}>
      <label style={fieldStyles.fieldLabel} value={vm.label} />
      <layout style={fieldStyles.controlColumn}>
        <layout style={fieldStyles.stepperRow}>
          <view
            accessibilityId={vm.decrementId}
            key={vm.decrementId}
            style={fieldStyles.stepperButton}
            backgroundColor={disabled ? "#F3F1EE" : "#FFFFFF"}
            borderColor="#D6D0C8"
            borderWidth={1}
            onTap={disabled ? undefined : vm.onDecrement}
          >
            <label style={fieldStyles.stepperButtonLabel} value="−" />
          </view>
          <view style={fieldStyles.numberFieldWrap}>
            <textfield
              accessibilityId={vm.inputId}
              key={vm.inputId}
              style={fieldStyles.numberInput}
              value={vm.value}
              contentType="number"
              onChange={vm.onChange}
            />
          </view>
          <view
            accessibilityId={vm.incrementId}
            key={vm.incrementId}
            style={fieldStyles.stepperButton}
            backgroundColor={disabled ? "#F3F1EE" : "#FFFFFF"}
            borderColor="#D6D0C8"
            borderWidth={1}
            onTap={disabled ? undefined : vm.onIncrement}
          >
            <label style={fieldStyles.stepperButtonLabel} value="+" />
          </view>
        </layout>
      </layout>
    </layout>;
  }
}

export interface IndexPickerFieldViewModel {
  label: string;
  index: number;
  labels: string[];
  /** Opens the shared OptionPickerModal owned by the top-level settings card. */
  onOpenPicker: () => void;
  accessibilityId?: string;
}

export class IndexPickerField extends Component<IndexPickerFieldViewModel> {
  onRender(): void {
    const vm = this.viewModel;
    const pickerWidth = estimateIndexPickerWidth(vm.labels);
    const triggerId = vm.accessibilityId ?? `${vm.label.toLowerCase()}-picker`;
    <layout style={fieldStyles.fieldRow}>
      <label style={fieldStyles.fieldLabel} value={vm.label} />
      <layout style={fieldStyles.compactPickerWrap}>
        <PickerTrigger
          accessibilityId={triggerId}
          style={compactPickerStyle(pickerWidth)}
          value={vm.labels[vm.index] ?? ""}
          onTap={vm.onOpenPicker}
        />
      </layout>
    </layout>;
  }
}

export interface ToggleFieldViewModel {
  label: string;
  on: boolean;
  onTap: () => void;
  hint?: string;
  hintId?: string;
  toggleId?: string;
}

interface ToggleFieldState {
  helpExpanded: boolean;
}

export class ToggleField extends StatefulComponent<
  ToggleFieldViewModel,
  ToggleFieldState
> {
  state: ToggleFieldState = { helpExpanded: false };

  private toggleHelp = (): void => {
    this.setState({ helpExpanded: !this.state.helpExpanded });
  };

  onRender(): void {
    const vm = this.viewModel;
    const helpId = vm.hintId ?? `${vm.toggleId ?? "toggle"}-help`;
    const helpButtonId = `${helpId}-button`;
    <layout style={fieldStyles.toggleFieldColumn}>
      <layout style={fieldStyles.fieldRow}>
        <layout style={fieldStyles.labelWithHelp}>
          <label style={fieldStyles.fieldLabelInRow} value={vm.label} />
          {vm.hint ? (
            <view
              accessibilityId={helpButtonId}
              key={helpButtonId}
              style={helpHintButtonStyle}
              backgroundColor={this.state.helpExpanded ? "#E8EEF9" : "#F3F1EE"}
              borderColor={this.state.helpExpanded ? "#2563EB" : "#D6D0C8"}
              borderWidth={1}
              onTap={this.toggleHelp}
              touchAreaExtension={8}
            >
              <label style={helpHintButtonLabelStyle} value="?" />
            </view>
          ) : (
            <layout />
          )}
        </layout>
        <layout style={fieldStyles.controlColumn}>
          <CoreToggle
            key={vm.toggleId}
            accessibilityId={vm.toggleId}
            on={vm.on}
            onTap={vm.onTap}
          />
        </layout>
      </layout>
      {vm.hint && this.state.helpExpanded ? (
        <label
          accessibilityId={`${helpId}-text`}
          key={`${helpId}-text`}
          style={helpHintBodyStyle}
          value={vm.hint}
          numberOfLines={0}
        />
      ) : (
        <layout />
      )}
    </layout>;
  }
}

export interface NeedleOffsetStepperViewModel {
  label: string;
  offsetText: string;
  colorIndex: number;
  colorLabels: string[];
  onOffsetChange: (event: EditTextEvent) => void;
  onDecrement: () => void;
  onIncrement: () => void;
  /** Opens the shared OptionPickerModal owned by the top-level settings card. */
  onOpenPicker: () => void;
  decrementId?: string;
  incrementId?: string;
  accessibilityId?: string;
}

export class NeedleOffsetStepper extends Component<NeedleOffsetStepperViewModel> {
  onRender(): void {
    const vm = this.viewModel;
    const pickerWidth = estimateIndexPickerWidth(vm.colorLabels);
    const triggerId = vm.accessibilityId ?? `${vm.label.toLowerCase()}-bed-picker`;
    <layout style={fieldStyles.fieldRow}>
      <label style={fieldStyles.fieldLabel} value={vm.label} />
      <layout style={fieldStyles.controlColumnInline}>
        <layout style={fieldStyles.stepperRow}>
          <view
            accessibilityId={vm.decrementId}
            key={vm.decrementId}
            style={fieldStyles.stepperButton}
            backgroundColor="#FFFFFF"
            borderColor="#D6D0C8"
            borderWidth={1}
            onTap={vm.onDecrement}
          >
            <label style={fieldStyles.stepperButtonLabel} value="−" />
          </view>
          <view style={fieldStyles.numberFieldWrap}>
            <textfield
              style={fieldStyles.numberInput}
              value={vm.offsetText}
              contentType="number"
              onChange={vm.onOffsetChange}
            />
          </view>
          <view
            accessibilityId={vm.incrementId}
            key={vm.incrementId}
            style={fieldStyles.stepperButton}
            backgroundColor="#FFFFFF"
            borderColor="#D6D0C8"
            borderWidth={1}
            onTap={vm.onIncrement}
          >
            <label style={fieldStyles.stepperButtonLabel} value="+" />
          </view>
        </layout>
        <layout style={fieldStyles.compactPickerWrapIndented}>
          <PickerTrigger
            accessibilityId={triggerId}
            style={compactPickerStyle(pickerWidth)}
            value={vm.colorLabels[vm.colorIndex] ?? ""}
            onTap={vm.onOpenPicker}
          />
        </layout>
      </layout>
    </layout>;
  }
}

export const fieldStyles = {
  sectionTitle: new Style<Label>({
    font: sansFont(13),
    color: TEXT_MUTED,
    marginBottom: 4,
    marginTop: 8,
  }),
  fieldRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    minHeight: STEPPER_BUTTON_SIZE,
    marginBottom: 4,
  }),
  fieldLabel: new Style<Label>({
    width: LABEL_WIDTH,
    flexShrink: 0,
    font: sansFont(15),
    color: TEXT_SECONDARY,
  }),
  controlColumn: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  }),
  controlColumnInline: new Style<Layout>({
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  }),
  compactPickerWrap: new Style<Layout>({
    flexShrink: 0,
    height: SIDEBAR_FIELD_HEIGHT,
  }),
  compactPickerWrapIndented: new Style<Layout>({
    flexShrink: 0,
    marginLeft: 8,
    height: SIDEBAR_FIELD_HEIGHT,
  }),
  toggleFieldColumn: new Style<Layout>({
    width: "100%",
    flexDirection: "column",
    marginBottom: 4,
  }),
  labelWithHelp: new Style<Layout>({
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    maxWidth: LABEL_WIDTH,
  }),
  fieldLabelInRow: new Style<Label>({
    flexShrink: 1,
    font: sansFont(15),
    color: TEXT_SECONDARY,
  }),
  stepperRow: new Style<Layout>({
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  }),
  stepperButton: new Style<View>({
    width: STEPPER_BUTTON_SIZE,
    height: STEPPER_BUTTON_SIZE,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  }),
  stepperButtonLabel: new Style<Label>({
    font: sansFont(22),
    color: TEXT_SECONDARY,
    textAlign: "center",
  }),
  numberFieldWrap: new Style<View>({
    width: INTEGER_INPUT_WIDTH,
    flexShrink: 0,
    height: STEPPER_BUTTON_SIZE,
    borderWidth: 1,
    borderColor: "#D6D0C8",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingLeft: 4,
    paddingRight: 4,
    marginLeft: 4,
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
  }),
  numberInput: new Style<TextField>({
    width: "100%",
    height: "100%",
    font: sansFont(15),
    color: TEXT_PRIMARY,
    textAlign: "center",
  }),
};
