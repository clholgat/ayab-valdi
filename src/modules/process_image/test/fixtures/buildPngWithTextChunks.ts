const PNG_SIGNATURE: ReadonlyArray<number> = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32BE(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function concat(parts: ReadonlyArray<Uint8Array>): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Uint8Array.from(type, (c) => c.charCodeAt(0));
  const body = concat([typeBytes, data]);
  return concat([writeUint32BE(data.length), body, writeUint32BE(crc32(body))]);
}

function textChunk(keyword: string, text: string): Uint8Array {
  return chunk("tEXt", Uint8Array.from(`${keyword}\x00${text}`, (c) => c.charCodeAt(0)));
}

/**
 * A structurally-valid PNG chunk stream (correct lengths/CRCs, real IHDR)
 * carrying arbitrary `tEXt` entries. The IDAT payload is not a real deflate
 * stream -- fine for testing metadata parsing, which never decodes pixels.
 */
export function buildPngWithTextChunks(
  textEntries: ReadonlyArray<[string, string]>,
  options?: { width?: number; height?: number },
): Uint8Array {
  const width = options?.width ?? 2;
  const height = options?.height ?? 2;
  const ihdr = concat([
    writeUint32BE(width),
    writeUint32BE(height),
    new Uint8Array([8, 6, 0, 0, 0]), // 8-bit RGBA, no interlace
  ]);

  const parts = [
    Uint8Array.from(PNG_SIGNATURE),
    chunk("IHDR", ihdr),
    ...textEntries.map(([keyword, text]) => textChunk(keyword, text)),
    chunk("IDAT", new Uint8Array(0)),
    chunk("IEND", new Uint8Array(0)),
  ];
  return concat(parts);
}
