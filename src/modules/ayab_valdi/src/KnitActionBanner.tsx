import { Component } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { View, Layout, Label } from "valdi_tsx/src/NativeTemplateElements";
import { sansBoldFont, sansFont } from "constants/src/Typography";
import { FeedbackLevel } from "./Feedback";
import {
  getKnitActionBannerContent,
  formatKnitRowLabel,
} from "./KnitSessionUiLogic";

export interface KnitActionBannerViewModel {
  message: string;
  level?: FeedbackLevel;
  currentRow?: number;
  totalRows?: number;
}

function bannerColors(level: FeedbackLevel): {
  backgroundColor: string;
  borderColor: string;
  titleColor: string;
  subtitleColor: string;
} {
  switch (level) {
    case "error":
    case "blocking":
      return {
        backgroundColor: "#FEE2E2",
        borderColor: "#DC2626",
        titleColor: "#991B1B",
        subtitleColor: "#7F1D1D",
      };
    case "success":
      return {
        backgroundColor: "#D1FAE5",
        borderColor: "#059669",
        titleColor: "#065F46",
        subtitleColor: "#047857",
      };
    default:
      return {
        backgroundColor: "#DBEAFE",
        borderColor: "#2563EB",
        titleColor: "#1E3A8A",
        subtitleColor: "#1D4ED8",
      };
  }
}

export class KnitActionBanner extends Component<KnitActionBannerViewModel> {
  onRender(): void {
    const vm = this.viewModel;
    const level = vm.level ?? "info";
    const content = getKnitActionBannerContent(vm.message, level);
    const colors = bannerColors(content.level);
    const rowLabel = formatKnitRowLabel(vm.currentRow, vm.totalRows);

    <view
      accessibilityId="knit-action-banner"
      key="knit-action-banner"
      style={styles.banner}
      backgroundColor={colors.backgroundColor}
      borderColor={colors.borderColor}
      borderWidth={2}
    >
      <layout style={styles.headerRow}>
        <label style={styles.title(colors.titleColor)} value={content.title} />
        {rowLabel ? (
          <label
            accessibilityId="knit-action-row-counter"
            key="knit-action-row-counter"
            style={styles.rowCounter(colors.titleColor)}
            value={rowLabel}
          />
        ) : undefined}
      </layout>
      {content.subtitle ? (
        <label
          style={styles.subtitle(colors.subtitleColor)}
          value={content.subtitle}
        />
      ) : undefined}
    </view>;
  }
}

const styles = {
  banner: new Style<View>({
    width: "100%",
    padding: 14,
    marginBottom: 10,
    borderRadius: 10,
    flexShrink: 0,
  }),
  headerRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  }),
  title: (color: string) =>
    new Style<Label>({
      font: sansBoldFont(20),
      color,
      flexGrow: 1,
      flexShrink: 1,
      numberOfLines: 0,
    }),
  rowCounter: (color: string) =>
    new Style<Label>({
      font: sansBoldFont(22),
      color,
      flexShrink: 0,
      marginLeft: 12,
      textAlign: "right",
    }),
  subtitle: (color: string) =>
    new Style<Label>({
      font: sansFont(15),
      color,
      marginTop: 6,
      numberOfLines: 0,
    }),
};
