import { Style } from "valdi_core/src/Style";
import { View, Layout, Label } from "valdi_tsx/src/NativeTemplateElements";
import { sansBoldFont, sansFont } from "constants/src/Typography";
import {
  SIDEBAR_CARD_BACKGROUND,
  SIDEBAR_CARD_BORDER,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "constants/src/UiTheme";

export { SIDEBAR_CARD_BACKGROUND, SIDEBAR_CARD_BORDER };

/** Shared sidebar card chrome used across pickers and settings panels. */
export const sidebarCardStyle = new Style<View>({
  width: "100%",
  marginBottom: 6,
  borderRadius: 10,
});

export const sidebarCardInnerStyle = new Style<Layout>({
  width: "100%",
  padding: 10,
});

/** Preview panel card — fills the column above progress and shrinks with it. */
export const previewPanelCardStyle = new Style<View>({
  width: "100%",
  borderRadius: 10,
  flexGrow: 1,
  flexShrink: 1,
  minHeight: 0,
  flexDirection: "column",
});

export const previewPanelCardInnerStyle = new Style<Layout>({
  width: "100%",
  padding: 8,
  flexGrow: 1,
  flexShrink: 1,
  minHeight: 0,
  flexDirection: "column",
});

export const sidebarSectionLabelStyle = new Style<Label>({
  font: sansBoldFont(16),
  color: TEXT_PRIMARY,
  marginBottom: 6,
});

export const sidebarHintStyle = new Style<Label>({
  font: sansFont(13),
  color: TEXT_MUTED,
  marginTop: 2,
  marginBottom: 4,
});

/** Standard form row height for sidebar controls. */
export const SIDEBAR_FIELD_HEIGHT = 40;
