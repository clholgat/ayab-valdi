import { Component } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { View, Layout, Label } from "valdi_tsx/src/NativeTemplateElements";
import { sansBoldFont, sansFont, BUTTON_FONT_SMALL } from "constants/src/Typography";
import {
  CoreButton,
  CoreButtonColoring,
  CoreButtonSizing,
} from "widgets/src/components/button/CoreButton";
import { FirstRunTourStep } from "./FirstRunTour";
import {
  SIDEBAR_CARD_BACKGROUND,
  SIDEBAR_CARD_BORDER,
} from "constants/src/SidebarStyles";
import { TEXT_MUTED, TEXT_PRIMARY } from "constants/src/UiTheme";

export interface OnboardingBubbleViewModel {
  step: FirstRunTourStep;
  stepIndex: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}

export class OnboardingBubble extends Component<OnboardingBubbleViewModel> {
  onRender(): void {
    const vm = this.viewModel;
    const isLast = vm.stepIndex >= vm.totalSteps - 1;
    const canGoBack = vm.stepIndex > 0;
    const progress = `Step ${vm.stepIndex + 1} of ${vm.totalSteps}`;

    <view accessibilityId="onboarding-bubble" style={styles.card}>
      <view
        style={styles.cardInner}
        backgroundColor={SIDEBAR_CARD_BACKGROUND}
        borderColor="#2563EB"
        borderWidth={2}
      >
        <layout style={styles.inner}>
          <label style={styles.progress} value={progress} />
          <label style={styles.title} value={vm.step.title} />
          <label style={styles.body} value={vm.step.body} />
          <layout style={styles.skipRow}>
            <CoreButton
              accessibilityId="onboarding-skip"
              text="Skip tour"
              onTap={vm.onSkip}
              coloring={CoreButtonColoring.SECONDARY}
              sizing={CoreButtonSizing.SMALL}
              font={BUTTON_FONT_SMALL}
              width="100%"
            />
          </layout>
          <layout style={styles.navRow}>
            <layout style={styles.navSlot}>
              <CoreButton
                accessibilityId="onboarding-back"
                text="Back"
                onTap={vm.onBack}
                coloring={CoreButtonColoring.SECONDARY}
                sizing={CoreButtonSizing.SMALL}
                font={BUTTON_FONT_SMALL}
                disabled={!canGoBack}
                width="100%"
              />
            </layout>
            <layout style={styles.navSlotLast}>
              <CoreButton
                accessibilityId="onboarding-next"
                text={isLast ? "Done" : "Next"}
                onTap={vm.onNext}
                coloring={CoreButtonColoring.PRIMARY}
                sizing={CoreButtonSizing.SMALL}
                font={BUTTON_FONT_SMALL}
                width="100%"
              />
            </layout>
          </layout>
        </layout>
      </view>
    </view>;
  }
}

const styles = {
  card: new Style<View>({
    width: "100%",
    flexShrink: 0,
  }),
  cardInner: new Style<View>({
    width: "100%",
    borderRadius: 12,
  }),
  inner: new Style<Layout>({
    width: "100%",
    padding: 14,
    flexDirection: "column",
  }),
  progress: new Style<Label>({
    font: sansFont(12),
    color: TEXT_MUTED,
    marginBottom: 4,
  }),
  title: new Style<Label>({
    font: sansBoldFont(16),
    color: TEXT_PRIMARY,
    marginBottom: 6,
    numberOfLines: 0,
  }),
  body: new Style<Label>({
    font: sansFont(14),
    color: TEXT_MUTED,
    marginBottom: 12,
    numberOfLines: 0,
  }),
  skipRow: new Style<Layout>({
    width: "100%",
    marginBottom: 8,
  }),
  navRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  }),
  navSlot: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
    marginRight: 8,
  }),
  navSlotLast: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
  }),
};
