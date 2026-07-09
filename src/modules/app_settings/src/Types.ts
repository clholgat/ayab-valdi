/**
 * Aspect ratio types for pattern display
 */
export enum AspectRatio {
  DEFAULT = 0, // 1:1
  FAIRISLE = 1, // 4:5
}

export namespace AspectRatio {
  export function getLabel(ratio: AspectRatio): string {
    switch (ratio) {
      case AspectRatio.DEFAULT:
        return "1:1";
      case AspectRatio.FAIRISLE:
        return "4:5";
      default:
        return "Unknown";
    }
  }

  export function getAllLabels(): string[] {
    return [
      AspectRatio.getLabel(AspectRatio.DEFAULT),
      AspectRatio.getLabel(AspectRatio.FAIRISLE),
    ];
  }
}

/**
 * Language type - stored as locale string (e.g., "en_US", "de_DE")
 */
export type Language = string;
