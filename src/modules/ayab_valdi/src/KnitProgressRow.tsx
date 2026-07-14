/**
 * One row of the knit progress table (desktop KnitProgress row).
 */

import { StatefulComponent } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { Layout, ScrollView, View, Label } from "valdi_tsx/src/NativeTemplateElements";
import { ElementFrame } from "valdi_tsx/src/Geometry";
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
  /** Measured width of the strip container; 0 until the first layout. */
  stripWidth: number;
}

/** Preferred cell size; cells shrink below this to fit the container. */
const CELL_W = 14;
const CELL_H = 16;
/** Cells never shrink below this; narrower strips scroll instead. */
const MIN_CELL_W = 3;
/** Minimum room a needle-number label needs. */
const NUMBER_LABEL_W = 20;

const styles = {
  // Label line on top, needle strip below: the strip scrolls horizontally
  // when wider than the viewport and centers when narrower.
  tableRow: new Style<Layout>({
    flexDirection: "column",
    width: "100%",
    marginBottom: 6,
  }),
  rowTitleCol: new Style<Layout>({
    flexDirection: "row",
    alignItems: "baseline",
    flexShrink: 0,
    marginBottom: 2,
  }),
  rowTitle: new Style<Label>({
    font: sansFont(12),
    color: "#333333",
    numberOfLines: 1,
  }),
  rowDetail: new Style<Label>({
    font: sansFont(11),
    color: "#666666",
    marginLeft: 6,
    numberOfLines: 1,
  }),
  stripScroll: new Style<ScrollView>({
    width: "100%",
    flexShrink: 0,
  }),
  stripScrollContent: new Style<Layout>({
    flexDirection: "row",
    justifyContent: "center",
    minWidth: "100%",
  }),
  gridCol: new Style<Layout>({
    flexShrink: 0,
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
  // Width comes from the per-render fitted cell size (JSX attribute).
  stitchCell: new Style<View>({
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
  numberRowSparse: new Style<Layout>({
    height: 14,
    marginBottom: 1,
    flexShrink: 0,
  }),
  numLeftSparse: new Style<Label>({
    font: sansFont(9),
    textAlign: "center",
    color: NEEDLE_NUMBER_LEFT,
    position: "absolute",
    top: 0,
    width: NUMBER_LABEL_W,
  }),
  numRightSparse: new Style<Label>({
    font: sansFont(9),
    textAlign: "center",
    color: NEEDLE_NUMBER_RIGHT,
    position: "absolute",
    top: 0,
    width: NUMBER_LABEL_W,
  }),
};

class KnitProgressRowInner extends StatefulComponent<
  KnitProgressRowViewModel,
  State
> {
  state: State = { cells: [], cellTapHandlers: [], stripWidth: 0 };

  private handleStripLayout = (frame: ElementFrame): void => {
    const width = Math.floor(frame.width);
    if (width > 0 && Math.abs(width - this.state.stripWidth) > 1) {
      this.setState({ stripWidth: width });
    }
  };

  /** Cell width that fits the container, floored so huge beds still scroll. */
  private cellWidth(cellCount: number): number {
    if (this.state.stripWidth <= 0 || cellCount === 0) {
      return CELL_W;
    }
    const fitted = Math.floor(this.state.stripWidth / cellCount);
    return Math.max(MIN_CELL_W, Math.min(CELL_W, fitted));
  }

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
      <scroll
        style={styles.stripScroll}
        horizontal
        showsHorizontalScrollIndicator
        onLayout={this.handleStripLayout}
      >
        <layout style={styles.stripScrollContent}>
          <layout style={styles.gridCol}>
            {this.renderNumberRow(cells)}
            <layout style={styles.stitchRow}>
              {(() => {
                const cellW = this.cellWidth(cells.length);
                for (let c = 0; c < cells.length; c++) {
                  const cell = cells[c]!;
                  const selected = vm.selectedColumn === c;
                  const sideBorder = cell.isLeftNumber
                    ? NEEDLE_GRID_BORDER_LEFT
                    : NEEDLE_GRID_BORDER_RIGHT;
                  <view
                    accessibilityId={`stitch-cell-${c}`}
                    style={styles.stitchCell}
                    width={cellW}
                    backgroundColor={cell.backgroundColor}
                    borderColor={selected ? "#2563EB" : sideBorder}
                    borderWidth={selected ? 1.5 : cellW < 6 ? 0.25 : 0.5}
                    onTap={this.state.cellTapHandlers[c]}
                  />;
                }
              })()}
            </layout>
          </layout>
        </layout>
      </scroll>
    </layout>;
  }

  /**
   * Needle numbers. At full cell size every cell is labeled; when cells
   * shrink, labels go sparse (absolutely positioned over their cell) so the
   * text never forces the strip wider than the container.
   */
  private renderNumberRow(cells: KnitProgressCellRenderData[]): void {
    const cellW = this.cellWidth(cells.length);
    if (cellW >= CELL_W) {
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
      </layout>;
      return;
    }
    const step = Math.max(1, Math.ceil(NUMBER_LABEL_W / cellW));
    <layout style={styles.numberRowSparse} width={cells.length * cellW}>
      {(() => {
        for (let c = 0; c < cells.length; c += step) {
          const cell = cells[c]!;
          <label
            style={cell.isLeftNumber ? styles.numLeftSparse : styles.numRightSparse}
            left={c * cellW + cellW / 2 - NUMBER_LABEL_W / 2}
            value={cell.numberLabel}
          />;
        }
      })()}
    </layout>;
  }
}

export { KnitProgressRowInner as KnitProgressRow };
