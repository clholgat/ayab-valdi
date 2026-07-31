/**
 * PNG text-chunk reading, for recovering metadata that gets stripped by
 * every pixel decoder in this app (canvas ImageData, Skia bitmap decode,
 * Android BitmapFactory, iOS SCValdiImage) — see ayab-desktop PR #779 and
 * ayab-patterns#4, which store AYAB row-memo data in the PNG `Comment` tEXt
 * chunk. Must be read from the raw file bytes, before any of those decoders
 * touch the image.
 */

const PNG_SIGNATURE: ReadonlyArray<number> = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
];

function hasPngSignature(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_SIGNATURE.length) {
    return false;
  }
  return PNG_SIGNATURE.every((byte, i) => bytes[i] === byte);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! << 24) |
    (bytes[offset + 1]! << 16) |
    (bytes[offset + 2]! << 8) |
    bytes[offset + 3]!
  ) >>> 0;
}

function latin1Decode(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]!);
  }
  return out;
}

/**
 * Reads all uncompressed `tEXt` keyword/text pairs from a PNG file's raw
 * bytes. (`zTXt`/`iTXt` are not handled -- AYAB and exiftool's default PNG
 * write both use plain `tEXt`.) Returns an empty map for non-PNG input or a
 * malformed chunk stream, rather than throwing: callers treat "no metadata"
 * and "not a PNG" the same way.
 */
export function readPngTextChunks(bytes: Uint8Array): Map<string, string> {
  const chunks = new Map<string, string>();
  if (!hasPngSignature(bytes)) {
    return chunks;
  }

  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    const type = latin1Decode(bytes.subarray(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (length < 0 || dataEnd + 4 > bytes.length) {
      break;
    }

    if (type === "tEXt") {
      const chunkData = bytes.subarray(dataStart, dataEnd);
      const nullIndex = chunkData.indexOf(0);
      if (nullIndex >= 0) {
        const keyword = latin1Decode(chunkData.subarray(0, nullIndex));
        const text = latin1Decode(chunkData.subarray(nullIndex + 1));
        chunks.set(keyword, text);
      }
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4; // skip CRC
  }

  return chunks;
}

/** The PNG `Comment` tEXt value, or undefined if absent / not a PNG. */
export function readPngComment(bytes: Uint8Array): string | undefined {
  return readPngTextChunks(bytes).get("Comment");
}
