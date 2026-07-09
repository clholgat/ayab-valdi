import { Mode } from "constants/src/StateMachineConstants";

export interface QuantizedPattern {
  /** Row-major color indices [row][col] */
  indices: number[][];
  /** RGB palette as 0xRRGGBB */
  palette: number[];
}

function rgbToInt(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

function colorDistance(
  r: number,
  g: number,
  b: number,
  pr: number,
  pg: number,
  pb: number,
): number {
  const dr = r - pr;
  const dg = g - pg;
  const db = b - pb;
  return dr * dr + dg * dg + db * db;
}

function nearestPaletteIndex(
  r: number,
  g: number,
  b: number,
  palette: Array<[number, number, number]>,
): number {
  let best = 0;
  let bestDist = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i]!;
    const dist = colorDistance(r, g, b, pr, pg, pb);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** Median-cut style palette from pixel samples (desktop PIL quantize parity). */
export function buildPaletteFromSamples(
  samples: Array<[number, number, number]>,
  numColors: number,
): Array<[number, number, number]> {
  if (samples.length === 0 || numColors <= 0) {
    return [[0, 0, 0]];
  }
  if (numColors === 1) {
    return [samples[0]!];
  }

  type Box = { pixels: Array<[number, number, number]> };
  const boxes: Box[] = [{ pixels: samples.slice() }];

  while (boxes.length < numColors) {
    boxes.sort((a, b) => b.pixels.length - a.pixels.length);
    const box = boxes.shift()!;
    if (box.pixels.length <= 1) {
      boxes.push(box);
      break;
    }

    let minR = 255;
    let maxR = 0;
    let minG = 255;
    let maxG = 0;
    let minB = 255;
    let maxB = 0;
    for (const [r, g, b] of box.pixels) {
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      minG = Math.min(minG, g);
      maxG = Math.max(maxG, g);
      minB = Math.min(minB, b);
      maxB = Math.max(maxB, b);
    }
    const rangeR = maxR - minR;
    const rangeG = maxG - minG;
    const rangeB = maxB - minB;
    const channel =
      rangeR >= rangeG && rangeR >= rangeB ? 0 : rangeG >= rangeB ? 1 : 2;

    box.pixels.sort((a, b) => a[channel]! - b[channel]!);
    const mid = Math.floor(box.pixels.length / 2);
    boxes.push({ pixels: box.pixels.slice(0, mid) });
    boxes.push({ pixels: box.pixels.slice(mid) });
  }

  const palette: Array<[number, number, number]> = [];
  for (const box of boxes.slice(0, numColors)) {
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    for (const [r, g, b] of box.pixels) {
      rSum += r;
      gSum += g;
      bSum += b;
    }
    const count = Math.max(box.pixels.length, 1);
    palette.push([
      Math.round(rSum / count),
      Math.round(gSum / count),
      Math.round(bSum / count),
    ]);
  }

  while (palette.length < numColors) {
    palette.push(palette[palette.length - 1] ?? [0, 0, 0]);
  }

  return palette;
}

export function orderPaletteByFrequency(
  indices: number[][],
  palette: Array<[number, number, number]>,
  mode: Mode,
): { indices: number[][]; palette: number[] } {
  const counts = new Array(palette.length).fill(0);
  for (const row of indices) {
    for (const idx of row) {
      counts[idx] = (counts[idx] ?? 0) + 1;
    }
  }

  let destMap: number[];
  if (mode === Mode.SINGLEBED) {
    destMap = palette.map((_c, i) => i);
  } else {
    destMap = palette
      .map((_c, i) => i)
      .sort((a, b) => (counts[a] ?? 0) - (counts[b] ?? 0));
  }
  // Desktop always reverses so palette index 0 is the last quantize bucket.
  destMap.reverse();

  const inverseRemap = new Map<number, number>();
  destMap.forEach((oldIdx, newIdx) => {
    inverseRemap.set(oldIdx, newIdx);
  });

  const remappedIndices = indices.map((row) =>
    row.map((idx) => inverseRemap.get(idx) ?? idx),
  );
  const remappedPalette = destMap.map((oldIdx) => {
    const [pr, pg, pb] = palette[oldIdx]!;
    return rgbToInt(pr, pg, pb);
  });

  return { indices: remappedIndices, palette: remappedPalette };
}

export function quantizeRgbaImage(
  rows: Uint8Array[][],
  width: number,
  height: number,
  numColors: number,
  mode: Mode,
): QuantizedPattern {
  const samples: Array<[number, number, number]> = [];
  for (let y = 0; y < height; y++) {
    const row = rows[y] ?? [];
    for (let x = 0; x < width; x++) {
      const px = row[x];
      if (px) {
        samples.push([px[0]!, px[1]!, px[2]!]);
      }
    }
  }

  const paletteRgb = buildPaletteFromSamples(samples, numColors);
  const indices: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row = rows[y] ?? [];
    const outRow: number[] = [];
    for (let x = 0; x < width; x++) {
      const px = row[x];
      if (!px) {
        outRow.push(0);
        continue;
      }
      outRow.push(
        nearestPaletteIndex(px[0]!, px[1]!, px[2]!, paletteRgb),
      );
    }
    indices.push(outRow);
  }

  const ordered = orderPaletteByFrequency(indices, paletteRgb, mode);
  return ordered;
}
