import { cutToRgbaBits, isCutFileName, isPalFileName } from "./CutPatternConverter";
import {
  dataUrlToBytes,
  PatternImportError,
} from "./PatternImportBinary";
import { isPatFileName, patToRgbaBits } from "./PatPatternConverter";
import { isStpFileName, stpToRgbaBits } from "./StpPatternConverter";
// @ts-ignore - native-only on desktop
import { readFileBytes } from "./ProcessImageNative";

export interface PatternFileSelection {
  dataUrl?: string;
  path?: string;
  fileName?: string;
  /** Optional .pal palette for .cut files */
  paletteDataUrl?: string;
  palettePath?: string;
  paletteFileName?: string;
}

export function isSupportedPatternFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    isPatFileName(fileName) ||
    isStpFileName(fileName) ||
    isCutFileName(fileName)
  );
}

export function resolvePatternFileBytes(selection: PatternFileSelection): Uint8Array {
  if (selection.dataUrl) {
    return dataUrlToBytes(selection.dataUrl);
  }

  if (selection.path) {
    if (typeof readFileBytes !== "function") {
      throw new Error(
        "Native pattern import requires readFileBytes; rebuild the desktop app.",
      );
    }
    const bytes = readFileBytes(selection.path);
    if (!bytes || bytes.length === 0) {
      throw new Error(`Could not read pattern file at ${selection.path}`);
    }
    return bytes;
  }

  throw new Error("No pattern file contents available from file picker.");
}

function resolveOptionalPaletteBytes(
  selection: PatternFileSelection,
): Uint8Array | undefined {
  if (selection.paletteDataUrl) {
    return dataUrlToBytes(selection.paletteDataUrl);
  }
  if (selection.palettePath) {
    if (typeof readFileBytes !== "function") {
      return undefined;
    }
    const bytes = readFileBytes(selection.palettePath);
    return bytes && bytes.length > 0 ? bytes : undefined;
  }
  return undefined;
}

export function loadPatternFromSelection(selection: PatternFileSelection): {
  bits: Uint8Array[][];
  width: number;
  height: number;
} {
  const fileName = selection.fileName ?? "pattern.pat";
  const bytes = resolvePatternFileBytes(selection);
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".pat")) {
    return patToRgbaBits(bytes);
  }
  if (lower.endsWith(".stp")) {
    return stpToRgbaBits(bytes);
  }
  if (lower.endsWith(".cut")) {
    const palette = resolveOptionalPaletteBytes(selection);
    return cutToRgbaBits(bytes, palette);
  }

  throw new PatternImportError(`Unsupported pattern file: ${fileName}`, -4);
}

export {
  isPatFileName,
  isStpFileName,
  isCutFileName,
  isPalFileName,
};

/** @deprecated Use loadPatternFromSelection */
export { loadPatternFromSelection as loadPatFromSelection };
