import { StatefulComponent } from "valdi_core/src/Component";
import { Label, View, Layout } from "valdi_tsx/src/NativeTemplateElements";
import {
  sansBoldFont,
  sansFont,
  BUTTON_FONT_SMALL,
} from "constants/src/Typography";
import {
  NEEDLE_BAR_GREEN,
  NEEDLE_BAR_ORANGE,
} from "constants/src/NeedleColors";
import { TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from "constants/src/UiTheme";
import { MachineCapabilities } from "machine_job/src/MachineCapabilities";
import {
  InspectMachineJobResult,
  inspectMachineJob,
} from "machine_job/src/InspectMachineJob";
import { decodeMachineJobText } from "machine_job/src/MachineJobText";
import { MachineJob } from "machine_job/src/MachineJobTypes";
import { machineJobIdentity } from "machine_job/src/MachineJobChecksum";
import {
  ExecutionCheckpoint,
  MachineJobIdentity,
} from "knit_session/src/ExecutionCheckpoint";
import { CheckpointRepository } from "knit_session/src/CheckpointRepository";
import { createDefaultCheckpointStore } from "knit_session/src/PersistentCheckpointStore";
import {
  finishCheckpoint,
  rewindToPass,
} from "knit_session/src/CheckpointTransitions";
import { Style } from "valdi_core/src/Style";
import { Device } from "valdi_core/src/Device";
import { getBits } from "process_image/src/ProcessImageNative";
import {
  loadModuleResourceBits,
  moduleResourceBytes,
  moduleResourceDataUrl,
  parseModuleResource,
} from "./ModuleResourceBits";
// @ts-ignore - getBitsAsync may be available in web
import { getBitsAsync } from "process_image/src/ProcessImageNative";
// @ts-ignore - readFileBytes is native-only (desktop/Android); undefined on web
import { readFileBytes } from "process_image/src/ProcessImageNative";
import {
  isSupportedPatternFileName,
  loadPatternFromSelection,
} from "process_image/src/PatternFileLoader";
import { dataUrlToBytes } from "process_image/src/PatternImportBinary";
import { readPngComment } from "process_image/src/PngMetadata";
import { parseAyabMemos } from "process_image/src/PatternMemo";
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
import { computeZoomContentKey } from "./PreviewViewportTypes";
import { getPreviewSideLabel } from "./KnitSidePreviewLogic";
import { SamplePattern, resolveSamplePatternSource } from "./SamplePatterns";
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
  /** Per-row memo digits ("0" = none) recovered from the PNG Comment tag, if any. */
  memos?: string[];
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
  /** Transformed AYAB memo codes aligned with syncedBits. */
  rowMemos?: string[];
  /** Highlights the pattern panel during first-run tour. */
  tourHighlighted?: boolean;
  /** Selected hardware/settings facts used only for read-only job preflight. */
  machineJobCapabilities?: MachineCapabilities;
  onSimulateMachineJob?: (
    job: MachineJob,
    identity: MachineJobIdentity,
    profileId: string,
    resumePassIndex?: number,
  ) => void;
  onKnitMachineJob?: (
    job: MachineJob,
    identity: MachineJobIdentity,
    profileId: string,
    resumePassIndex?: number,
  ) => void;
  /** Portable job supplied by an embedding app instead of the file picker. */
  initialMachineJobJson?: string;
  initialMachineJobFileName?: string;
  initialMachineJobRevision?: number;
}

interface State {
  selectedImageName?: string;
  bits?: Uint8Array[][];
  width?: number;
  height?: number;
  memos?: string[];
  samplePickerOpen?: boolean;
  machineJobFileName?: string;
  machineJobInspection?: InspectMachineJobResult;
  machineJobReadError?: string;
  machineJobIdentity?: MachineJobIdentity;
  machineJobCheckpoint?: ExecutionCheckpoint;
  machineJobRecoveryLoading?: boolean;
  machineJobRecoveryError?: string;
}

export class Preview extends StatefulComponent<PreviewViewModel, State> {
  state: State = {};

  private loadGeneration = 0;
  private machineJobLoadGeneration = 0;
  private readonly checkpointRepository = new CheckpointRepository(
    createDefaultCheckpointStore(),
    "active",
  );

  onCreate(): void {
    this.loadInitialMachineJob();
  }

  onDestroy(): void {
    this.loadGeneration++;
    this.machineJobLoadGeneration++;
  }

