import { StatefulComponent } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { Label, Layout, View } from "valdi_tsx/src/NativeTemplateElements";
import { sansBoldFont, sansFont } from "./Typography";
import { TEXT_MUTED, TEXT_PRIMARY } from "./UiTheme";

export interface HelpHintViewModel {
  /** Help body shown after tapping ? */
  text: string;
  hintId: string;
  /** When set, renders a section heading beside the ? control. */
  title?: string;
}

interface HelpHintState {
  expanded: boolean;
}

/** Tap ? to expand/collapse help text (works on touch and web). */
export class HelpHint extends StatefulComponent<HelpHintViewModel, HelpHintState> {
  state: HelpHintState = { expanded: false };

  private toggle = (): void => {
    this.setState({ expanded: !this.state.expanded });
  };

  onRender(): void {
    const { text, hintId, title } = this.viewModel;
    const buttonId = `${hintId}-button`;

    <layout style={styles.root}>
      <layout style={title != null ? styles.titleRow : styles.iconRow}>
        {title != null ? (
          <label style={styles.sectionTitle} value={title} />
        ) : (
          <layout />
        )}
        <view
          accessibilityId={buttonId}
          key={buttonId}
          style={styles.button}
          backgroundColor={this.state.expanded ? "#E8EEF9" : "#F3F1EE"}
          borderColor={this.state.expanded ? "#2563EB" : "#D6D0C8"}
          borderWidth={1}
          onTap={this.toggle}
          touchAreaExtension={8}
        >
          <label style={styles.buttonLabel} value="?" />
        </view>
      </layout>
      {this.state.expanded ? (
        <label
          accessibilityId={`${hintId}-text`}
          key={`${hintId}-text`}
          style={styles.body}
          value={text}
          numberOfLines={0}
        />
      ) : (
        <layout />
      )}
    </layout>;
  }
}

const HELP_HINT_BUTTON_SIZE = 20;

const styles = {
  root: new Style<Layout>({
    width: "100%",
    flexDirection: "column",
    marginTop: 8,
    marginBottom: 4,
  }),
  titleRow: new Style<Layout>({
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 2,
  }),
  iconRow: new Style<Layout>({
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
  }),
  sectionTitle: new Style<Label>({
    flexShrink: 1,
    font: sansBoldFont(14),
    color: TEXT_PRIMARY,
  }),
  button: new Style<View>({
    width: HELP_HINT_BUTTON_SIZE,
    height: HELP_HINT_BUTTON_SIZE,
    borderRadius: HELP_HINT_BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginLeft: 4,
  }),
  buttonLabel: new Style<Label>({
    font: sansBoldFont(12),
    color: TEXT_MUTED,
    textAlign: "center",
  }),
  body: new Style<Label>({
    font: sansFont(13),
    color: TEXT_MUTED,
    marginTop: 4,
    marginBottom: 2,
    numberOfLines: 0,
  }),
};

export const helpHintBodyStyle = styles.body;
export const helpHintButtonStyle = styles.button;
export const helpHintButtonLabelStyle = styles.buttonLabel;
