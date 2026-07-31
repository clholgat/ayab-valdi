import { getModuleFileEntryAsBytes } from "valdi_core/src/Valdi";
import { decodeBitmap } from "drawing/src/BitmapFactory";

/**
 * Reads bundled sample patterns byte-exact through Valdi's `.bin` module-entry
 * mechanism. The local Valdi web-resource patch makes the same API work in a
 * browser; native platforms already read these entries from `.valdimodule`.
 *
 * `decodeBitmap` remains a deliberate 1x1 stub on web, so browser callers turn
 * the exact bytes into a data URL and use the asynchronous canvas decoder.
 */

const PNG_SIGNATURE: ReadonlyArray<number> = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
];

function looksLikePng(bytes: Uint8Array): boolean {
  return (
    bytes.length > PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)
  );
}

export function parseModuleResource(
  source: string,
): { module: string; stem: string } | null {
  // Paths and URI schemes (file:, content:, /abs, C:\) are not module refs.
  if (source.includes("/") || source.includes("\\")) {
    return null;
  }
  const colon = source.indexOf(":");
  if (colon <= 0 || colon === source.length - 1) {
    return null;
  }
  return { module: source.substring(0, colon), stem: source.substring(colon + 1) };
}

function moduleFileBytes(module: string, stem: string): Uint8Array | null {
  let bytes: Uint8Array;
  try {
    bytes = getModuleFileEntryAsBytes(module, `src/patterns/${stem}.png.bin`);
  } catch {
    return null;
  }
  return bytes && looksLikePng(bytes) ? bytes : null;
}

/** A data URL backed by the exact bundled bytes for web canvas decoding. */
export function moduleResourceDataUrl(source: string): string | undefined {
  const resource = parseModuleResource(source);
  if (!resource) {
    return undefined;
  }
  const bytes = moduleFileBytes(resource.module, resource.stem);
  if (!bytes) {
    return undefined;
  }
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

function bitsFromBytes(bytes: Uint8Array): Uint8Array[][] {
  const bitmap = decodeBitmap(bytes);
  try {
    const info = bitmap.getInfo();
    const rowBytes = info.rowBytes;
    return bitmap.accessPixels((view: DataView) => {
      const bits: Uint8Array[][] = [];
      for (let y = 0; y < info.height; y++) {
        const row: Uint8Array[] = [];
        for (let x = 0; x < info.width; x++) {
          const i = y * rowBytes + x * 4;
          row.push(
            new Uint8Array([
              view.getUint8(i),
              view.getUint8(i + 1),
              view.getUint8(i + 2),
              view.getUint8(i + 3),
            ]),
          );
        }
        bits.push(row);
      }
      return bits;
    });
  } finally {
    bitmap.dispose();
  }
}

/** Rows of [R, G, B, A] pixel byte arrays, one per stitch, at source size. Native only -- see module doc. */
export async function loadModuleResourceBits(
  source: string,
): Promise<Uint8Array[][] | null> {
  const resource = parseModuleResource(source);
  if (!resource) {
    return null;
  }
  const bytes = moduleFileBytes(resource.module, resource.stem);
  if (!bytes) {
    return null;
  }
  try {
    return bitsFromBytes(bytes);
  } catch {
    return null;
  }
}