  onViewModelUpdate(previous?: PreviewViewModel): void {
    if (
      this.viewModel.initialMachineJobRevision !== previous?.initialMachineJobRevision
    ) {
      this.loadInitialMachineJob();
    }
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

  private loadInitialMachineJob(): void {
    const json = this.viewModel.initialMachineJobJson;
    if (json === undefined) return;
    this.handleMachineJobSelect({
      text: json,
      fileName: this.viewModel.initialMachineJobFileName ?? "Machine job",
    });
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
    memos: string[] = [],
  ): void {
    if (this.isDestroyed()) return;

    const height = bits.length;
    const width = bits.length > 0 ? bits[0].length : 0;
    this.setState({
      bits,
      selectedImageName: fileName,
      width,
      height,
      memos,
    });
    this.viewModel.onBitsLoaded?.(bits, width, height, {
      fileName,
      userSelected,
      memos,
    });
  }

  /**
   * PNG Comment-tag row memos (ayab-desktop#779) live only in the raw file
   * bytes -- every pixel decoder we use (canvas, native bitmap decoders)
   * strips metadata. Reads the same source the picker already gave us
   * (dataUrl on web, filesystem path on desktop/Android) a second time, as
   * raw bytes, purely for its Comment tag. Failure here must never block
   * the image from loading, so this always resolves rather than throwing.
   */
  private extractMemos(event: FilePickerOnSelectEvent): string[] {
    try {
      if (event.dataUrl) {
        return parseAyabMemos(readPngComment(dataUrlToBytes(event.dataUrl)));
      }
      if (event.path && typeof readFileBytes === "function") {
        return parseAyabMemos(readPngComment(readFileBytes(event.path)));
      }
    } catch (error) {
      console.error("Failed to read pattern memo metadata:", error);
    }
    return [];
  }

  private loadImageSource(
    source: string,
    fileName: string,
    userSelected: boolean,
  ): void {
    // Give every selection its own generation so a previous async decode can
    // never win a race and replace a newer sample.
    const generation = ++this.loadGeneration;

    // Module-resource samples ("preview:stem") need a platform-specific
    // decode path -- neither of the two below understands that scheme, and
    // the two "obvious" fixes both silently produce wrong pixels rather
    // than erroring, which cost real debugging time to track down:
    //   - getBitsAsync would hand "preview:stem" to the browser as a
    //     literal image URL (fails outright, at least visibly).
    //   - loadModuleResourceBits (decodeBitmap) is not usable on web at
    //     all: confirmed empirically that it silently decodes correct PNG
    //     bytes into a bogus 1x1 image there (see ModuleResourceBits.ts).
    // On web the only decode path verified to actually work is
    // getBitsAsync fed a real `data:` URL (canvas decode); on native,
    // loadModuleResourceBits's pixel-exact path is correct and preferred
    // (Android R drawables are density-resampled and unusable otherwise).
    if (parseModuleResource(source)) {
      const bytes = moduleResourceBytes(source);
      const memos = bytes
        ? parseAyabMemos(readPngComment(bytes))
        : [];
      const dataUrl = Device.isWeb() ? moduleResourceDataUrl(source) : undefined;
      if (dataUrl && typeof getBitsAsync !== "undefined" && getBitsAsync) {
        getBitsAsync(dataUrl)
          .then((bits: Uint8Array[][]) => {
            if (this.isDestroyed() || generation !== this.loadGeneration) {
              return;
            }
            this.applyBits(bits, fileName, userSelected, memos);
          })
          .catch((error: unknown) => {
            console.error("Failed to load sample:", error);
          });
        return;
      }
      loadModuleResourceBits(source)
        .then(bits => {
          if (this.isDestroyed() || generation !== this.loadGeneration) {
            return;
          }
          if (bits) {
            this.applyBits(bits, fileName, userSelected, memos);
            return;
          }
          console.error("Failed to load sample: no bits for " + source);
        })
        .catch((error: unknown) => {
          console.error("Failed to load sample:", error);
        });
      return;
    }

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

    const memos = this.extractMemos(event);

    if (typeof getBitsAsync !== "undefined" && getBitsAsync && event.dataUrl) {
      const generation = this.loadGeneration;
      getBitsAsync(event.dataUrl)
        .then((bits: Uint8Array[][]) => {
          if (this.isDestroyed() || generation !== this.loadGeneration) {
            return;
          }
          this.applyBits(bits, fileName, true, memos);
        })
        .catch((error: unknown) => {
          console.error("Failed to load image:", error);
        });
      return;
    }

    try {
      this.applyBits(getBits(loadPath), fileName, true, memos);
    } catch (error) {
      console.error("Failed to load image:", error);
    }
  };

  private handleMachineJobSelect = (event: FilePickerOnSelectEvent): void => {
    const generation = ++this.machineJobLoadGeneration;
    const fileName = event.fileName ?? "Machine job";
    const capabilities = this.viewModel.machineJobCapabilities;
    if (event.text === undefined && !event.dataUrl && !event.path) return;
    if (!capabilities) {
      this.setState({
        machineJobFileName: fileName,
        machineJobInspection: undefined,
        machineJobIdentity: undefined,
        machineJobCheckpoint: undefined,
        machineJobRecoveryLoading: false,
        machineJobRecoveryError: undefined,
        machineJobReadError: "Select a machine configuration before inspecting this job.",
      });
      return;
    }
    try {
      let json: string;
      if (event.text !== undefined) {
        json = event.text;
      } else {
        let bytes: Uint8Array;
        if (event.dataUrl) {
          bytes = dataUrlToBytes(event.dataUrl);
        } else if (event.path && typeof readFileBytes === "function") {
          bytes = readFileBytes(event.path);
        } else {
          throw new Error("Machine job contents are unavailable from the file picker.");
        }
        json = decodeMachineJobText(bytes);
      }
      if (json.length === 0) throw new Error("Machine job file is empty.");
      const inspection = inspectMachineJob(json, capabilities);
      this.setState({
        machineJobFileName: fileName,
        machineJobInspection: inspection,
        machineJobIdentity: inspection.ok
          ? machineJobIdentity(inspection.job.jobId, json)
          : undefined,
        machineJobCheckpoint: undefined,
        machineJobRecoveryLoading: inspection.ok,
        machineJobRecoveryError: undefined,
        machineJobReadError: undefined,
      });
      if (inspection.ok) {
        const identity = machineJobIdentity(inspection.job.jobId, json);
        void this.loadMachineJobRecovery(
          inspection.job,
          identity,
          capabilities.profileId,
          generation,
        );
      }
    } catch (error) {
      this.setState({
        machineJobFileName: fileName,
        machineJobInspection: undefined,
        machineJobIdentity: undefined,
        machineJobCheckpoint: undefined,
        machineJobRecoveryLoading: false,
        machineJobRecoveryError: undefined,
        machineJobReadError:
          error instanceof Error ? error.message : "Could not read machine job.",
      });
    }
  };

  private async loadMachineJobRecovery(
    job: MachineJob,
    identity: MachineJobIdentity,
    profileId: string,
    generation: number,
  ): Promise<void> {
    try {
      const loaded = await this.checkpointRepository.load({
        identity,
        machineProfileId: profileId,
        passIds: job.rows.flatMap((row) => row.passes.map((pass) => pass.passId)),
      });
      if (
        this.isDestroyed() ||
        generation !== this.machineJobLoadGeneration
      ) {
        return;
      }
      this.setState({
        machineJobCheckpoint: loaded.ok ? loaded.checkpoint : undefined,
        machineJobRecoveryLoading: false,
        machineJobRecoveryError: undefined,
      });
    } catch (error) {
      console.error("Failed to inspect machine-job checkpoint:", error);
      if (
        !this.isDestroyed() &&
        generation === this.machineJobLoadGeneration
      ) {
        this.setState({
          machineJobCheckpoint: undefined,
          machineJobRecoveryLoading: false,
          machineJobRecoveryError: "Could not read saved recovery state.",
        });
      }
    }
  }

  private handleSimulateMachineJob = (): void => {
    this.startMachineJobSimulation(undefined);
  };

  private handleKnitMachineJob = (): void => {
    const inspection = this.state.machineJobInspection;
    const capabilities = this.viewModel.machineJobCapabilities;
    if (inspection?.ok && this.state.machineJobIdentity && capabilities && inspection.preflight.compatible) {
      this.viewModel.onKnitMachineJob?.(
        inspection.job,
        this.state.machineJobIdentity,
        capabilities.profileId,
        this.state.machineJobCheckpoint?.nextPassIndex,
      );
    }
  };

  private handleResumeMachineJob = (): void => {
    this.startMachineJobSimulation(
      this.state.machineJobCheckpoint?.nextPassIndex,
    );
  };

  private handleDiscardMachineJob = (): void => {
    void this.updateMachineJobRecovery("discard");
  };

  private handleRewindMachineJob = (): void => {
    void this.updateMachineJobRecovery("rewind");
  };

  private async updateMachineJobRecovery(
    action: "discard" | "rewind",
  ): Promise<void> {
    const checkpoint = this.state.machineJobCheckpoint;
    const inspection = this.state.machineJobInspection;
    if (!checkpoint || !inspection?.ok) return;
    const generation = this.machineJobLoadGeneration;
    this.setState({
      machineJobRecoveryLoading: true,
      machineJobRecoveryError: undefined,
    });
    try {
      let next: ExecutionCheckpoint;
      if (action === "discard") {
        next = finishCheckpoint(
          checkpoint,
          "cancelled",
          new Date().toISOString(),
        );
      } else {
        const target = checkpoint.nextPassIndex - 1;
        if (target < 0) throw new Error("No completed pass is available to rewind.");
        const passes = inspection.job.rows.flatMap((row) => row.passes);
        const targetDirection = passes[target]!.direction;
        const expectedSide =
          targetDirection === "rightToLeft" ? "right" : "left";
        next = rewindToPass(
          checkpoint,
          target,
          target > 0 ? passes[target - 1]!.passId : undefined,
          expectedSide,
          new Date().toISOString(),
        );
      }
      await this.checkpointRepository.save(next);
      if (this.isDestroyed() || generation !== this.machineJobLoadGeneration) {
        return;
      }
      this.setState({
        machineJobCheckpoint: action === "discard" ? undefined : next,
        machineJobRecoveryLoading: false,
      });
    } catch (error) {
      console.error(`Failed to ${action} machine-job recovery:`, error);
      if (!this.isDestroyed() && generation === this.machineJobLoadGeneration) {
        this.setState({
          machineJobRecoveryLoading: false,
          machineJobRecoveryError: `Could not ${action} saved progress.`,
        });
      }
    }
  }

  private startMachineJobSimulation(resumePassIndex: number | undefined): void {
    const inspection = this.state.machineJobInspection;
    const capabilities = this.viewModel.machineJobCapabilities;
    if (
      inspection?.ok &&
      this.state.machineJobIdentity &&
      capabilities &&
      inspection.preflight.compatible &&
      this.viewModel.isKnitting !== true
    ) {
      this.viewModel.onSimulateMachineJob?.(
        inspection.job,
        this.state.machineJobIdentity,
        capabilities.profileId,
        resumePassIndex,
      );
    }
  }

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
            {this.renderMachineJobInspection()}
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
                  rowMemos={this.viewModel.rowMemos ?? this.state.memos}
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
                  contentKey={computeZoomContentKey(
                    this.state.width!,
                    this.state.height!,
                    this.state.bits!.length,
                    this.viewModel.autoMirror ?? false,
                    this.viewModel.aspectRatio ?? 0,
                    this.state.selectedImageName,
                  )}
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

  private renderMachineJobInspection(): void {
    const inspection = this.state.machineJobInspection;
    const readError = this.state.machineJobReadError;
    if (!inspection && !readError) return;

    if (readError) {
      <view accessibilityId="machine-job-inspection" style={styles.jobCard}>
        <label style={styles.jobTitle} value={this.state.machineJobFileName ?? "Machine job"} />
        <label style={styles.jobError} value={readError} />
      </view>;
      return;
    }
    if (!inspection!.ok) {
      const first = inspection!.issues[0];
      <view accessibilityId="machine-job-inspection" style={styles.jobCard}>
        <label style={styles.jobTitle} value={this.state.machineJobFileName ?? "Machine job"} />
        <label
          style={styles.jobError}
          value={`Invalid job: ${first?.path ?? "$"} ${first?.message ?? "failed validation"}`}
        />
      </view>;
      return;
    }
    const result = inspection!;
    const summary = result.preflight.summary;
    const status = result.preflight.compatible
      ? "Compatible with selected machine"
      : `${result.preflight.issues.length} compatibility issue${result.preflight.issues.length === 1 ? "" : "s"}`;
    const checkpoint = this.state.machineJobCheckpoint;
    <view accessibilityId="machine-job-inspection" style={styles.jobCard}>
      <label style={styles.jobTitle} value={result.job.title} />
      <label
        accessibilityId="machine-job-summary"
        style={styles.jobMeta}
        value={`${summary.logicalRows} rows · ${summary.passes} passes · ${summary.yarns} yarns · needles ${summary.minNeedle}–${summary.maxNeedle}`}
      />
      <label
        accessibilityId="machine-job-compatibility"
        style={result.preflight.compatible ? styles.jobCompatible : styles.jobError}
        value={status}
      />
      {!result.preflight.compatible ? (
        <label
          style={styles.jobMeta}
          value={result.preflight.issues[0]!.message}
        />
      ) : undefined}
      {result.preflight.compatible && this.viewModel.onSimulateMachineJob ? (
        <layout style={styles.jobAction}>
          {checkpoint ? (
            <CoreButton
              accessibilityId="machine-job-resume"
              text={`Resume at pass ${checkpoint.nextPassIndex + 1}`}
              onTap={this.handleResumeMachineJob}
              disabled={
                this.viewModel.isKnitting === true ||
                this.state.machineJobRecoveryLoading === true
              }
              coloring={CoreButtonColoring.PRIMARY}
              sizing={CoreButtonSizing.SMALL}
              font={BUTTON_FONT_SMALL}
            />
          ) : undefined}
          {checkpoint && checkpoint.nextPassIndex > 0 ? (
            <CoreButton
              accessibilityId="machine-job-rewind"
              text="Rewind one pass"
              onTap={this.handleRewindMachineJob}
              disabled={
                this.viewModel.isKnitting === true ||
                this.state.machineJobRecoveryLoading === true
              }
              coloring={CoreButtonColoring.SECONDARY}
              sizing={CoreButtonSizing.SMALL}
              font={BUTTON_FONT_SMALL}
            />
          ) : undefined}
          {checkpoint ? (
            <CoreButton
              accessibilityId="machine-job-discard"
              text="Discard progress"
              onTap={this.handleDiscardMachineJob}
              disabled={
                this.viewModel.isKnitting === true ||
                this.state.machineJobRecoveryLoading === true
              }
              coloring={CoreButtonColoring.TERTIARY}
              sizing={CoreButtonSizing.SMALL}
              font={BUTTON_FONT_SMALL}
            />
          ) : undefined}
          <CoreButton
            accessibilityId="machine-job-simulate"
            text={
              this.viewModel.isKnitting
                ? "Simulation running"
                : checkpoint
                  ? "Restart simulation"
                  : "Simulate job"
            }
            onTap={this.handleSimulateMachineJob}
            disabled={this.viewModel.isKnitting === true}
            coloring={CoreButtonColoring.SECONDARY}
            sizing={CoreButtonSizing.SMALL}
            font={BUTTON_FONT_SMALL}
          />
          {this.viewModel.onKnitMachineJob ? (
            <CoreButton
              accessibilityId="machine-job-knit"
              text={checkpoint ? "Resume on machine" : "Knit job on machine"}
              onTap={this.handleKnitMachineJob}
              disabled={this.viewModel.isKnitting === true || this.state.machineJobRecoveryLoading === true}
              coloring={CoreButtonColoring.PRIMARY}
              sizing={CoreButtonSizing.SMALL}
              font={BUTTON_FONT_SMALL}
            />
          ) : undefined}
        </layout>
      ) : undefined}
      {this.state.machineJobRecoveryLoading ? (
        <label style={styles.jobMeta} value="Checking recovery state…" />
      ) : checkpoint ? (
        <label
          accessibilityId="machine-job-recovery"
          style={styles.jobMeta}
          value={`${checkpoint.nextPassIndex} of ${summary.passes} passes safely completed`}
        />
      ) : undefined}
      {this.state.machineJobRecoveryError ? (
        <label
          accessibilityId="machine-job-recovery-error"
          style={styles.jobError}
          value={this.state.machineJobRecoveryError}
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
  jobCard: new Style<View>({
    width: "100%",
    flexDirection: "column",
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: SIDEBAR_CARD_BORDER,
    borderRadius: 6,
  }),
  jobTitle: new Style<Label>({
    font: sansBoldFont(13),
    color: TEXT_PRIMARY,
  }),
  jobMeta: new Style<Label>({
    font: sansFont(12),
    color: TEXT_SECONDARY,
    marginTop: 3,
  }),
  jobCompatible: new Style<Label>({
    font: sansBoldFont(12),
    color: "#15803D",
    marginTop: 4,
  }),
  jobError: new Style<Label>({
    font: sansBoldFont(12),
    color: "#B91C1C",
    marginTop: 4,
  }),
  jobAction: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
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
