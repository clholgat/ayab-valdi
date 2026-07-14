// Takes the bits and displays them in a grid. Optionally shows a needle bar row (orange/green) + markers above the image.

import { StatefulComponent } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { View, Layout } from "valdi_tsx/src/NativeTemplateElements";
import {
  NEEDLE_BAR_GREEN,
  NEEDLE_BAR_ORANGE,
} from "constants/src/NeedleColors";
import { PREVIEW_BAR_HEIGHT } from "./PreviewSceneLayout";
import {
  computePixelGrid,
  type PixelCell,
} from "./FormattedDisplayLogic";

const barRowWrapperStyle = new Style<View>({
  position: "relative",
  flexShrink: 0,
  flexGrow: 0,
  alignSelf: "flex-start",
});

const bedSceneWrapperStyle = (widthPx: number) =>
  new Style<View>({
    position: "relative",
    flexShrink: 0,
    flexGrow: 0,
    alignSelf: "flex-start",
    width: widthPx,
  });

const rootColumnStyle = new Style<Layout>({
  flexDirection: "column",
  alignItems: "center",
  alignSelf: "flex-start",
});

const bedColumnStyle = new Style<Layout>({
  flexDirection: "column",
  alignItems: "flex-start",
  alignSelf: "flex-start",
});

const imageGridOffsetStyle = (offsetPx: number) =>
  new Style<Layout>({
    flexDirection: "column",
    alignItems: "flex-start",
    marginLeft: offsetPx,
  });

const imageGridWrapperStyle = new Style<View>({
  position: "relative",
  flexShrink: 0,
  alignSelf: "flex-start",
});

const rowProgressOverlayStyle = (
  heightPx: number,
  widthPx: number,
  leftPx: number,
) =>
  new Style<View>({
    position: "absolute",
    left: leftPx,
    bottom: 0,
    width: widthPx,
    height: heightPx,
    backgroundColor: "rgba(127,127,127,0.5)",
  });

export interface FormattedDisplayViewModel {
  bits: Uint8Array[][];
  stitchSize?: number;
  stitchSizeY?: number;
  machineWidth?: number;
  barPixelStyle?: Style<View>;
  barRowStyle?: Style<Layout>;
  barHalf?: number;
  needleMarkerStartStyle?: Style<View>;
  needleMarkerStopStyle?: Style<View>;
  imageOffsetPx?: number;
  /** Height in px of grey knit-progress band from image bottom. */
  rowProgressOverlayPx?: number;
  /** Width in px of knit-progress band (needle window). */
  rowProgressOverlayWidthPx?: number;
  /** Left edge of the band relative to the image grid (needle window is bed-relative). */
  rowProgressOverlayLeftPx?: number;
}

const DEFAULT_STITCH = 10;

interface State {
  middleCol: number;
  stitchStyle: Style<View>;
  showBar: boolean;
  imageWidth: number;
  barOrangeCount: number;
  barOrangeStyle: Style<View>;
  barGreenStyle: Style<View>;
  bedColumnStyle: Style<Layout>;
  bedSceneWrapperStyle: Style<View>;
  imageGridStyle: Style<Layout>;
  pixelRows: PixelCell[][];
}

function computeDerivedState(vm: FormattedDisplayViewModel): Partial<State> {
  const bits = vm.bits;
  const imageWidth = bits.length > 0 ? bits[0].length : 0;
  const machineWidth = vm.machineWidth ?? 0;
  const size = vm.stitchSize ?? DEFAULT_STITCH;
  const sizeY = vm.stitchSizeY ?? size;
  const showBar =
    machineWidth > 0 &&
    vm.barPixelStyle != null &&
    vm.barRowStyle != null &&
    vm.barHalf != null &&
    vm.needleMarkerStartStyle != null &&
    vm.needleMarkerStopStyle != null;
  const barHalfCount = Math.floor(machineWidth / 2);
  const barGreenCount = machineWidth - barHalfCount;
  const middleCol = imageWidth ? Math.floor(imageWidth / 2) : 0;
  const pixelRows = computePixelGrid({
    bits,
    machineWidth,
    stitchSize: size,
    imageOffsetPx: vm.imageOffsetPx,
    barHalf: vm.barHalf ?? barHalfCount,
    showBar,
  });

  return {
    middleCol,
    stitchStyle: new Style<View>({
      width: size,
      height: sizeY,
      borderRadius: 0,
    }),
    showBar,
    imageWidth,
    barOrangeCount: barHalfCount,
    barOrangeStyle: new Style<View>({
      width: barHalfCount * size,
      height: PREVIEW_BAR_HEIGHT,
      flexShrink: 0,
    }),
    barGreenStyle: new Style<View>({
      width: barGreenCount * size,
      height: PREVIEW_BAR_HEIGHT,
      flexShrink: 0,
    }),
    bedColumnStyle: new Style<Layout>({
      flexDirection: "column",
      alignItems: "flex-start",
      alignSelf: "flex-start",
      width: machineWidth * size,
    }),
    bedSceneWrapperStyle: bedSceneWrapperStyle(machineWidth * size),
    imageGridStyle: imageGridOffsetStyle(vm.imageOffsetPx ?? 0),
    pixelRows,
  };
}

