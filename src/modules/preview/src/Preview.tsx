import { StatefulComponent } from "valdi_core/src/Component";
import { Label, View, Layout } from "valdi_tsx/src/NativeTemplateElements";
import { sansFont, BUTTON_FONT_SMALL } from "constants/src/Typography";
import {
  NEEDLE_BAR_GREEN,
  NEEDLE_BAR_ORANGE,
} from "constants/src/NeedleColors";
import { TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from "constants/src/UiTheme";
import { Style } from "valdi_core/src/Style";
import { Device } from "valdi_core/src/Device";
import { getBits } from "process_image/src/ProcessImageNative";
// @ts-ignore - getBitsAsync may be available in web
import { getBitsAsync } from "process_image/src/ProcessImageNative";
import {
  isSupportedPatternFileName,
  loadPatternFromSelection,
} from "process_image/src/PatternFileLoader";
import {
  FilePicker,
  FilePickerOnSelectEvent,
} from "widgets/src/components/pickers/FilePicker";
import {
  CoreButton,
  CoreButtonColoring,
  CoreButtonSizing,
} from "widgets/src/components/button/CoreButton";
import { ZoomablePreviewViewport } from "./ZoomablePreviewViewport";
import { getPreviewSideLabel } from "./KnitSidePreviewLogic";
import {
  SamplePattern,
  resolveSamplePatternSource,
} from "./SamplePatterns";
import { SamplePatternsModal } from "./SamplePatternsModal";
import {
  SIDEBAR_CARD_BACKGROUND,
  SIDEBAR_CARD_BORDER,
  previewPanelCardInnerStyle,
  previewPanelCardStyle,
} from "constants/src/SidebarStyles";

// @ts-ignore - module is provided by Valdi runtime
declare const module: { path: string; exports: unknown };

export interface PatternLoadInfo {
  fileName: string;
  userSelected: boolean;
}

export interface PreviewViewModel {
  title: string;
  onBitsLoaded?: (
    bits: Uint8Array[][],
    width: number,
    height: number,
    info?: PatternLoadInfo,
  ) => void;
  /** When set, show machine scene (bed, needle range, progress) */
  machineWidth?: number;
  startNeedle?: number;
  stopNeedle?: number;
  /** 0 = CENTER, 1 = LEFT, 2 = RIGHT */
  alignment?: number;
  autoMirror?: boolean;
  currentRow?: number;
  totalRows?: number;
  isKnitting?: boolean;
  aspectRatio?: number;
  /** Bumped when parent updates image bits outside this component. */
  imageBitsRevision?: number;
  syncedBits?: Uint8Array[][];
  /** Highlights the pattern panel during first-run tour. */
  tourHighlighted?: boolean;
}

interface State {
  selectedImageName?: string;
  bits?: Uint8Array[][];
  width?: number;
  height?: number;
  samplePickerOpen?: boolean;
}

export class Preview extends StatefulComponent<PreviewViewModel, State> {
  state: State = {};

  private loadGeneration = 0;

  onDestroy(): void {
    this.loadGeneration++;
  }

  onViewModelUpdate(previous?: PreviewViewModel): void {
    const revision = this.viewModel.imageBitsRevision;
    if (
      revision == null ||
      revision === previous?.imageBitsRevision ||
      this.viewModel.syncedBits == null
    ) {
      return;
    }
    const bits = this.viewModel.syncedBits;
    const height = bits.length;
    const width = height > 0 ? bits[0]!.length : 0;
    this.setState({ bits, width, height });
  }

  private loadSamplePattern(sample: SamplePattern): void {
    this.loadImageSource(
      resolveSamplePatternSource(sample),
      sample.fileName,
      true,
    );
  }

  private handleBrowseSamples = (): void => {
    this.setState({ samplePickerOpen: true });
  };

  private handleCloseSamplePicker = (): void => {
    this.setState({ samplePickerOpen: false });
  };

  private handleSampleSelected = (sample: SamplePattern): void => {
    this.setState({ samplePickerOpen: false });
    this.loadSamplePattern(sample);
  };

  private applyBits(
    bits: Uint8Array[][],
    fileName: string,
    userSelected: boolean,
  ): void {
    if (this.isDestroyed()) return;

    const height = bits.length;
    const width = bits.length > 0 ? bits[0].length : 0;
    this.setState({
      bits,
      selectedImageName: fileName,
      width,
      height,
    });
    this.viewModel.onBitsLoaded?.(bits, width, height, {
      fileName,
      userSelected,
    });
  }

  private loadImageSource(
    source: string,
    fileName: string,
    userSelected: boolean,
  ): void {
    const generation = this.loadGeneration;

    if (Device.isWeb() && typeof getBitsAsync !== "undefined" && getBitsAsync) {
      getBitsAsync(source)
        .then((bits: Uint8Array[][]) => {
          if (this.isDestroyed() || generation !== this.loadGeneration) {
            return;
          }
          this.applyBits(bits, fileName, userSelected);
        })
        .catch((error: unknown) => {
          console.error("Failed to load image:", error);
        });
      return;
    }

    try {
      this.applyBits(getBits(source), fileName, userSelected);
    } catch (error) {
      console.error("Failed to load image:", error);
    }
  }

  private handleFileSelect = (event: FilePickerOnSelectEvent): void => {
    const fileName = event.fileName ?? "Selected file";
    console.log("Selected file:", fileName);

    if (isSupportedPatternFileName(fileName)) {
      if (!event.dataUrl && !event.path) {
        console.log("File picker cancelled or no path returned");
        return;
      }
      this.loadPatternFile(event, fileName);
      return;
    }

    const loadPath = event.dataUrl ?? event.path;
    if (!loadPath) {
      console.log("File picker cancelled or no path returned");
      return;
    }

    if (typeof getBitsAsync !== "undefined" && getBitsAsync && event.dataUrl) {
      const generation = this.loadGeneration;
      getBitsAsync(event.dataUrl)
        .then((bits: Uint8Array[][]) => {
          if (this.isDestroyed() || generation !== this.loadGeneration) {
            return;
          }
          this.applyBits(bits, fileName, true);
        })
        .catch((error: unknown) => {
          console.error("Failed to load image:", error);
        });
      return;
    }

    try {
      this.applyBits(getBits(loadPath), fileName, true);
    } catch (error) {
      console.error("Failed to load image:", error);
    }
  };

  private loadPatternFile = (
    event: FilePickerOnSelectEvent,
    fileName: string,
  ): void => {
    try {
      const { bits } = loadPatternFromSelection({
        dataUrl: event.dataUrl,
        path: event.path,
        fileName,
      });
      this.applyBits(bits, fileName, true);
    } catch (error) {
      console.error("Failed to load pattern file:", error);
    }
  };

  onRender(): void {
    const highlighted = this.viewModel.tourHighlighted === true;
    const hasPattern =
      this.state.bits != null &&
      this.state.width != null &&
      this.state.height != null;

    <view style={styles.root}>
      <view
        accessibilityId="checklist-target-pattern"
        style={styles.card}
        backgroundColor={SIDEBAR_CARD_BACKGROUND}
        borderColor={highlighted ? "#2563EB" : SIDEBAR_CARD_BORDER}
        borderWidth={highlighted ? 2 : 1}
      >
      <layout style={previewPanelCardInnerStyle}>
        <layout style={styles.content}>
          <layout style={styles.headerColumn}>
            <layout style={styles.titleColumn}>
              <label style={styles.title} value={this.viewModel.title} />
              {hasPattern ? (
                <layout style={styles.metaRow}>
                  <label
                    style={styles.metaLabel}
                    value={`${this.state.width}×${this.state.height} stitches`}
                  />
                  <view
                    accessibilityId="preview-side-indicator"
                    key="preview-side-indicator"
                    style={styles.sideIndicatorWrap(
                      this.viewModel.autoMirror === true,
                    )}
                  >
                    <label
                      style={styles.sideIndicatorLabel(
                        this.viewModel.autoMirror === true,
                      )}
                      value={getPreviewSideLabel(this.viewModel.autoMirror === true)}
                    />
                  </view>
                </layout>
              ) : undefined}
            </layout>
            <layout style={styles.filePickerRow}>
              <label style={styles.openPatternLabel} value="Open pattern" />
              <layout style={styles.filePickerWrap}>
                <FilePicker
                  accept="image/*,.pat,.stp,.cut,.pal"
                  readContent={Device.isWeb()}
                  onSelect={this.handleFileSelect}
                />
              </layout>
              <CoreButton
                accessibilityId="preview-browse-samples"
                text="Samples"
                onTap={this.handleBrowseSamples}
                coloring={CoreButtonColoring.SECONDARY}
                sizing={CoreButtonSizing.SMALL}
                font={BUTTON_FONT_SMALL}
              />
            </layout>
            {this.state.selectedImageName ? (
              <view accessibilityId="preview-image-name">
                <label
                  style={styles.hiddenProbe}
                  value={this.state.selectedImageName}
                />
              </view>
            ) : undefined}
          </layout>

          {hasPattern ? (
            <view accessibilityId="preview-dimensions">
              <label
                style={styles.hiddenProbe}
                value={`${this.state.width}x${this.state.height}`}
              />
            </view>
          ) : undefined}

          {!hasPattern ? (
            <layout style={styles.emptyStateBlock}>
              <view accessibilityId="preview-empty-state">
                <label
                  style={styles.emptyStateMessage}
                  value="Open a pattern to preview stitches and knit."
                />
              </view>
            </layout>
          ) : (
            <layout style={styles.previewBlock}>
              <layout style={styles.previewViewportWrapper}>
                <ZoomablePreviewViewport
                  bits={this.state.bits!}
                  imageWidth={this.state.width!}
                  imageHeight={this.state.height!}
                  machineWidth={this.viewModel.machineWidth}
                  startNeedle={this.viewModel.startNeedle}
                  stopNeedle={this.viewModel.stopNeedle}
                  alignment={this.viewModel.alignment ?? 0}
                  autoMirror={this.viewModel.autoMirror}
                  currentRow={this.viewModel.currentRow}
                  totalRows={this.viewModel.totalRows}
                  isKnitting={this.viewModel.isKnitting}
                  aspectRatio={this.viewModel.aspectRatio}
                  contentKey={`${this.state.width}x${this.state.height}-${this.state.bits!.length}-${this.viewModel.autoMirror ? "m" : "n"}-${this.viewModel.currentRow ?? -1}-${this.viewModel.aspectRatio ?? 0}`}
                />
              </layout>
              <layout style={styles.legendRow}>
                <view
                  style={styles.legendSwatch}
                  backgroundColor={NEEDLE_BAR_ORANGE}
                />
                <label
                  accessibilityId="preview-legend-left"
                  style={styles.legendLabel}
                  value="Left side of bed"
                />
                <view
                  style={styles.legendSwatchGreen}
                  backgroundColor={NEEDLE_BAR_GREEN}
                />
                <label
                  accessibilityId="preview-legend-right"
                  style={styles.legendLabel}
                  value="Right side of bed"
                />
              </layout>
            </layout>
          )}
        </layout>
      </layout>
      </view>
      {this.state.samplePickerOpen ? (
        <SamplePatternsModal
          onClose={this.handleCloseSamplePicker}
          onSelect={this.handleSampleSelected}
        />
      ) : undefined}
    </view>;
  }
}

const styles = {
  root: new Style<View>({
    width: "100%",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    position: "relative",
    flexDirection: "column",
  }),
  card: previewPanelCardStyle,
  content: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    alignItems: "stretch",
    flexDirection: "column",
  }),
  headerColumn: new Style<Layout>({
    width: "100%",
    flexDirection: "column",
    alignItems: "stretch",
    flexShrink: 0,
    marginBottom: 6,
  }),
  titleColumn: new Style<Layout>({
    flexDirection: "column",
    flexShrink: 0,
  }),
  openPatternLabel: new Style<Label>({
    font: sansFont(13),
    color: TEXT_SECONDARY,
    marginRight: 8,
    flexShrink: 0,
    marginTop: 2,
  }),
  filePickerRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    marginTop: 8,
  }),
  filePickerWrap: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: "row",
    marginRight: 8,
  }),
  emptyStateBlock: new Style<Layout>({
    width: "100%",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 120,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    paddingLeft: 16,
    paddingRight: 16,
  }),
  emptyStateMessage: new Style<Label>({
    font: sansFont(15),
    color: TEXT_MUTED,
    marginBottom: 12,
  }),
  previewBlock: new Style<Layout>({
    width: "100%",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    flexDirection: "column",
  }),
  previewViewportWrapper: new Style<Layout>({
    width: "100%",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    marginTop: 8,
    flexDirection: "column",
  }),
  title: new Style<Label>({
    font: sansFont(24),
    color: TEXT_PRIMARY,
    flexShrink: 0,
  }),
  metaRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 2,
    flexShrink: 0,
  }),
  metaLabel: new Style<Label>({
    font: sansFont(14),
    color: TEXT_SECONDARY,
    marginRight: 10,
    flexShrink: 0,
  }),
  sideIndicatorWrap: (knitSide: boolean) =>
    new Style<View>({
      borderRadius: 6,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 3,
      paddingBottom: 3,
      flexShrink: 0,
      backgroundColor: knitSide ? "#D1FAE5" : "#DBEAFE",
    }),
  sideIndicatorLabel: (knitSide: boolean) =>
    new Style<Label>({
      font: sansFont(12),
      color: knitSide ? "#065F46" : "#1E40AF",
    }),
  legendRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    flexShrink: 0,
  }),
  legendSwatch: new Style<View>({
    width: 14,
    height: 14,
    borderRadius: 2,
    marginRight: 6,
    flexShrink: 0,
  }),
  legendSwatchGreen: new Style<View>({
    width: 14,
    height: 14,
    borderRadius: 2,
    marginLeft: 16,
    marginRight: 6,
    flexShrink: 0,
  }),
  legendLabel: new Style<Label>({
    font: sansFont(14),
    color: TEXT_SECONDARY,
  }),
  hiddenProbe: new Style<Label>({
    font: sansFont(1),
    color: "#FFFFFF",
    height: 1,
    width: 1,
  }),
};
