/**
 * State machine constants.
 * Moved from state_machine/src/Constants.ts to consolidate all constants.
 */

export enum Operation {
  KNIT = 0,
  TEST = 1,
}

export enum StateMachineState {
  CONNECT = 0,
  VERSION_CHECK = 1,
  INIT = 2,
  REQUEST_START = 3,
  CONFIRM_START = 4,
  RUN_KNIT = 5,
  REQUEST_TEST = 6,
  CONFIRM_TEST = 7,
  RUN_TEST = 8,
  DISCONNECT = 9,
  FINISHING = 10,
  FINISHED = 11,
}

// Helper to get state name as string
export function getStateName(state: StateMachineState): string {
  return StateMachineState[state] || "UNKNOWN";
}

/**
 * Knitting mode types
 */
export enum Mode {
  SINGLEBED = 0,
  CLASSIC_RIBBER = 1,
  MIDDLECOLORSTWICE_RIBBER = 2,
  HEARTOFPLUTO_RIBBER = 3,
  CIRCULAR_RIBBER = 4,
}

export namespace Mode {
  export function getLabel(mode: Mode): string {
    switch (mode) {
      case Mode.SINGLEBED:
        return "Singlebed";
      case Mode.CLASSIC_RIBBER:
        return "Ribber: Classic";
      case Mode.MIDDLECOLORSTWICE_RIBBER:
        return "Ribber: Middle-Colors-Twice";
      case Mode.HEARTOFPLUTO_RIBBER:
        return "Ribber: Heart of Pluto";
      case Mode.CIRCULAR_RIBBER:
        return "Ribber: Circular";
      default:
        return "Unknown";
    }
  }

  export function getAllLabels(): string[] {
    return [
      Mode.getLabel(Mode.SINGLEBED),
      Mode.getLabel(Mode.CLASSIC_RIBBER),
      Mode.getLabel(Mode.MIDDLECOLORSTWICE_RIBBER),
      Mode.getLabel(Mode.HEARTOFPLUTO_RIBBER),
      Mode.getLabel(Mode.CIRCULAR_RIBBER),
    ];
  }

  /** Matches ayab-desktop Mode.row_multiplier(). */
  export function rowMultiplier(mode: Mode, numColors: number): number {
    if (mode === Mode.SINGLEBED) {
      return 1;
    }
    if (
      (mode === Mode.CLASSIC_RIBBER && numColors > 2) ||
      mode === Mode.CIRCULAR_RIBBER
    ) {
      return 2 * numColors;
    }
    if (
      mode === Mode.MIDDLECOLORSTWICE_RIBBER ||
      mode === Mode.HEARTOFPLUTO_RIBBER
    ) {
      return 2 * numColors - 2;
    }
    return numColors;
  }

  export function goodNColors(mode: Mode, numColors: number): boolean {
    if (mode === Mode.SINGLEBED || mode === Mode.CIRCULAR_RIBBER) {
      return numColors === 2;
    }
    return numColors >= 2;
  }

  export function knitFunc(mode: Mode, numColors: number): string {
    switch (mode) {
      case Mode.SINGLEBED:
        return "singlebed";
      case Mode.CLASSIC_RIBBER:
        return numColors > 2 ? "classicRibberMulticol" : "classicRibber2col";
      case Mode.MIDDLECOLORSTWICE_RIBBER:
        return "middlecolorstwiceRibber";
      case Mode.HEARTOFPLUTO_RIBBER:
        return "heartofplutoRibber";
      case Mode.CIRCULAR_RIBBER:
        return "circularRibber";
      default:
        return "";
    }
  }

  /** Matches ayab-desktop Mode.flanking_needles() (color A only). */
  export function flankingNeedles(color: number, _numColors: number): boolean {
    return color === 0;
  }
}

/**
 * Pattern alignment types
 */
export enum Alignment {
  CENTER = 0,
  LEFT = 1,
  RIGHT = 2,
}

export namespace Alignment {
  export function getLabel(alignment: Alignment): string {
    switch (alignment) {
      case Alignment.CENTER:
        return "Center";
      case Alignment.LEFT:
        return "Left";
      case Alignment.RIGHT:
        return "Right";
      default:
        return "Unknown";
    }
  }

  export function getAllLabels(): string[] {
    return [
      Alignment.getLabel(Alignment.CENTER),
      Alignment.getLabel(Alignment.LEFT),
      Alignment.getLabel(Alignment.RIGHT),
    ];
  }
}
