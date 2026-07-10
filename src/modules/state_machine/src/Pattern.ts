import { Mode, Alignment } from "constants/src/StateMachineConstants";
import { quantizeRgbaImage } from "./ColorQuantization";

export class PatternImage {
  width: number;
  height: number;
  colors: number;
  image: Uint8Array[][]; // 3D array: rows -> columns -> RGBA bytes

  constructor(
    image: Uint8Array[][],
    width: number,
    height: number,
    colors: number,
  ) {
    this.width = width;
    this.height = height;
    this.colors = colors;
    this.image = image;
  }
}

export class Pattern {
  width: number;
  height: number;
  colors: number;
  startNeedle: number;
  endNeedle: number;
  startRow: number;
  endRow: number;
  startPixel: number;
  endPixel: number;
  repeats: number;
  pattern: PatternImage;
  patternColors: Uint8Array;
  patternExpanded: Uint8Array;
  patternIntern: Uint8Array;
  /** RGB colors as 0xRRGGBB (not Uint8Array — 24-bit values do not fit in one byte). */
  palette: number[];
  alignment: Alignment;
  mode: Mode;
  knitStartNeedle: number;
  knitEndNeedle: number;
  knitStartRow: number;
  knitEndRow: number;
  knitStartPixel: number;
  knitEndPixel: number;
  knitRepeats: number;
  knitPattern: Uint8Array;
  knitPatternColors: Uint8Array;
  knitPatternExpanded: Uint8Array;
  knitPatternIntern: Uint8Array;
  knitPalette: number[];
  knitAlignment: Alignment;
  knitMode: Mode;

  constructor(image: PatternImage, numColors: number = 2) {
    this.width = 0;
    this.height = 0;
    this.colors = 0;
    this.startNeedle = 0;
    this.endNeedle = 0;
    this.startRow = 0;
    this.endRow = 0;
    this.startPixel = 0;
    this.endPixel = 0;
    this.repeats = 0;
    this.pattern = image;
    // Initialize array properties
    this.patternColors = new Uint8Array();
    this.patternExpanded = new Uint8Array();
    this.patternIntern = new Uint8Array();
    this.palette = [];
    // Initialize alignment and mode with default values
    this.alignment = Alignment.CENTER;
    this.mode = Mode.SINGLEBED;
    // Initialize knit properties
    this.knitStartNeedle = 0;
    this.knitEndNeedle = 0;
    this.knitStartRow = 0;
    this.knitEndRow = 0;
    this.knitStartPixel = 0;
    this.knitEndPixel = 0;
    this.knitRepeats = 0;
    this.knitPattern = new Uint8Array();
    this.knitPatternColors = new Uint8Array();
    this.knitPatternExpanded = new Uint8Array();
    this.knitPatternIntern = new Uint8Array();
    this.knitPalette = [];
    this.knitAlignment = Alignment.CENTER;
    this.knitMode = Mode.SINGLEBED;
    this.updatePatternData();
  }

  reset() {
    this.width = 0;
    this.height = 0;
    this.colors = 0;
    this.startNeedle = 0;
    this.endNeedle = 0;
    this.startRow = 0;
    this.endRow = 0;
  }

  updatePatternData() {
    this.width = this.pattern.width;
    this.height = this.pattern.height;
    this.colors = this.pattern.colors;
  }

  /**
   * Calculate pat_start_needle and pat_end_needle based on alignment
   * This matches Python's __calc_pat_start_end_needles method
   */
  calcPatStartEndNeedles(): void {
    if (this.alignment === Alignment.CENTER) {
      const needleWidth = this.knitEndNeedle - this.knitStartNeedle;
      this.startNeedle =
        this.knitStartNeedle + Math.floor((needleWidth - this.width + 1) / 2);
      this.endNeedle = this.startNeedle + this.width;
    } else if (this.alignment === Alignment.LEFT) {
      this.startNeedle = this.knitStartNeedle;
      this.endNeedle = this.startNeedle + this.width;
    } else if (this.alignment === Alignment.RIGHT) {
      this.endNeedle = this.knitEndNeedle;
      this.startNeedle = this.endNeedle - this.width;
    } else {
      // Default to CENTER
      const needleWidth = this.knitEndNeedle - this.knitStartNeedle;
      this.startNeedle =
        this.knitStartNeedle + Math.floor((needleWidth - this.width + 1) / 2);
      this.endNeedle = this.startNeedle + this.width;
    }
  }

  /**
   * Pattern image left edge needle index for preview layout.
   * knitEndNeedle is exclusive (stopNeedle + 1), matching knitEndNeedle on Pattern instances.
   */
  static calcImageStartNeedle(
    alignment: Alignment,
    knitStartNeedle: number,
    knitEndNeedleExclusive: number,
    imageWidth: number,
  ): number {
    if (alignment === Alignment.LEFT) {
      return knitStartNeedle;
    }
    if (alignment === Alignment.RIGHT) {
      return knitEndNeedleExclusive - imageWidth;
    }
    const needleWidth = knitEndNeedleExclusive - knitStartNeedle;
    return knitStartNeedle + Math.floor((needleWidth - imageWidth + 1) / 2);
  }

