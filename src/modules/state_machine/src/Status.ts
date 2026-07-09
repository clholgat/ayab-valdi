export enum Direction {
  Unknown = 0,
  Left = 1,
  Right = 2,
}

export namespace Direction {
  export function reverse(direction: Direction): Direction {
    if (direction === Direction.Left) {
      return Direction.Right;
    } else if (direction === Direction.Right) {
      return Direction.Left;
    } else {
      return Direction.Unknown;
    }
  }
  export function symbol(direction: Direction): string {
    if (direction === Direction.Left) {
      return "←";
    } else if (direction === Direction.Right) {
      return "→";
    } else {
      return "";
    }
  }

  export function text(direction: Direction): string {
    if (direction === Direction.Left) {
      return "Left";
    } else if (direction === Direction.Right) {
      return "Right";
    } else {
      return "";
    }
  }
}

export enum Carriage {
  Unknown = 0,
  Knit = 1,
  Lace = 2,
  Garter = 3,
}

export namespace Carriage {
  export function symbol(carriage: Carriage): string {
    if (carriage === Carriage.Knit) {
      return "K";
    } else if (carriage === Carriage.Lace) {
      return "L";
    } else if (carriage === Carriage.Garter) {
      return "G";
    } else {
      return "";
    }
  }

  export function text(carriage: Carriage): string {
    if (carriage === Carriage.Knit) {
      return "Knit";
    } else if (carriage === Carriage.Lace) {
      return "Lace";
    } else if (carriage === Carriage.Garter) {
      return "Garter";
    } else {
      return "";
    }
  }
}

export type ColorSymbolType = "" | "A" | "B" | "C" | "D" | "E" | "F";

export class Status {
  active: boolean = true;
  altColor: number | null = null;
  machineWidth: number = -1;
  knitStartNeedle: number = -1;
  /** Number of needles in status.bits (after slicing to knit window). */
  knitNeedleCount: number = 0;
  passesPerRow: number = 1;
  bits: Uint8Array = new Uint8Array();
  color: number = -1;
  colorSymbol: ColorSymbolType = "";
  currentRow: number = -1;
  firmwareState: number = -1;
  lineNumber: number = -1;
  repeats: number = -1;
  totalRows: number = -1;
  carriageDirection: Direction = Direction.Unknown;
  carriagePosition: number = -1;
  carriageType: Carriage = Carriage.Unknown;
  hallL: number = 0;
  hallR: number = 0;

  constructor() {
    this.reset();
  }

  reset() {
    this.active = true;
    this.altColor = null;
    this.machineWidth = -1;
    this.knitStartNeedle = -1;
    this.knitNeedleCount = 0;
    this.passesPerRow = 1;
    this.bits = new Uint8Array();
    this.color = -1;
    this.colorSymbol = "";
    this.currentRow = -1;
    this.firmwareState = -1;
    this.lineNumber = -1;
    this.repeats = -1;
    this.totalRows = -1;
    this.carriageDirection = Direction.Unknown;
    this.carriagePosition = -1;
    this.carriageType = Carriage.Unknown;
    this.hallL = 0;
    this.hallR = 0;
  }

  copy(status: Status) {
    this.active = status.active;
    this.altColor = status.altColor;
    this.machineWidth = status.machineWidth;
    this.knitStartNeedle = status.knitStartNeedle;
    this.knitNeedleCount = status.knitNeedleCount;
    this.passesPerRow = status.passesPerRow;
    this.bits = status.bits;
    this.color = status.color;
    this.colorSymbol = status.colorSymbol;
    this.currentRow = status.currentRow;
    this.firmwareState = status.firmwareState;
    this.lineNumber = status.lineNumber;
    this.repeats = status.repeats;
    this.totalRows = status.totalRows;
    this.carriageDirection = status.carriageDirection;
    this.carriagePosition = status.carriagePosition;
    this.carriageType = status.carriageType;
  }

  parseDeviceState(state: number, msg: Uint8Array) {
    if (!this.active) {
      return;
    }

    // firmwareState is at msg[2] (the 'state' parameter is actually msg[1], the error code)
    // Note: Python has this commented out, but we set it correctly per firmware spec
    this.firmwareState = msg.length > 2 ? msg[2] : 0;
    this.hallL = (msg[3] << 8) + msg[4];
    this.hallR = (msg[5] << 8) + msg[6];
    this.parseState(msg);
  }

  private parseState(msg: Uint8Array) {
    // Map firmware values to Carriage enum (firmware: 0=Knit, 1=Lace, 2=Garter)
    if (msg[7] === 0) {
      this.carriageType = Carriage.Knit;
    } else if (msg[7] === 1) {
      this.carriageType = Carriage.Lace;
    } else if (msg[7] === 2) {
      this.carriageType = Carriage.Garter;
    } else {
      this.carriageType = Carriage.Unknown;
    }
    this.carriagePosition = msg[8];
    // Map firmware values to Direction enum (firmware: 0=Left, 1=Right)
    if (msg[9] === 0) {
      this.carriageDirection = Direction.Left;
    } else if (msg[9] === 1) {
      this.carriageDirection = Direction.Right;
    } else {
      this.carriageDirection = Direction.Unknown;
    }
  }
}
