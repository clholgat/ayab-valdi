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
  const colon = source.indexOf(":");
  if (colon <= 0 || colon === source.length - 1) {
    return null;
  }
  const module = source.substring(0, colon);
  const stem = source.substring(colon + 1);
  // Allow nested module entries such as preview:annotated/stitchworld-004,
  // while rejecting paths, data URLs, and arbitrary URI schemes.
  const stemSegments = stem.split("/");
  if (
    !/^[A-Za-z0-9_.-]+$/.test(module) ||
    stemSegments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        !/^[A-Za-z0-9_.-]+$/.test(segment),
    )
  ) {
    return null;
  }
  return { module, stem };
}

export function moduleEntryBytesFromWebRegistry(
  entries: Record<string, string> | undefined,
  path: string,
): Uint8Array | null {
  if (!entries) return null;
  const encoded =
    entries[path] ??
    Object.entries(entries).find(([key]) => key.endsWith(`/${path}`))?.[1];
  if (typeof encoded !== "string") return null;
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function moduleFileBytes(module: string, stem: string): Uint8Array | null {
  const path = `src/patterns/${stem}.png.bin`;
  let bytes: Uint8Array | null = null;
  try {
    bytes = getModuleFileEntryAsBytes(module, path);
  } catch {
    // The collapsed web package prefixes source-repository paths onto module
    // entries. Fall through to a suffix lookup in that generated registry.
  }
  if (!bytes || !looksLikePng(bytes)) {
    const registry = (
      globalThis as typeof globalThis & {
        __valdiModuleEntries?: Record<string, Record<string, string>>;
      }
    ).__valdiModuleEntries;
    bytes = moduleEntryBytesFromWebRegistry(registry?.[module], path);
  }
  return bytes && looksLikePng(bytes) ? bytes : null;
}

/** Exact source bytes for metadata readers (pixel decoders discard PNG comments). */
export function moduleResourceBytes(source: string): Uint8Array | undefined {
  const resource = parseModuleResource(source);
  if (!resource) return undefined;
  return moduleFileBytes(resource.module, resource.stem) ?? undefined;
}

/** A data URL backed by the exact bundled bytes for web canvas decoding. */
export function moduleResourceDataUrl(source: string): string | undefined {
  const resource = parseModuleResource(source);
  if (!resource) {
    return undefined;
  }
  const bytes = moduleResourceBytes(source);
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
