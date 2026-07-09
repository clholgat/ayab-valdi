/**
 * Pinch-zoomable, scrollable viewport for the knit preview (orange/green bar + image).
 */

import { StatefulComponent } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import {
  View,
  Layout,
  ScrollView,
  Label,
} from "valdi_tsx/src/NativeTemplateElements";
import { PinchEvent, TouchEventState } from "valdi_tsx/src/GestureEvents";
import { TEXT_MUTED, TEXT_SECONDARY } from "constants/src/UiTheme";
import { Slider } from "widgets/src/components/slider/Slider";
import { FormattedDisplay } from "./FormattedDisplay";
import { ZoomablePreviewViewportViewModel } from "./PreviewViewportTypes";
import {
  centeredHorizontalOffset,
  computeSceneLayout,
  rowProgressOverlayHeight,
  SceneLayout,
} from "./PreviewSceneLayout";
import { preparePreviewBits } from "./PreviewTransforms";
import { sansFont } from "constants/src/Typography";
import {
  clampPreviewZoom,
  PREVIEW_DOUBLE_TAP_ZOOM,
  sliderTToZoom,
  zoomToSliderT,
} from "./PreviewZoom";

export { ZoomablePreviewViewportViewModel } from "./PreviewViewportTypes";

interface ZoomablePreviewState {
  viewportWidth?: number;
  zoomScale: number;
  horizontalScrollOffset: number;
  scene?: SceneLayout;
  contentWrapperStyle?: Style<Layout>;
  contentFrameStyle?: Style<View>;
  displayBits?: Uint8Array[][];
  rowProgressOverlayPx?: number;
  rowProgressOverlayWidthPx?: number;
  fitsHorizontally?: boolean;
}

export class ZoomablePreviewViewport extends StatefulComponent<
  ZoomablePreviewViewportViewModel,
  ZoomablePreviewState
