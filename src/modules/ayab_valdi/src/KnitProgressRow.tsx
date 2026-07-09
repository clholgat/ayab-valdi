/**
 * One row of the knit progress table (desktop KnitProgress row).
 */

import { StatefulComponent } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { Layout, View, Label } from "valdi_tsx/src/NativeTemplateElements";
import { sansFont } from "constants/src/Typography";
import {
  NEEDLE_GRID_BORDER_LEFT,
  NEEDLE_GRID_BORDER_RIGHT,
  NEEDLE_NUMBER_LEFT,
  NEEDLE_NUMBER_RIGHT,
} from "constants/src/NeedleColors";
import {
  computeKnitProgressCells,
  KnitProgressCellRenderData,
} from "./KnitProgressRowLogic";

export interface KnitProgressRowViewModel {
  title: string;
  detail?: string;
  bits: Uint8Array;
  knitStartNeedle: number;
  knitNeedleCount: number;
  machineWidth: number;
  color: number;
  altColor: number | null;
  selectedColumn?: number | null;
  onStitchSelect?: (column: number) => void;
}

interface State {
  cells: KnitProgressCellRenderData[];
  cellTapHandlers: Array<() => void>;
}

const CELL_W = 14;
const CELL_H = 16;

const styles = {
  tableRow: new Style<Layout>({
    flexDirection: "row",
    width: "100%",
    marginBottom: 4,
    alignItems: "flex-start",
  }),
  rowTitleCol: new Style<Layout>({
    width: 96,
    flexShrink: 0,
    paddingRight: 6,
    paddingTop: 2,
  }),
  rowTitle: new Style<Label>({
    font: sansFont(12),
    color: "#333333",
    numberOfLines: 0,
  }),
  rowDetail: new Style<Label>({
    font: sansFont(11),
    color: "#666666",
    marginTop: 2,
    numberOfLines: 0,
  }),
  gridCol: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: "column",
  }),
  numberRow: new Style<Layout>({
    flexDirection: "row",
    height: 14,
    marginBottom: 1,
  }),
  stitchRow: new Style<Layout>({
    flexDirection: "row",
    height: CELL_H,
  }),
  numberCell: new Style<Layout>({
    width: CELL_W,
    height: 14,
    flexShrink: 0,
    justifyContent: "center",
    alignItems: "center",
  }),
  stitchCell: new Style<View>({
    width: CELL_W,
    height: CELL_H,
    flexShrink: 0,
    borderWidth: 0.5,
    borderColor: "#bbbbbb",
  }),
  numLeft: new Style<Label>({
    font: sansFont(9),
    textAlign: "center",
    color: NEEDLE_NUMBER_LEFT,
  }),
  numRight: new Style<Label>({
    font: sansFont(9),
    textAlign: "center",
    color: NEEDLE_NUMBER_RIGHT,
  }),
};

class KnitProgressRowInner extends StatefulComponent<
  KnitProgressRowViewModel,
  State
> {
  state: State = { cells: [], cellTapHandlers: [] };

  onCreate(): void {
    this.rebuildCells();
  }

  onViewModelUpdate(_previous?: KnitProgressRowViewModel): void {
    this.rebuildCells();
  }

  private rebuildCells(): void {
    const cells = computeKnitProgressCells(this.viewModel);
    const cellTapHandlers = this.viewModel.onStitchSelect
      ? cells.map((_, column) => () => this.handleCellTap(column))
      : [];
    this.setState({ cells, cellTapHandlers });
  }

  private handleCellTap = (column: number): void => {
    this.viewModel.onStitchSelect?.(column);
  };

  onRender(): void {
    const vm = this.viewModel;
    const cells = this.state.cells;
    if (cells.length === 0) {
      <layout style={styles.tableRow}>
        <layout style={styles.rowTitleCol}>
          <label style={styles.rowTitle} value={vm.title} />
        </layout>
        <label style={styles.rowTitle} value="—" />;
      </layout>;
      return;
    }

    const detail = vm.detail ?? "";

    <layout style={styles.tableRow}>
      <layout style={styles.rowTitleCol}>
        <label style={styles.rowTitle} value={vm.title} />
        {detail.length > 0 && <label style={styles.rowDetail} value={detail} />}
      </layout>
      <layout style={styles.gridCol}>
        <layout style={styles.numberRow}>
          {(() => {
            for (const cell of cells) {
              <layout style={styles.numberCell}>
                <label
                  style={cell.isLeftNumber ? styles.numLeft : styles.numRight}
                  value={cell.numberLabel}
                />
              </layout>;
            }
          })()}
        </layout>
        <layout style={styles.stitchRow}>
          {(() => {
            for (let c = 0; c < cells.length; c++) {
              const cell = cells[c]!;
              const selected = vm.selectedColumn === c;
              const sideBorder = cell.isLeftNumber
                ? NEEDLE_GRID_BORDER_LEFT
                : NEEDLE_GRID_BORDER_RIGHT;
              <view
                accessibilityId={`stitch-cell-${c}`}
                style={styles.stitchCell}
                backgroundColor={cell.backgroundColor}
                borderColor={selected ? "#2563EB" : sideBorder}
                borderWidth={selected ? 1.5 : 0.5}
                onTap={this.state.cellTapHandlers[c]}
              />;
            }
          })()}
        </layout>
      </layout>
    </layout>;
  }
}

export { KnitProgressRowInner as KnitProgressRow };
