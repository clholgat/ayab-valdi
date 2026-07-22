import { Component } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { Label, Layout, View } from "valdi_tsx/src/NativeTemplateElements";
import { sansFont } from "./Typography";
import { TEXT_PRIMARY, TEXT_SECONDARY } from "./UiTheme";

export interface PickerTriggerViewModel {
  accessibilityId: string;
  style: Style<View>;
  value: string;
  onTap: () => void;
}

/** Button that opens an OptionPickerModal, replacing the native drum-roll IndexPicker. */
export class PickerTrigger extends Component<PickerTriggerViewModel> {
  onRender(): void {
    const vm = this.viewModel;
    <view
      accessibilityId={vm.accessibilityId}
      key={vm.accessibilityId}
      style={vm.style}
      backgroundColor="#FFFFFF"
      borderColor="#D6D0C8"
      borderWidth={1}
      onTap={vm.onTap}
    >
      <layout style={styles.row}>
        <label style={styles.valueLabel} value={vm.value} numberOfLines={1} />
        <label style={styles.chevron} value="⌄" />
      </layout>
    </view>;
  }
}

const styles = {
  row: new Style<Layout>({
    width: "100%",
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 10,
    paddingRight: 8,
  }),
  valueLabel: new Style<Label>({
    font: sansFont(15),
    color: TEXT_PRIMARY,
    flexGrow: 1,
    flexShrink: 1,
  }),
  chevron: new Style<Label>({
    font: sansFont(13),
    color: TEXT_SECONDARY,
    flexShrink: 0,
    marginLeft: 4,
  }),
};
