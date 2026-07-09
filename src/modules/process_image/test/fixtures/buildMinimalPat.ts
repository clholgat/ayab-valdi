export function buildMinimalPat(options?: {
  width?: number;
  height?: number;
  colorIndex?: number;
  rgb?: [number, number, number];
}): Uint8Array {
  const width = options?.width ?? 2;
  const height = options?.height ?? 2;
  const colorIndex = options?.colorIndex ?? 1;
  const rgb = options?.rgb ?? [255, 0, 0];
  const size = 0x16b;
  let buf = new Uint8Array(size);
  buf.fill(0xff);

  buf[0] = 0x44;
  buf[1] = 0x34;
  buf[2] = 0x43;

  buf[0x13a] = width & 0xff;
  buf[0x13b] = (width >> 8) & 0xff;
  buf[0x13c] = height & 0xff;
  buf[0x13d] = (height >> 8) & 0xff;

  buf[colorIndex + 3] = 0;
  buf[0x105] = rgb[2]!;
  buf[0x106] = rgb[1]!;
  buf[0x107] = rgb[0]!;

  let pos = 0x165;
  for (let row = 0; row < height; row++) {
    buf[pos++] = 0x80 | width;
    buf[pos++] = colorIndex;
  }
  const fePos = 0x165 + height * 2 + 1;
  if (fePos >= buf.length) {
    const next = new Uint8Array(fePos + 1);
    next.set(buf);
    next.fill(0xff, buf.length);
    buf = next;
  }
  buf[fePos] = 0xfe;

  return buf;
}
