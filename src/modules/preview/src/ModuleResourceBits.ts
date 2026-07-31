import { getModuleFileEntryAsBytes } from "valdi_core/src/Valdi";
import { decodeBitmap } from "drawing/src/BitmapFactory";
import { SAMPLE_PATTERN_IMAGE_BASE64 } from "./SamplePatternImageData";

/**
 * Decodes bundled sample patterns pixel-exact on native platforms (Android,
 * macOS). Bytes come from SAMPLE_PATTERN_IMAGE_BASE64 (embedded in the JS
 * bundle) first, falling back to `src/patterns/<stem>.png.bin` (see PR notes
 * on github.com/Snapchat/Valdi#116) via getModuleFileEntryAsBytes for any
 * stem not embedded.
 *
 * Not usable on web: both halves of the pipeline are broken there --
 * getModuleFileEntryAsBytes's web runtime is a permanent stub returning
 * '{}' regardless of arguments (github.com/Snapchat/Valdi#128), and
 * decodeBitmap (drawing/src/BitmapFactory) silently decodes real PNG bytes
 * into a bogus 1x1 image on web instead of throwing -- confirmed empirically
 * (correct embedded bytes in, wrong 1x1 bitmap out, no error either side).
 * Web must use embeddedSampleDataUrl + getBitsAsync (canvas decode) instead;
 * see Preview.tsx's loadImageSource.
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

/** A `data:` URL for getBitsAsync/canvas decode -- the path that works on web. */
export function embeddedSampleDataUrl(stem: string): string | undefined {
  const embedded = SAMPLE_PATTERN_IMAGE_BASE64[stem];
  return embedded ? `data:image/png;base64,${embedded}` : undefined;
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
  const embedded = SAMPLE_PATTERN_IMAGE_BASE64[resource.stem];
  const bytes = embedded
    ? Uint8Array.from(atob(embedded), (c) => c.charCodeAt(0))
    : moduleFileBytes(resource.module, resource.stem);
  if (!bytes) {
    return null;
  }
  try {
    return bitsFromBytes(bytes);
  } catch {
    return null;
  }
}
