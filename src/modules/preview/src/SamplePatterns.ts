import { Device } from "valdi_core/src/Device";
import { loadCatalog } from "valdi_core/src/AssetCatalog";

export type SamplePatternCategory = "featured" | "kh910";

export interface SamplePattern {
  id: string;
  label: string;
  fileName: string;
  category: SamplePatternCategory;
  /** Native Valdi resource id, e.g. preview:triangles_60x10 */
  resource: string;
  /** Web image registry key. */
  registryKey: string;
  accessibilityId: string;
}

export interface SamplePatternSection {
  id: SamplePatternCategory;
  title: string;
  patterns: SamplePattern[];
}

export type SamplePatternListItem =
  | { kind: "header"; id: string; title: string }
  | { kind: "pattern"; sample: SamplePattern };

const CATALOG_MODULE = "preview/res";

const FEATURED_SPECS: Array<{
  fileName: string;
  label: string;
  id: string;
  accessibilityId: string;
}> = [
  {
    fileName: "triangles_60x10.png",
    label: "Triangles",
    id: "triangles",
    accessibilityId: "preview-sample-triangles",
  },
  {
    fileName: "mushroom_36x36.png",
    label: "Mushroom",
    id: "mushroom",
    accessibilityId: "preview-sample-mushroom",
  },
  {
    fileName: "spaceinvader_33x32.png",
    label: "Invader",
    id: "spaceinvader",
    accessibilityId: "preview-sample-spaceinvader",
  },
  {
    fileName: "stirnband_160x20.png",
    label: "Headband",
    id: "stirnband",
    accessibilityId: "preview-sample-stirnband",
  },
  {
    fileName: "uc3_30x15.png",
    label: "UC3",
    id: "uc3",
    accessibilityId: "preview-sample-uc3",
  },
];

const KH910_FILE_NAMES = [
  "1.01.png",
  "1.02.png",
  "1.03.png",
  "1.04.png",
  "1.05.png",
  "1.06.png",
  "2.07.png",
  "2.08.png",
  "2.09.png",
  "2.10.png",
  "2.11.png",
  "3.12.png",
  "3.13.png",
  "3.14.png",
  "4.15.png",
  "4.16.png",
  "4.17.png",
  "4.18.png",
  "5.19.png",
  "5.20.png",
  "5.21.png",
  "5.22.png",
  "6.23.png",
  "6.24.png",
  "6.25.png",
  "6.26.png",
  "7.27.png",
  "7.28.png",
  "8.29.png",
  "8.30.png",
  "8.31.png",
  "9.32.png",
  "10.33.png",
  "10.34.png",
  "10.35.png",
  "10.36.png",
] as const;

export function patternFileStem(fileName: string): string {
  return fileName.replace(/\.png$/i, "");
}

/** Matches Valdi web image registry keys for preview/res assets. */
export function patternRegistryKey(fileName: string): string {
  const stem = patternFileStem(fileName);
  if (/^\d+\.\d+$/.test(stem)) {
    return stem;
  }

  const parts = stem.split("_");
  const head = parts[0] ?? stem;
  const tail = parts
    .slice(1)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return `${head}${tail}`;
}

function makePattern(
  fileName: string,
  label: string,
  id: string,
  category: SamplePatternCategory,
  accessibilityId: string,
): SamplePattern {
  const stem = patternFileStem(fileName);
  return {
    id,
    label,
    fileName,
    category,
    resource: `preview:${stem}`,
    registryKey: patternRegistryKey(fileName),
    accessibilityId,
  };
}

const FEATURED_PATTERNS: SamplePattern[] = FEATURED_SPECS.map((spec) =>
  makePattern(
    spec.fileName,
    spec.label,
    spec.id,
    "featured",
    spec.accessibilityId,
  ),
);

const KH910_PATTERNS: SamplePattern[] = KH910_FILE_NAMES.map((fileName) => {
  const stem = patternFileStem(fileName);
  return makePattern(
    fileName,
    stem,
    `kh910-${stem.replace(".", "-")}`,
    "kh910",
    `preview-sample-kh910-${stem.replace(".", "-")}`,
  );
});

export const SAMPLE_PATTERN_SECTIONS: SamplePatternSection[] = [
  {
    id: "featured",
    title: "Tutorial patterns",
    patterns: FEATURED_PATTERNS,
  },
  {
    id: "kh910",
    title: "KH-910 patterns",
    patterns: KH910_PATTERNS,
  },
];

export const SAMPLE_PATTERN_LIST_ITEMS: SamplePatternListItem[] =
  SAMPLE_PATTERN_SECTIONS.flatMap((section) => [
    { kind: "header" as const, id: `header-${section.id}`, title: section.title },
    ...section.patterns.map(
      (sample) => ({ kind: "pattern" as const, sample }),
    ),
  ]);

export const SAMPLE_PATTERNS: SamplePattern[] = SAMPLE_PATTERN_SECTIONS.flatMap(
  (section) => section.patterns,
);

export function resolveSamplePatternImageSrc(sample: SamplePattern): string {
  const url = resolveWebImageUrl(sample);
  if (url) {
    return url;
  }
  return sample.resource;
}

export function resolveSamplePatternSource(sample: SamplePattern): string {
  const url = resolveWebImageUrl(sample);
  if (url) {
    return url;
  }
  return sample.resource;
}

function resolveWebImageUrl(sample: SamplePattern): string | undefined {
  if (!Device.isWeb()) {
    return undefined;
  }

  const catalog = loadCatalog(CATALOG_MODULE) as Record<
    string,
    { src?: string } | undefined
  >;
  const catalogKeys = [
    sample.registryKey,
    sample.registryKey.replace(/\./g, ""),
  ];
  for (const key of catalogKeys) {
    const src = catalog[key]?.src;
    if (typeof src === "string" && src.length > 0) {
      return src;
    }
  }

  const registry = (
    globalThis as typeof globalThis & {
      __valdiImageRegistry?: Record<
        string,
        Record<string, { default?: string } | string>
      >;
    }
  ).__valdiImageRegistry?.[CATALOG_MODULE];
  const entry = registry?.[sample.registryKey];
  if (typeof entry === "string") {
    return entry;
  }
  if (entry && typeof entry === "object" && "default" in entry) {
    const value = entry.default;
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}
