// Mode and Alignment have been moved to constants/src/StateMachineConstants.ts
// to break the circular dependency between app_settings and image_settings
export { Mode, Alignment } from "constants/src/StateMachineConstants";

/**
 * Needle color types (for start/stop needle selection)
 */
export enum NeedleColor {
  ORANGE = 0, // Left side
  GREEN = 1, // Right side
}

export namespace NeedleColor {
  export function getLabel(color: NeedleColor): string {
    switch (color) {
      case NeedleColor.ORANGE:
        return "Left bed";
      case NeedleColor.GREEN:
        return "Right bed";
      default:
        return "Unknown";
    }
  }

  export function getAllLabels(): string[] {
    return [
      NeedleColor.getLabel(NeedleColor.ORANGE),
      NeedleColor.getLabel(NeedleColor.GREEN),
    ];
  }

  /**
   * Calculate actual needle position from color and offset
   */
  export function calculateNeedle(
    color: NeedleColor,
    offset: number,
    machineWidth: number,
  ): number {
    if (color === NeedleColor.ORANGE) {
      return machineWidth / 2 - offset;
    } else {
      return machineWidth / 2 + offset - 1;
    }
  }
}
