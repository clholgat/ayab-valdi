/**
 * Knit progress panel — desktop parity: KnitProgress (needle table) + ProgressBar (row summary).
 */

import { StatefulComponent } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { Layout, View, Label } from "valdi_tsx/src/NativeTemplateElements";
import { sansFont, sansBoldFont } from "constants/src/Typography";
import { rgbIntToHex } from "preview/src/FormattedDisplayLogic";
import {
  SIDEBAR_CARD_BACKGROUND,
  SIDEBAR_CARD_BORDER,
  sidebarCardInnerStyle,
  sidebarCardStyle,
} from "constants/src/SidebarStyles";
import { Status } from "state_machine/src/Status";
import { KnitProgressRow, KnitProgressRowViewModel } from "./KnitProgressRow";
import {
  formatRowDetail,
  formatCompletedRowDetail,
} from "./ProgressRowDetail";

export interface ProgressAndStatusViewModel {
  status: Status | undefined;
  isKnitting: boolean;
  statusVersion?: number;
}

interface RowSnapshot extends KnitProgressRowViewModel {
  currentRow: number;
}

interface State {
  completedRow?: RowSnapshot;
  lastSnapshot?: RowSnapshot;
  lastTick: number;
  selectionLabel: string;
  selectedColumn: number | null;
  rowSummary: string;
  colorHex?: string;
}

const styles = {
  panelInner: sidebarCardInnerStyle,
  summaryRow: new Style<Layout>({
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: 8,
    paddingTop: 6,
  }),
  rowLabelLarge: new Style<Label>({
    font: sansBoldFont(18),
    color: "#111827",
    textAlign: "center",
  }),
  spacer: new Style<Layout>({ height: 5, width: "100%" }),
  idleLabel: new Style<Label>({ font: sansFont(14), color: "#6B7280" }),
  colorSwatch: new Style<View>({
    width: 16,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  }),
  selectionLabel: new Style<Label>({
    font: sansFont(12),
    color: "#374151",
    textAlign: "center",
    marginTop: 4,
  }),
};

function resolveNeedleCount(status: Status): number {
  if (status.knitNeedleCount > 0) return status.knitNeedleCount;
  if (status.bits.length > 0) return status.bits.length * 8;
  return 0;
}

function resolveMachineWidth(status: Status): number {
  if (status.machineWidth > 0) return status.machineWidth;
  return 200;
}

function snapshotFromStatus(
  status: Status,
  title: string,
  detail: string,
): RowSnapshot {
  return {
    currentRow: status.currentRow,
    title,
    detail,
    bits: new Uint8Array(status.bits),
    knitStartNeedle: status.knitStartNeedle >= 0 ? status.knitStartNeedle : 0,
    knitNeedleCount: resolveNeedleCount(status),
    machineWidth: resolveMachineWidth(status),
    color: status.color,
    altColor: status.altColor,
  };
}

function buildRowSummary(status: Status): string {
  let summary = `Row ${status.currentRow}/${status.totalRows}`;
  if (status.repeats >= 0) {
    summary += ` (repeats completed: ${status.repeats})`;
  }
  return summary;
}

export class ProgressAndStatus extends StatefulComponent<
  ProgressAndStatusViewModel,
  State
