import { StatefulComponent } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { View, Label } from "valdi_tsx/src/NativeTemplateElements";
import { sansBoldFont, sansFont } from "constants/src/Typography";
import { FeedbackLevel } from "./Feedback";

export interface UserMessageViewModel {
  message?: string;
  level?: FeedbackLevel;
}

interface UserMessageState {
  bannerStyle: Style<View>;
  labelStyle: Style<Label>;
}

function messageColors(level: FeedbackLevel): {
  backgroundColor: string;
  textColor: string;
} {
  switch (level) {
    case "error":
    case "blocking":
      return { backgroundColor: "#FEE2E2", textColor: "#991B1B" };
    case "success":
      return { backgroundColor: "#D1FAE5", textColor: "#065F46" };
    default:
      return { backgroundColor: "#EFF6FF", textColor: "#1E40AF" };
  }
}

export class UserMessage extends StatefulComponent<
  UserMessageViewModel,
  UserMessageState
> {
  state: UserMessageState = {
    bannerStyle: styles.banner(false),
    labelStyle: styles.label("#1E40AF", false),
  };

  onCreate(): void {
    this.updateStyles();
  }

  onViewModelUpdate(_previous?: UserMessageViewModel): void {
    this.updateStyles();
  }

  private updateStyles(): void {
    const message = this.viewModel.message;
    if (!message || message.length === 0) {
      return;
    }
    const level = this.viewModel.level ?? "info";
    const { textColor } = messageColors(level);
    const isKnitPrompt = message === "Please knit.";
    this.setState({
      bannerStyle: styles.banner(isKnitPrompt),
      labelStyle: styles.label(textColor, isKnitPrompt),
    });
  }

  onRender(): void {
    const message = this.viewModel.message;
    if (!message || message.length === 0) {
      return;
    }

    const level = this.viewModel.level ?? "info";
    const { backgroundColor, textColor } = messageColors(level);
    void textColor;

    <view
      accessibilityId="user-message"
      key="user-message"
      style={this.state.bannerStyle}
      backgroundColor={backgroundColor}
      borderColor={messageColors(level).textColor}
      borderWidth={1}
    >
      <label style={this.state.labelStyle} value={message} />;
    </view>;
  }
}

const styles = {
  banner: (prominent: boolean) =>
    new Style<View>({
      width: "100%",
      padding: prominent ? 12 : 10,
      marginTop: prominent ? 0 : 4,
      marginBottom: 4,
      borderRadius: 8,
      flexShrink: 0,
    }),
  label: (color: string, prominent: boolean) =>
    new Style<Label>({
      font: prominent ? sansBoldFont(15) : sansFont(14),
      color,
      numberOfLines: 0,
      textAlign: prominent ? "center" : "left",
    }),
};