> {
  private pinchBaseZoom = 1;
  private lastContentKey?: string;

  state: ZoomablePreviewState = {
    zoomScale: 1,
    horizontalScrollOffset: 0,
  };

  private progressOverlay(
    vm: ZoomablePreviewViewportViewModel,
    stitchSize: number,
    stitchSizeY: number,
  ): {
    rowProgressOverlayPx?: number;
    rowProgressOverlayWidthPx?: number;
  } {
    if (!vm.isKnitting || vm.currentRow == null || vm.currentRow < 0) {
      return {};
    }
    const overlayPx = rowProgressOverlayHeight(
      vm.currentRow,
      vm.totalRows ?? vm.imageHeight,
      vm.imageHeight,
      stitchSizeY,
    );
    if (overlayPx <= 0) {
      return {};
    }
    const startNeedle = vm.startNeedle ?? 0;
    const stopNeedle = vm.stopNeedle ?? Math.max(0, (vm.machineWidth ?? 1) - 1);
    const needleCount = stopNeedle - startNeedle + 1;
    return {
      rowProgressOverlayPx: overlayPx,
      rowProgressOverlayWidthPx: needleCount * stitchSize,
    };
  }

  private applySceneUpdate(
    zoomScale: number,
    viewportWidth = this.state.viewportWidth,
  ): Partial<ZoomablePreviewState> {
    const scene = computeSceneLayout(this.viewModel, viewportWidth, zoomScale);
    const width = viewportWidth ?? 0;
    const horizontalScrollOffset = centeredHorizontalOffset(
      width,
      scene.contentWidth,
    );
    const fitsHorizontally = !(width > 0 && scene.contentWidth > width);
    const displayBits = preparePreviewBits(
      this.viewModel.bits,
      this.viewModel.autoMirror ?? false,
    );
    const overlay = this.progressOverlay(
      this.viewModel,
      scene.stitchSize,
      scene.stitchSizeY,
    );
    return {
      zoomScale,
      scene,
      horizontalScrollOffset,
      fitsHorizontally,
      displayBits,
      rowProgressOverlayPx: overlay.rowProgressOverlayPx,
      rowProgressOverlayWidthPx: overlay.rowProgressOverlayWidthPx,
      contentWrapperStyle: styles.contentWrapper(
        width,
        scene.contentWidth,
        scene.contentHeight,
        fitsHorizontally,
      ),
      contentFrameStyle: styles.contentFrame(
        scene.contentWidth,
        scene.contentHeight,
        fitsHorizontally,
      ),
    };
  }

  private commitSceneUpdate(update: Partial<ZoomablePreviewState>): void {
    this.setState(update);
  }

  private updateZoom(zoomScale: number): void {
    const clamped = clampPreviewZoom(zoomScale);
    if (clamped === this.state.zoomScale) {
      return;
    }
    this.commitSceneUpdate(this.applySceneUpdate(clamped));
  }

  onCreate(): void {
    this.commitSceneUpdate(this.applySceneUpdate(1));
  }

  onViewModelUpdate(
    previousViewModel?: ZoomablePreviewViewportViewModel,
  ): void {
    const key = this.viewModel.contentKey;
    if (key !== undefined && key !== this.lastContentKey) {
      this.lastContentKey = key;
      this.pinchBaseZoom = 1;
      this.commitSceneUpdate(this.applySceneUpdate(1));
      return;
    }

    if (
      !previousViewModel ||
      previousViewModel.startNeedle !== this.viewModel.startNeedle ||
      previousViewModel.stopNeedle !== this.viewModel.stopNeedle ||
      previousViewModel.alignment !== this.viewModel.alignment ||
      previousViewModel.machineWidth !== this.viewModel.machineWidth ||
      previousViewModel.imageWidth !== this.viewModel.imageWidth ||
      previousViewModel.imageHeight !== this.viewModel.imageHeight ||
      previousViewModel.autoMirror !== this.viewModel.autoMirror ||
      previousViewModel.currentRow !== this.viewModel.currentRow ||
      previousViewModel.isKnitting !== this.viewModel.isKnitting ||
      previousViewModel.bits !== this.viewModel.bits
    ) {
      this.commitSceneUpdate(this.applySceneUpdate(this.state.zoomScale));
    }
  }

  private handleViewportLayout = (frame: {
    width: number;
    height: number;
  }): void => {
    const viewportWidth = Math.round(frame.width);
    if (viewportWidth <= 0) {
      return;
    }
    if (this.state.viewportWidth === viewportWidth) {
      return;
    }
    const update = this.applySceneUpdate(this.state.zoomScale, viewportWidth);
    this.commitSceneUpdate({
      viewportWidth,
      ...update,
    });
  };

  private handleSliderChange = (value: number): void => {
    this.updateZoom(sliderTToZoom(value));
  };

  private handlePinch = (event: PinchEvent): void => {
    if (event.state === TouchEventState.Started) {
      this.pinchBaseZoom = this.state.zoomScale;
    }
    if (event.state === TouchEventState.Ended) {
      return;
    }
    this.updateZoom(this.pinchBaseZoom * event.scale);
  };

  private handleDoubleTap = (): void => {
    if (this.state.zoomScale > 1.01) {
      this.pinchBaseZoom = 1;
      this.updateZoom(1);
      return;
    }
    this.pinchBaseZoom = 1;
    this.updateZoom(PREVIEW_DOUBLE_TAP_ZOOM);
  };

  onRender(): void {
    const vm = this.viewModel;
    const s = this.state;
    const scene =
      s.scene ?? computeSceneLayout(vm, s.viewportWidth, s.zoomScale);
    const viewportWidth = s.viewportWidth ?? 0;
    const needsHorizontalScroll =
      viewportWidth > 0 && scene.contentWidth > viewportWidth;
    const fitsHorizontally = s.fitsHorizontally ?? !needsHorizontalScroll;
    const zoomLabel = `${Math.round(s.zoomScale * 100)}%`;
    const bits =
      s.displayBits ??
      preparePreviewBits(vm.bits, vm.autoMirror ?? false);
    const contentWrapperStyle =
      s.contentWrapperStyle ??
      styles.contentWrapper(
        viewportWidth,
        scene.contentWidth,
        scene.contentHeight,
        fitsHorizontally,
      );
    const contentFrameStyle =
      s.contentFrameStyle ??
      styles.contentFrame(
        scene.contentWidth,
        scene.contentHeight,
        fitsHorizontally,
      );

    <layout style={styles.rootColumn}>
      <layout style={styles.zoomSliderRow}>
        <label style={styles.zoomLabel} value="Zoom" />
        <layout style={styles.sliderWrap}>
          <Slider
            initialValue={zoomToSliderT(s.zoomScale)}
            onChange={this.handleSliderChange}
          />
        </layout>
        <label style={styles.zoomValueLabel} value={zoomLabel} />
      </layout>

      <layout style={styles.viewportArea} onLayout={this.handleViewportLayout}>
        <scroll
          style={styles.contentScroll}
          showsVerticalScrollIndicator={true}
          showsHorizontalScrollIndicator={false}
          canAlwaysScrollHorizontal={false}
          canAlwaysScrollVertical={false}
          cancelsTouchesOnScroll={false}
        >
          <layout style={contentWrapperStyle}>
            <view
              style={contentFrameStyle}
              translationX={
                needsHorizontalScroll ? -s.horizontalScrollOffset : 0
              }
              onPinch={this.handlePinch}
              onDoubleTap={this.handleDoubleTap}
            >
              {scene.hasMachineScene ? (
                <FormattedDisplay
                  bits={bits}
                  stitchSize={scene.stitchSize}
                  stitchSizeY={scene.stitchSizeY}
                  machineWidth={vm.machineWidth}
                  barPixelStyle={scene.barPixelStyle}
                  barRowStyle={scene.barRowStyle}
                  barHalf={scene.barHalf}
                  needleMarkerStartStyle={scene.needleMarkerStartStyle}
                  needleMarkerStopStyle={scene.needleMarkerStopStyle}
                  imageOffsetPx={scene.imageOffsetPx}
                  rowProgressOverlayPx={s.rowProgressOverlayPx}
                  rowProgressOverlayWidthPx={s.rowProgressOverlayWidthPx}
                />
              ) : (
                <FormattedDisplay
                  bits={bits}
                  stitchSize={scene.stitchSize}
                  stitchSizeY={scene.stitchSizeY}
                />
              )}
            </view>
          </layout>
        </scroll>
      </layout>
    </layout>;
  }
}

