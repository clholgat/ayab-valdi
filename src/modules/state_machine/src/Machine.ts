export enum Machine {
  KH910_KH950 = 0,
  KH900_KH930_KH940_KH965 = 1,
  KH270 = 2,
}

export namespace Machine {
  export function width(machine: Machine): number {
    if (machine === Machine.KH270) {
      return 112;
    } else {
      return 200;
    }
  }

  /** Display labels matching ayab-desktop Machine.add_items(). */
  export function getLabel(machine: Machine): string {
    switch (machine) {
      case Machine.KH910_KH950:
        return "KH-910, KH-950i";
      case Machine.KH900_KH930_KH940_KH965:
        return "KH-900, KH-930, KH-940, KH-965i";
      case Machine.KH270:
        return "KH-270";
      default:
        return "Unknown";
    }
  }

  export function getAllLabels(): string[] {
    return [
      Machine.getLabel(Machine.KH910_KH950),
      Machine.getLabel(Machine.KH900_KH930_KH940_KH965),
      Machine.getLabel(Machine.KH270),
    ];
  }
}
