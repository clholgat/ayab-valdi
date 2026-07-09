import { Component } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { View, Layout, Label } from "valdi_tsx/src/NativeTemplateElements";
import { sansBoldFont, sansFont, BUTTON_FONT_TINY } from "constants/src/Typography";
import { APP_NAME, APP_VERSION, APP_REPO_URL, APP_URL } from "constants/src/AppInfo";
import {
  SIDEBAR_CARD_BACKGROUND,
  SIDEBAR_CARD_BORDER,
  sidebarCardInnerStyle,
  sidebarCardStyle,
} from "constants/src/SidebarStyles";
import {
  CoreButton,
  CoreButtonColoring,
  CoreButtonSizing,
} from "widgets/src/components/button/CoreButton";

export interface AboutScreenViewModel {
  onClose: () => void;
  closeLabel?: string;
  closeAccessibilityId?: string;
}

export class AboutScreen extends Component<AboutScreenViewModel> {
  onRender(): void {
    const closeLabel = this.viewModel.closeLabel ?? "Close";
    const closeId = this.viewModel.closeAccessibilityId ?? "about-close";
    <view
      accessibilityId="about-panel"
      key="about-panel"
      style={sidebarCardStyle}
      backgroundColor={SIDEBAR_CARD_BACKGROUND}
      borderColor={SIDEBAR_CARD_BORDER}
      borderWidth={1}
    >
      <layout style={sidebarCardInnerStyle}>
        <label style={styles.title} value="About" />
        <label accessibilityId="about-app-name" key="about-app-name" style={styles.name} value={APP_NAME} />
        <label
          accessibilityId="about-version"
          key="about-version"
          style={styles.detail}
          value={`Version ${APP_VERSION}`}
        />
        <label
          style={styles.detail}
          value="Open source knitting machine control"
        />
        <label
          accessibilityId="about-experimental"
          key="about-experimental"
          style={styles.detail}
          value="Experimental port — not an official AYAB release."
        />
        <label style={styles.linkLabel} value="Source repository" />
        <label
          accessibilityId="about-repo-link"
          key="about-repo-link"
          style={styles.link}
          value={APP_REPO_URL}
        />
        <label style={styles.linkLabel} value="Upstream AYAB" />
        <label style={styles.link} value={APP_URL} />
        <layout style={styles.buttonRow}>
          <CoreButton
            accessibilityId={closeId}
            key={closeId}
            text={closeLabel}
            onTap={this.viewModel.onClose}
            coloring={CoreButtonColoring.PRIMARY}
            sizing={CoreButtonSizing.TINY}
            font={BUTTON_FONT_TINY}
            width="100%"
          />
        </layout>
      </layout>
    </view>;
  }
}

const styles = {
  title: new Style<Label>({
    font: sansBoldFont(16),
    color: "#111827",
    marginBottom: 8,
  }),
  name: new Style<Label>({
    font: sansBoldFont(15),
    color: "#111827",
    marginBottom: 4,
  }),
  detail: new Style<Label>({
    font: sansFont(13),
    color: "#374151",
    marginBottom: 4,
  }),
  linkLabel: new Style<Label>({
    font: sansFont(12),
    color: "#6B7280",
    marginTop: 8,
    marginBottom: 2,
  }),
  link: new Style<Label>({
    font: sansFont(12),
    color: "#2563EB",
    marginBottom: 12,
    numberOfLines: 0,
  }),
  buttonRow: new Style<Layout>({
    width: "100%",
    marginTop: 4,
  }),
};
