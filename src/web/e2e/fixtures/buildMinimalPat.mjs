/**
 * Minimal valid DAK .pat fixture (2×2 solid red) for E2E and manual testing.
 */

export function buildMinimalPat(options = {}) {
  const width = options.width ?? 2;
  const height = options.height ?? 2;
  const colorIndex = options.colorIndex ?? 1;
  const rgb = options.rgb ?? [255, 0, 0];
  const size = 0x16b;
  const buf = Buffer.alloc(size, 0xff);

  buf[0] = 0x44;
  buf[1] = 0x34;
  buf[2] = 0x43;

  buf.writeUInt16LE(width, 0x13a);
  buf.writeUInt16LE(height, 0x13c);

  buf[colorIndex + 3] = 0;
  buf[0x105] = rgb[2];
  buf[0x106] = rgb[1];
  buf[0x107] = rgb[0];

  let pos = 0x165;
  for (let row = 0; row < height; row++) {
    buf[pos++] = 0x80 | width;
    buf[pos++] = colorIndex;
  }
  buf[0x16a] = 0xfe;

  return buf;
}