> {
  state: State = {
    lastTick: -1,
    selectionLabel: "",
    selectedColumn: null,
    rowSummary: "",
  };

  private handleStitchSelect = (column: number): void => {
    const status = this.viewModel.status;
    if (!status) {
      return;
    }
    const needle = status.knitStartNeedle + column;
    const half = Math.floor(resolveMachineWidth(status) / 2);
    const fromR1 = needle - half;
    const side = fromR1 < 0 ? "Right" : "Left";
    const needleLabel =
      fromR1 < 0 ? String(-fromR1) : String(1 + fromR1);
    this.setState({
      selectedColumn: column,
      selectionLabel: `Selection: To Be Selected stitch ${side}-${needleLabel}`,
    });
  };

  onViewModelUpdate(_previous?: ProgressAndStatusViewModel): void {
    if (!this.viewModel.isKnitting) {
      if (this.state.lastSnapshot != null || this.state.completedRow != null) {
        this.setState({
          completedRow: undefined,
          lastSnapshot: undefined,
          lastTick: -1,
          selectionLabel: "",
          selectedColumn: null,
          rowSummary: "",
          colorHex: undefined,
        });
      }
      return;
    }

    const tick = this.viewModel.statusVersion ?? 0;
    if (tick === this.state.lastTick) return;

    const status = this.viewModel.status;
    if (!status || status.currentRow < 0) {
      this.setState({ lastTick: tick });
      return;
    }

    const snap = snapshotFromStatus(status, "To Be Selected", formatRowDetail(status));
    const prev = this.state.lastSnapshot;
    const rowSummary = buildRowSummary(status);
    const colorHex =
      status.colorSymbol && status.color >= 0
        ? rgbIntToHex(status.color)
        : undefined;

    if (prev && snap.currentRow !== prev.currentRow) {
      this.setState({
        completedRow: {
          ...prev,
          title: `Row ${prev.currentRow}`,
          detail: formatCompletedRowDetail(status),
        },
        lastSnapshot: snap,
        lastTick: tick,
        rowSummary,
        colorHex,
      });
      return;
    }
    this.setState({ lastSnapshot: snap, lastTick: tick, rowSummary, colorHex });
  }

  onRender(): void {
    const vm = this.viewModel;
    const current = this.state.lastSnapshot;

    if (!vm.isKnitting || current == null) {
      <view
        style={sidebarCardStyle}
        backgroundColor={SIDEBAR_CARD_BACKGROUND}
        borderColor={SIDEBAR_CARD_BORDER}
        borderWidth={1}
      >
        <layout style={styles.panelInner}>
          <view accessibilityId="progress-status">
            <label
              style={styles.idleLabel}
              value={
                vm.isKnitting ? "Progress: waiting for carriage…" : "Progress: —"
              }
            />
          </view>
        </layout>
      </view>;
      return;
    }

    <view
      style={sidebarCardStyle}
      backgroundColor={SIDEBAR_CARD_BACKGROUND}
      borderColor={SIDEBAR_CARD_BORDER}
      borderWidth={1}
    >
      <layout style={styles.panelInner}>
        <KnitProgressRow
          title={current.title}
          detail={current.detail}
          bits={current.bits}
          knitStartNeedle={current.knitStartNeedle}
          knitNeedleCount={current.knitNeedleCount}
          machineWidth={current.machineWidth}
          color={current.color}
          altColor={current.altColor}
          selectedColumn={this.state.selectedColumn}
          onStitchSelect={this.handleStitchSelect}
        />

        {this.state.completedRow != null ? (
          <layout style={styles.spacer} />
        ) : undefined}
        {this.state.completedRow != null ? (
          <KnitProgressRow
            title={this.state.completedRow.title}
            detail={this.state.completedRow.detail}
            bits={this.state.completedRow.bits}
            knitStartNeedle={this.state.completedRow.knitStartNeedle}
            knitNeedleCount={this.state.completedRow.knitNeedleCount}
            machineWidth={this.state.completedRow.machineWidth}
            color={this.state.completedRow.color}
            altColor={this.state.completedRow.altColor}
          />
        ) : undefined}

        <layout style={styles.summaryRow}>
          {this.state.colorHex ? (
            <view
              style={styles.colorSwatch}
              backgroundColor={this.state.colorHex}
            />
          ) : undefined}
          <label style={styles.rowLabelLarge} value={this.state.rowSummary} />
        </layout>
        {this.state.selectionLabel.length > 0 ? (
          <view accessibilityId="progress-stitch-selection">
            <label
              style={styles.selectionLabel}
              value={this.state.selectionLabel}
            />
          </view>
        ) : undefined}
      </layout>
    </view>;
  }
}