  /**
   * If image is wider than machine width, extract center section
   * Ensures pattern is at least as wide as (stopNeedle - startNeedle + 1)
   * For SINGLEBED mode: creates expanded rows (num_colors rows per pattern row)
   */
  processPatternData(
    machineWidth: number,
    numColors: number,
    startNeedle?: number,
    stopNeedle?: number,
    knitMode: Mode = Mode.SINGLEBED,
  ): void {
    const imageWidth = this.pattern.width;
    const imageHeight = this.pattern.height;

    // Calculate minimum width needed based on needle range
    // The pattern data should be at least as wide as the distance between start and stop needles
    const needleRange =
      startNeedle !== undefined && stopNeedle !== undefined
        ? stopNeedle - startNeedle + 1
        : machineWidth;
    const minWidth = Math.max(needleRange, 1); // At least 1 pixel wide

    // Extract pattern data: use full image width if it's smaller than machineWidth,
    // but ensure we extract at least minWidth (the needle range)
    // If image is wider, extract center section
    let startCol = 0;
    let extractedWidth = Math.min(imageWidth, machineWidth);

    // If the image is narrower than the minimum needed, use the full image
    // (the alignment logic will handle centering/padding)
    // If the image is wider, extract the center section
    if (imageWidth > machineWidth) {
      // Image is wider than machine - extract center section of machineWidth
      extractedWidth = machineWidth;
      startCol = Math.floor((imageWidth - extractedWidth) / 2);
    } else {
      // Image fits within machine width - use full image width
      extractedWidth = imageWidth;
    }

    // Ensure width/height reflect what was actually packed into patternExpanded
    // (extractedWidth, center-cropped to machineWidth when the source image is
    // wider), not the raw source image dimensions. Consumers like
    // Control.select_needles_API6 derive patternExpanded's row stride from
    // pattern.width - if it stayed at the raw imageWidth, row offsets beyond
    // row 0 would be computed with the wrong stride and read garbled data.
    this.width = extractedWidth;
    this.height = imageHeight;

    // For SINGLEBED mode: patternExpanded has num_colors rows per pattern row
    // Total rows = num_colors * imageHeight
    const totalExpandedRows = numColors * imageHeight;

    // patternExpanded will store bits as a flat array
    // Each row is exactly extractedWidth bits (which is <= machineWidth), packed into bytes
    const bytesPerRow = Math.ceil(extractedWidth / 8);
    const totalBytes = totalExpandedRows * bytesPerRow;
    this.patternExpanded = new Uint8Array(totalBytes);

    const extractedRows: Uint8Array[][] = [];
    for (let patRow = 0; patRow < imageHeight; patRow++) {
      const imageRow = this.pattern.image[patRow] ?? [];
      const outRow: Uint8Array[] = [];
      for (let col = startCol; col < startCol + extractedWidth; col++) {
        outRow.push(imageRow[col] ?? new Uint8Array([255, 255, 255, 255]));
      }
      extractedRows.push(outRow);
    }

    const quantized = quantizeRgbaImage(
      extractedRows,
      extractedWidth,
      imageHeight,
      numColors,
      knitMode,
    );
    this.palette = quantized.palette;

    for (let patRow = 0; patRow < imageHeight; patRow++) {
      for (let color = 0; color < numColors; color++) {
        const expandedRowIndex = numColors * patRow + color;
        const rowOffset = expandedRowIndex * bytesPerRow;

        for (let pixelIndex = 0; pixelIndex < extractedWidth; pixelIndex++) {
          const bitIndex = pixelIndex;
          const byteIndex = Math.floor(bitIndex / 8);
          const bitOffset = bitIndex % 8;
          const colorIndex = quantized.indices[patRow]?.[pixelIndex] ?? 0;
          if (colorIndex === color) {
            this.patternExpanded[rowOffset + byteIndex] |= 1 << bitOffset;
          }
        }
      }
    }
  }

  copy(pattern: Pattern) {
    this.width = pattern.width;
    this.height = pattern.height;
    this.colors = pattern.colors;
    this.startNeedle = pattern.startNeedle;
    this.endNeedle = pattern.endNeedle;
    this.startRow = pattern.startRow;
    this.endRow = pattern.endRow;
  }

  parse(data: Uint8Array) {
    this.width = data[0];
    this.height = data[1];
    this.colors = data[2];
    this.startNeedle = data[3];
    this.endNeedle = data[4];
    this.startRow = data[5];
    this.endRow = data[6];
  }
}