const styles = {
  rootColumn: new Style<Layout>({
    width: "100%",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    flexDirection: "column",
    alignSelf: "stretch",
  }),
  zoomSliderRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    marginBottom: 8,
  }),
  zoomLabel: new Style<Label>({
    font: sansFont(13),
    color: TEXT_SECONDARY,
    marginRight: 8,
    flexShrink: 0,
  }),
  sliderWrap: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  }),
  zoomValueLabel: new Style<Label>({
    font: sansFont(13),
    color: TEXT_MUTED,
    marginLeft: 8,
    flexShrink: 0,
    width: 44,
  }),
  viewportArea: new Style<Layout>({
    width: "100%",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    flexDirection: "column",
  }),
  contentScroll: new Style<ScrollView>({
    width: "100%",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  }),
  contentWrapper: (
    viewportWidth: number,
    contentWidth: number,
    contentHeight: number,
    fitsHorizontally: boolean,
  ) =>
    new Style<Layout>({
      width:
        viewportWidth > 0
          ? Math.max(viewportWidth, contentWidth)
          : contentWidth,
      minHeight: contentHeight,
      flexDirection: "column",
      justifyContent: "flex-start",
      alignItems: fitsHorizontally ? "center" : "flex-start",
      flexShrink: 0,
    }),
  contentFrame: (width: number, height: number, centerHorizontally: boolean) =>
    new Style<View>({
      width,
      height,
      flexDirection: "column",
      alignItems: "flex-start",
      justifyContent: "flex-start",
      flexShrink: 0,
      alignSelf: centerHorizontally ? "center" : "flex-start",
    }),
};
