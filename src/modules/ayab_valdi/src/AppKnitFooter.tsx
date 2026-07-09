import { Component } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { View, Layout, Label } from "valdi_tsx/src/NativeTemplateElements";
import { sansFont, BUTTON_FONT_SMALL } from "constants/src/Typography";
import { TEXT_MUTED } from "constants/src/UiTheme";
import {
  CoreButton,
  CoreButtonColoring,
  CoreButtonSizing,
} from "widgets/src/components/button/CoreButton";
import { UserMessage } from "./UserMessage";
import { FeedbackLevel } from "./Feedback";

export interface AppKnitFooterViewModel {
  isKnitting: boolean;
  knitDisabled: boolean;
  knitDisabledReason: string | null;
  userMessageText?: string;
  userMessageLevel?: FeedbackLevel;
  tourHighlighted?: boolean;
  onKnit: () => void;
  onCancel: () => void;
}

export class AppKnitFooter extends Component<AppKnitFooterViewModel> {
  onRender(): void {
    const vm = this.viewModel;
    const highlighted = vm.tourHighlighted === true;
    <view
      accessibilityId="checklist-target-knit"
      style={styles.knitFooterWrap}
      borderColor={highlighted ? "#2563EB" : "transparent"}
      borderWidth={highlighted ? 2 : 0}
    >
      <layout style={styles.knitFooter}>
      <view style={styles.knitFooterDivider} backgroundColor="#E8E4DF" />
      {vm.knitDisabledReason ? (
        <label
          accessibilityId="knit-disabled-reason"
          style={styles.knitHint}
          value={vm.knitDisabledReason}
        />
      ) : undefined}
      {vm.userMessageText ? (
        <UserMessage message={vm.userMessageText} level={vm.userMessageLevel} />
      ) : undefined}
      <layout style={styles.knitButtons}>
        {vm.isKnitting ? (
          <CoreButton
            accessibilityId="cancel-button"
            text="Cancel"
            onTap={vm.onCancel}
            coloring={CoreButtonColoring.SECONDARY}
            sizing={CoreButtonSizing.SMALL}
            font={BUTTON_FONT_SMALL}
            width="100%"
          />
        ) : (
          <CoreButton
            accessibilityId="knit-button"
            text="Knit"
            onTap={vm.onKnit}
            coloring={CoreButtonColoring.PRIMARY}
            sizing={CoreButtonSizing.SMALL}
            font={BUTTON_FONT_SMALL}
            disabled={vm.knitDisabled}
            width="100%"
          />
        )}
      </layout>
      </layout>
    </view>;
  }
}

const styles = {
  knitFooterWrap: new Style<View>({
    width: "100%",
    flexShrink: 0,
  }),
  knitFooter: new Style<Layout>({
    width: "100%",
    flexShrink: 0,
    flexDirection: "column",
    paddingTop: 8,
  }),
  knitFooterDivider: new Style<View>({
    width: "100%",
    height: 1,
    marginBottom: 8,
    flexShrink: 0,
  }),
  knitButtons: new Style<Layout>({
    width: "100%",
    marginTop: 4,
  }),
  knitHint: new Style<Label>({
    font: sansFont(14),
    color: TEXT_MUTED,
    marginBottom: 6,
    numberOfLines: 0,
  }),
};
