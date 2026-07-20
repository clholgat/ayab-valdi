import { getModuleFileEntryAsBytes } from "valdi_core/src/Valdi";
import {
  addAssetLoadObserver,
  AssetOutputType,
} from "valdi_core/src/Asset";
import { decodeBitmap } from "drawing/src/BitmapFactory";
import { SAMPLE_PATTERN_IMAGE_BASE64 } from "./SamplePatternImageData";

/**
 * Decodes bundled sample patterns pixel-exact on every platform. Sample
 * bytes come from SAMPLE_PATTERN_IMAGE_BASE64 (embedded in the JS bundle)
 * rather than the module's packaged res/ files: on Android, res/*.png gets
 * re-encoded into per-density WebP drawables, and both the direct file-entry
 * lookup and the asset-load observer below ultimately resolve through that
 * same drawable pipeline, so neither actually yields the original bytes.
 * WebP is lossy and density-scales the image, which turns hard black/white
 * stitch edges into gray compression artifacts. The lookups below remain as
 * a fallback for resources outside the embedded set.
 */

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
  // Sample PNG bytes ship twice: as regular res images (for <image> display)
  // and as res/<stem>.raw passthrough copies, because the compiler resamples
  // res images into density variants (Android would decode a blurry,
  // wrong-sized webp). Unrecognized extensions pass through untouched.
  for (const candidate of [`${stem}.raw`, `res/${stem}.raw`, `${stem}.png`, `res/${stem}.png`]) {
    try {
      return getModuleFileEntryAsBytes(module, candidate);
    } catch {
      // Try the next layout.
    }
  }
  return null;
}

function assetBytes(source: string): Promise<Uint8Array | null> {
  return new Promise(resolve => {
    let unsubscribe: (() => void) | null = null;
    let finished = false;
    const finish = (bytes: Uint8Array | null): void => {
      if (finished) {
        return;
      }
      finished = true;
      resolve(bytes);
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };
    const subscription = addAssetLoadObserver(
      source,
      (loaded, error) => {
        if (error != null || !(loaded instanceof Uint8Array)) {
          finish(null);
          return;
        }
        finish(loaded);
      },
      AssetOutputType.BYTES,
    );
    if (finished) {
      subscription.unsubscribe();
    } else {
      unsubscribe = subscription.unsubscribe;
    }
  });
}

function bitsFromEncodedBytes(bytes: Uint8Array | string): Uint8Array[][] | null {
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

/** Rows of [R, G, B, A] pixel byte arrays, one per stitch, at source size. */
export async function loadModuleResourceBits(
  source: string,
): Promise<Uint8Array[][] | null> {
  const resource = parseModuleResource(source);
  if (!resource) {
    return null;
  }
  const embedded = SAMPLE_PATTERN_IMAGE_BASE64[resource.stem];
  if (embedded) {
    try {
      return bitsFromEncodedBytes(embedded);
    } catch {
      return null;
    }
  }
  const direct = moduleFileBytes(resource.module, resource.stem);
  const bytes = direct ?? (await assetBytes(source));
  if (!bytes) {
    return null;
  }
  try {
    return bitsFromEncodedBytes(bytes);
  } catch {
    return null;
  }
}
