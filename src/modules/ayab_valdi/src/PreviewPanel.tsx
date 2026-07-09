/**
 * Left column: image preview with progress/status directly below (desktop parity).
 */

import { StatefulComponent } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { Layout } from "valdi_tsx/src/NativeTemplateElements";
import { Preview } from "preview/src/Preview";
import { PatternLoadInfo } from "preview/src/Preview";
import { ProgressAndStatus } from "./ProgressAndStatus";
import { KnitSession } from "./KnitSession";
import { ValueNotifier } from "./ValueNotifier";
import { ActiveTourBubble, InlineTourBubble } from "./InlineTourBubble";
import { KnitActionBanner } from "./KnitActionBanner";
import { FeedbackLevel } from "./Feedback";
import { shouldShowKnitActionBanner } from "./KnitSessionUiLogic";

export interface PreviewPanelViewModel {
  title: string;
  machineWidth?: number;
  /** User-selected knit needle range (inclusive). */
  startNeedle?: number;
  stopNeedle?: number;
  alignment?: number;
  autoMirror?: boolean;
  aspectRatio?: number;
  onBitsLoaded?: (
    bits: Uint8Array[][],
    width: number,
    height: number,
    info?: PatternLoadInfo,
  ) => void;
  /** Bumped when parent updates image bits (e.g. repeat from Image Settings). */
  imageBitsRevision?: number;
  syncedBits?: Uint8Array[][];
  knitSession?: KnitSession;
  isKnitting: boolean;
  statusNotifier?: ValueNotifier<number>;
  userMessageText?: string;
  userMessageLevel?: FeedbackLevel;
  tourHighlighted?: boolean;
  tourBubble?: ActiveTourBubble | null;
}

interface PreviewPanelState {
  statusVersion: number;
}

export class PreviewPanel extends StatefulComponent<
  PreviewPanelViewModel,
  PreviewPanelState
> {
  state: PreviewPanelState = { statusVersion: 0 };

  private unsubscribeStatus?: () => void;

  onCreate(): void {
    this.subscribeToStatusNotifier(this.viewModel.statusNotifier);
  }

  onViewModelUpdate(previous?: PreviewPanelViewModel): void {
    if (previous?.statusNotifier !== this.viewModel.statusNotifier) {
      this.subscribeToStatusNotifier(this.viewModel.statusNotifier);
    }
  }

  onDestroy(): void {
    this.unsubscribeStatus?.();
    this.unsubscribeStatus = undefined;
  }

  private subscribeToStatusNotifier(
    notifier: ValueNotifier<number> | undefined,
  ): void {
    this.unsubscribeStatus?.();
    this.unsubscribeStatus = undefined;
    if (!notifier) {
      this.setState({ statusVersion: 0 });
      return;
    }
    this.unsubscribeStatus = notifier.subscribe((version) => {
      if (!this.isDestroyed()) {
        this.setState({ statusVersion: version });
      }
    });
  }

  onRender(): void {
    const vm = this.viewModel;
    const status = vm.knitSession?.control.status;
    const showActionBanner = shouldShowKnitActionBanner(
      vm.isKnitting,
      vm.userMessageText,
    );
    <layout style={styles.column}>
      <layout style={styles.previewArea}>
        {showActionBanner && vm.userMessageText ? (
          <KnitActionBanner
            message={vm.userMessageText}
            level={vm.userMessageLevel}
            currentRow={status?.currentRow}
            totalRows={status?.totalRows}
          />
        ) : undefined}
        <layout style={styles.previewFill}>
          <Preview
            title={vm.title}
            machineWidth={vm.machineWidth}
            startNeedle={vm.startNeedle}
            stopNeedle={vm.stopNeedle}
            alignment={vm.alignment}
            autoMirror={vm.autoMirror}
            aspectRatio={vm.aspectRatio}
            currentRow={status?.currentRow}
            totalRows={status?.totalRows}
            isKnitting={vm.isKnitting}
            onBitsLoaded={vm.onBitsLoaded}
            imageBitsRevision={vm.imageBitsRevision}
            syncedBits={vm.syncedBits}
            tourHighlighted={vm.tourHighlighted}
          />
        </layout>
      </layout>
      <InlineTourBubble
        targetId="checklist-target-pattern"
        bubble={vm.tourBubble}
      />
      <layout style={styles.progressArea}>
        <ProgressAndStatus
          status={status}
          isKnitting={vm.isKnitting}
          statusVersion={this.state.statusVersion}
        />
      </layout>
    </layout>;
  }
}

const styles = {
  column: new Style<Layout>({
    width: "100%",
    height: "100%",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    flexDirection: "column",
    alignItems: "stretch",
  }),
  previewArea: new Style<Layout>({
    width: "100%",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    flexDirection: "column",
  }),
  previewFill: new Style<Layout>({
    width: "100%",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    flexDirection: "column",
  }),
  progressArea: new Style<Layout>({
    width: "100%",
    flexShrink: 0,
    marginTop: 12,
  }),
};