export class FormattedDisplay extends StatefulComponent<
  FormattedDisplayViewModel,
  State
> {
  state: State = {
    middleCol: 0,
    stitchStyle: new Style<View>({
      width: DEFAULT_STITCH,
      height: DEFAULT_STITCH,
      borderRadius: 0,
    }),
    showBar: false,
    imageWidth: 0,
    barOrangeCount: 0,
    barOrangeStyle: new Style<View>({
      width: 0,
      height: PREVIEW_BAR_HEIGHT,
      flexShrink: 0,
    }),
    barGreenStyle: new Style<View>({
      width: 0,
      height: PREVIEW_BAR_HEIGHT,
      flexShrink: 0,
    }),
    bedColumnStyle,
    bedSceneWrapperStyle: bedSceneWrapperStyle(0),
    imageGridStyle: imageGridOffsetStyle(0),
    pixelRows: [],
  };

  onCreate(): void {
    this.setState(computeDerivedState(this.viewModel));
  }

  onViewModelUpdate(_previousViewModel?: FormattedDisplayViewModel): void {
    this.setState(computeDerivedState(this.viewModel));
  }

  private renderImageGrid(
    pixelRows: PixelCell[][],
    stitchStyle: Style<View>,
    rowProgressOverlayPx?: number,
    rowProgressOverlayWidthPx?: number,
    rowProgressOverlayLeftPx?: number,
  ): void {
    <view style={imageGridWrapperStyle}>
      {(() => {
        for (let rowIndex = 0; rowIndex < pixelRows.length; rowIndex++) {
          const rowCells = pixelRows[rowIndex];
          <layout flexDirection="row">
            {(() => {
              for (let colIndex = 0; colIndex < rowCells.length; colIndex++) {
                const cell = rowCells[colIndex];
                <view
                  backgroundColor={cell.backgroundColor}
                  style={stitchStyle}
                  borderWidth={0.5}
                  borderColor={cell.borderColor}
                />;
              }
            })()}
          </layout>;
        }
      })()}
      {rowProgressOverlayPx != null &&
      rowProgressOverlayPx > 0 &&
      rowProgressOverlayWidthPx != null &&
      rowProgressOverlayWidthPx > 0 ? (
        <view
          style={rowProgressOverlayStyle(
            rowProgressOverlayPx,
            rowProgressOverlayWidthPx,
            rowProgressOverlayLeftPx ?? 0,
          )}
        />
      ) : undefined}
    </view>;
  }

  onRender(): void {
    const vm = this.viewModel;
    const bits = vm.bits;
    if (bits.length === 0) return;
    const s = this.state;
    <layout style={rootColumnStyle}>
      {s.showBar ? (
        <view style={s.bedSceneWrapperStyle}>
          <layout style={s.bedColumnStyle}>
            <view style={barRowWrapperStyle}>
              <layout style={vm.barRowStyle!}>
                <view
                  style={s.barOrangeStyle}
                  backgroundColor={NEEDLE_BAR_ORANGE}
                />
                <view
                  style={s.barGreenStyle}
                  backgroundColor={NEEDLE_BAR_GREEN}
                />
              </layout>
            </view>
            <layout style={s.imageGridStyle}>
              {this.renderImageGrid(
                s.pixelRows,
                s.stitchStyle,
                vm.rowProgressOverlayPx,
                vm.rowProgressOverlayWidthPx,
                vm.rowProgressOverlayLeftPx,
              )}
            </layout>
          </layout>
          <view style={vm.needleMarkerStartStyle!} />
          <view style={vm.needleMarkerStopStyle!} />
        </view>
      ) : (
        <layout style={styles.plainImageColumn}>
          <layout style={styles.plainImageGrid}>
            {this.renderImageGrid(s.pixelRows, s.stitchStyle)}
          </layout>
        </layout>
      )}
    </layout>;
  }
}

const styles = {
  plainImageColumn: new Style<Layout>({
    flexDirection: "column",
    alignItems: "center",
    alignSelf: "center",
  }),
  plainImageGrid: new Style<Layout>({
    flexDirection: "column",
    alignItems: "center",
  }),
};
