/**
 * Key ZoomablePreviewViewport uses to detect "this is genuinely new content"
 * and reset zoom to 100%. Deliberately excludes knit progress (currentRow) -
 * that changes on every knit row and must NOT reset the user's zoom/pan while
 * they're actively watching a knit in progress.
 */
export function computeZoomContentKey(
  width: number,
  height: number,
  bitsLength: number,
  autoMirror: boolean,
  aspectRatio: number,
): string {
  return `${width}x${height}-${bitsLength}-${autoMirror ? "m" : "n"}-${aspectRatio}`;
}

export interface ZoomablePreviewViewportViewModel {
  bits: Uint8Array[][];
  imageWidth: number;
  imageHeight: number;
  machineWidth?: number;
  startNeedle?: number;
  stopNeedle?: number;
  /** 0 = CENTER, 1 = LEFT, 2 = RIGHT */
  alignment?: number;
  /** When set, zoom resets after this value changes (e.g. new image). */
  contentKey?: string;
  /** Mirror image horizontally for knit-side preview. */
  autoMirror?: boolean;
  /** Current knit row for grey progress overlay (-1 = hidden). */
  currentRow?: number;
  /** Total pattern rows for progress overlay. */
  totalRows?: number;
  /** Whether knit is active (shows overlay when currentRow >= 0). */
  isKnitting?: boolean;
  /** AspectRatio enum value — 0 default (1:1), 1 fairisle (4:5 vertical compress). */
  aspectRatio?: number;
}
