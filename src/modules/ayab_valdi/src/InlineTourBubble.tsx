import { Component } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { Layout } from "valdi_tsx/src/NativeTemplateElements";
import { FirstRunTourStep } from "./FirstRunTour";
import { OnboardingBubble } from "./OnboardingBubble";

export interface ActiveTourBubble {
  step: FirstRunTourStep;
  stepIndex: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}

export interface InlineTourBubbleViewModel {
  targetId: string;
  bubble?: ActiveTourBubble | null;
}

/** Renders the tour popup directly below the section it describes. */
export class InlineTourBubble extends Component<InlineTourBubbleViewModel> {
  onRender(): void {
    const bubble = this.viewModel.bubble;
    if (bubble == null || bubble.step.targetId !== this.viewModel.targetId) {
      return;
    }

    <layout style={styles.slot}>
      <OnboardingBubble
        step={bubble.step}
        stepIndex={bubble.stepIndex}
        totalSteps={bubble.totalSteps}
        onBack={bubble.onBack}
        onNext={bubble.onNext}
        onSkip={bubble.onSkip}
      />
    </layout>;
  }
}

const styles = {
  slot: new Style<Layout>({
    width: "100%",
    marginTop: 4,
    marginBottom: 8,
    flexShrink: 0,
  }),
};
