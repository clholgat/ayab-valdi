import { Communication } from "./Communication";
import { CommunicationMock } from "./CommunicationMock";
import { HardwareTestCommunicationMock } from "./HardwareTestCommunicationMock";
import { Status, Carriage, Direction } from "state_machine/src/Status";
import { Pattern } from "state_machine/src/Pattern";
import { Preferences } from "app_settings/src/Preferences";
import {
  StateMachineState,
  Operation,
  Mode,
} from "constants/src/StateMachineConstants";
import {
  Token,
  BLOCK_LENGTH,
  FIRST_SUPPORTED_API_VERSION,
} from "constants/src/SerialConstants";
import {
  COLOR_SYMBOLS,
  FLANKING_NEEDLES,
} from "constants/src/KnittingConstants";
import { StateMachine } from "state_machine/src/StateMachine";
import { Output } from "state_machine/src/Output";
import { Machine } from "state_machine/src/Machine";
import { IControl, ICommunication } from "constants/src/Interfaces";
import {
  ModeFuncControl,
  ModeFuncType,
  resolveModeFunc,
} from "state_machine/src/ModeFunc";

function bytesToAscii(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]!);
  }
  return result;
}

function getNeedleBit(bits: Uint8Array, needleIndex: number): boolean {
  if (needleIndex < 0) return false;
  const byteIndex = Math.floor(needleIndex / 8);
  if (byteIndex >= bits.length) return false;
  return ((bits[byteIndex]! >> (needleIndex % 8)) & 1) !== 0;
}

function setNeedleBit(bits: Uint8Array, needleIndex: number): void {
  const byteIndex = Math.floor(needleIndex / 8);
  bits[byteIndex] = (bits[byteIndex] ?? 0) | (1 << (needleIndex % 8));
}

/** Slice packed needle bits to knit window (matches Python bits[start:end]). */
function sliceNeedleBits(
  full: Uint8Array,
  startNeedle: number,
  needleCount: number,
): Uint8Array {
  if (needleCount <= 0) {
    return new Uint8Array();
  }
  const out = new Uint8Array(Math.ceil(needleCount / 8));
  for (let i = 0; i < needleCount; i++) {
    if (getNeedleBit(full, startNeedle + i)) {
      setNeedleBit(out, i);
    }
  }
  return out;
}

/** Matches ayab-desktop Mode.row_multiplier(). */
function passesPerRowForMode(mode: Mode, numColors: number): number {
  return Mode.rowMultiplier(mode, numColors);
}

export class Control implements IControl {
  static readonly BLOCK_LENGTH = BLOCK_LENGTH;
  static readonly COLOR_SYMBOLS = COLOR_SYMBOLS;
  static readonly FIRST_SUPPORTED_API_VERSION = FIRST_SUPPORTED_API_VERSION;
  static readonly FLANKING_NEEDLES = FLANKING_NEEDLES;

  com!: ICommunication;
  continuous_reporting: boolean = false;
  end_needle: number = 0;
  end_pixel: number = 0;
  former_request: number = 0;
  inf_repeat: boolean = false;
  initial_carriage: Carriage = Carriage.Unknown;
  initial_direction: Direction = Direction.Unknown;
  initial_position: number = -1;
  len_pat_expanded: number = 0;
  line_block: number = 0;
  mode!: Mode;
  mode_func!: ModeFuncType;
  num_colors: number = 0;
  passes_per_row: number = 0;
  pat_height: number = 0;
  pat_row: number = 0;
  pattern!: Pattern;
  pattern_repeats: number = 0;
  portname: string = "";
  prefs!: Preferences;
  start_needle: number = 0;
  start_pixel: number = 0;
  start_row: number = 0;
  state: StateMachineState = StateMachineState.CONNECT;
  status: Status;
  machine!: Machine;
  api_version: number;
  notification: Output;
  /** Called when testRes serial messages arrive during Operation.TEST. */
  onTestOutput?: (text: string) => void;

  constructor() {
    this.api_version = FIRST_SUPPORTED_API_VERSION;
    this.notification = Output.NONE;
    this.status = new Status();
  }

  start(pattern: Pattern, options: any, operation: Operation): void {
    this.machine = options.machine;
    if (operation === Operation.KNIT) {
      this.former_request = 0;
      this.line_block = 0;
      this.pattern_repeats = 0;
      this.pattern = pattern;
      this.pat_height = pattern.height;
      this.num_colors = options.num_colors;
      this.start_row = options.start_row;
      this.mode = options.mode;
      this.inf_repeat = options.inf_repeat;
      this.continuous_reporting = options.continuous_reporting;
      this.prefs = options.prefs;
      this.len_pat_expanded = this.pat_height * this.num_colors;
      this.passes_per_row = passesPerRowForMode(
        options.mode as Mode,
        this.num_colors,
      );
      // Calculate start_needle and end_needle from pattern's pat_start_needle and pat_width
      // This matches Python: self.start_needle = max(0, self.pattern.pat_start_needle)
      //                    self.end_needle = min(self.pattern.pat_width + self.pattern.pat_start_needle, self.machine.width)
      this.start_needle = Math.max(0, pattern.startNeedle);
      this.end_needle = Math.min(
        pattern.width + pattern.startNeedle,
        Machine.width(this.machine),
      );
      this.start_pixel = this.start_needle - pattern.startNeedle;
      this.end_pixel = this.end_needle - pattern.startNeedle;
      this.initial_carriage = Carriage.Unknown;
      this.initial_position = -1;
      this.initial_direction = Direction.Unknown;

      // Process pattern data to populate patternExpanded
      // This extracts center section if image is wider than machine and converts to bit format
      // Ensures pattern is at least as wide as the needle range
      const machineWidth = Machine.width(this.machine);
      pattern.processPatternData(
        machineWidth,
        this.num_colors,
        pattern.knitStartNeedle,
        pattern.knitEndNeedle - 1,
        this.mode,
      );

      this.reset_status();
    } else {
      this.prefs = options.prefs;
    }
    this.portname = options.portname;
    this.state = StateMachineState.CONNECT;

    if (this.portname !== "Simulation") {
      this.com = new Communication();
    } else if (operation === Operation.TEST) {
      this.com = new HardwareTestCommunicationMock();
    } else {
      this.com = new CommunicationMock();
    }
  }

  stop(): void {
    try {
      if (this.com) {
        try {
          if (this.com.isOpen()) {
            this.com.reqQuit();
          }
        } catch (_e) {
          // Best-effort: firmware may already be gone.
        }
        this.com.closeSerial();
      }
    } catch (e) {
      // Ignore errors
    }
  }

  func_selector(): boolean {
    if (!Mode.goodNColors(this.mode, this.num_colors)) {
      console.error("Wrong number of colours for the knitting mode");
      return false;
    }
    const fn = resolveModeFunc(this.mode, this.num_colors);
    if (fn == null) {
      console.error("Unrecognized value returned from Mode.knit_func()");
      return false;
    }
    this.mode_func = fn;
    return true;
  }

  reset_status(): void {
    this.status.reset();
    if (this.mode === Mode.SINGLEBED) {
      if (this.pattern?.palette && this.pattern.palette.length >= 2) {
        this.status.altColor = this.pattern.palette[1]!;
      } else {
        this.status.altColor = 0xffffff;
      }
      this.status.colorSymbol = "";
    } else {
      this.status.altColor = null;
    }
    if (this.machine) {
      this.status.machineWidth = Machine.width(this.machine);
    }
    if (Control.FLANKING_NEEDLES && this.mode !== Mode.SINGLEBED) {
      this.status.knitStartNeedle = this.pattern.knitStartNeedle;
      this.status.knitNeedleCount = Math.max(
        0,
        this.pattern.knitEndNeedle - this.pattern.knitStartNeedle,
      );
    } else {
      this.status.knitStartNeedle = this.start_needle;
      this.status.knitNeedleCount = Math.max(
        0,
        this.end_needle - this.start_needle,
      );
    }
    this.status.passesPerRow = this.passes_per_row;
  }

  check_serial_API6(): [Token, number] {
    const [msg, token, param] = this.com.update_API6();
    if (msg === null) {
      return [Token.none, param];
    }
    if (token === Token.cnfInfo) {
      this._log_cnfInfo(msg);
    } else if (token === Token.indState) {
      this.status.parseDeviceState(param, msg);
    } else if (token === Token.testRes) {
      if (msg.length > 1) {
        const text = bytesToAscii(msg.slice(1));
        this.onTestOutput?.(text);
      }
    }
    return [token, param];
  }

  check_serial_API6_async(): any {
    const self = this;
    // Promise is available at runtime in Valdi (polyfilled)
    const PromiseConstructor = (function () {
      try {
        // eslint-disable-next-line no-eval
        return eval("Promise");
      } catch (e) {
        throw new Error("Promise not available");
      }
    })();
    return this.com.update_API6_async().then(function ([msg, token, param]: [
      Uint8Array | null,
      Token,
      number,
    ]) {
      if (msg === null) {
        return [Token.none, param];
      }
      if (token === Token.cnfInfo) {
        self._log_cnfInfo(msg);
      } else if (token === Token.cnfInit) {
        self._log_cnfInit(param);
      } else if (token === Token.indState) {
        self.status.parseDeviceState(param, msg);
      } else if (token === Token.testRes) {
        if (msg.length > 1) {
          const text = bytesToAscii(msg.slice(1));
          self.onTestOutput?.(text);
        }
      }
      return [token, param];
    });
  }

  private _log_cnfInfo(msg: Uint8Array): void {
    // Log raw message for debugging
    const hexStr = Array.from(msg)
      .map((b) => "0x" + b.toString(16).padStart(2, "0").toUpperCase())
      .join(" ");
    console.log(
      "_log_cnfInfo: Raw message (" + msg.length + " bytes):",
      hexStr,
    );

    const api = msg[1];
    console.log("");
    console.log("═══════════════════════════════════════════════════════");
    console.log("  Version Information Received");
    console.log("═══════════════════════════════════════════════════════");
    console.log("  API Version:  ", api);
    if (api >= 5) {
      const major = msg[2];
      const minor = msg[3];
      const patch = msg[4];
      console.log("  Firmware:     v" + major + "." + minor + "." + patch);
      const suffix = msg.slice(5, 21);
      const suffixNullIndex = suffix.indexOf(0);
      if (suffixNullIndex >= 0) {
        const suffixStr = new TextDecoder().decode(
          suffix.slice(0, suffixNullIndex + 1),
        );
        if (suffixStr.length > 1) {
          console.log("  Build:        " + suffixStr);
        }
      }
    }
    console.log("═══════════════════════════════════════════════════════");
    console.log("");
  }

  private _log_cnfInit(errorCode: number): void {
    console.log("");
    console.log("═══════════════════════════════════════════════════════");
    console.log("  Initialization Response Received");
    console.log("═══════════════════════════════════════════════════════");
    if (errorCode === 0) {
      console.log("  Status:       Success");
      console.log("  Message:      Firmware initialized successfully");
    } else {
      console.log("  Status:       Warning (error code " + errorCode + ")");
      if (errorCode === 4) {
        console.log("  Message:      Waiting for carriage detection");
        console.log("  Note:         This is expected - firmware will send");
        console.log("                carriage status (indState) next");
      } else {
        console.log(
          "  Message:      Initialization error (code: " + errorCode + ")",
        );
      }
    }
    console.log("═══════════════════════════════════════════════════════");
    console.log("");
  }

  cnf_line_API6(line_number: number): boolean {
    if (!(line_number < BLOCK_LENGTH)) {
      // TODO: Log error
      return true; // stop knitting
    }
    // TODO: some better algorithm for block wrapping
    if (this.former_request === BLOCK_LENGTH - 1 && line_number === 0) {
      // wrap to next block of lines
      this.line_block += 1;
    }
    // requested line number should either be
    // the same as the previous request, or the next line
    else if (
      this.former_request !== line_number &&
      this.former_request + 1 !== line_number
    ) {
      // TODO: Log error
      return true; // stop knitting
    }

    // store requested line number for next request
    this.former_request = line_number;
    const requested_line = line_number;

    // adjust line_number with current block
    line_number += BLOCK_LENGTH * this.line_block;

    // Get data for next line of knitting via mode_func
    const [color, row_index, blank_line, last_line] = this.mode_func(
      this,
      line_number,
    );

    // Get bits for this line
    const bits = this.select_needles_API6(color, row_index, blank_line);
    const flags = 0;

    // Send line to machine
    // Note that we never set the "final line" flag here, because
    // we will send an extra blank line afterwards to make sure we
    // can track the final line being knitted.
    this.com.cnfLine(requested_line, color, flags, bits);

    // Update status so progress bar and status UI update (desktop: __update_status)
    this._update_status(line_number, color, bits);

    // Log each row so simulation progress is visible in logs and UI
    const currentRow = this.pat_row + 1;
    const totalRows = this.pat_height;
    console.log(
      `[JS] Row ${currentRow}/${totalRows} (pat_row=${this.pat_row}, line_number=${line_number})`,
    );

    // Pattern finished? (desktop: if not last_line return false; elif inf_repeat ... else return true)
    if (!last_line) {
      return false; // keep knitting
    }
    if (this.inf_repeat) {
      this.pattern_repeats += 1;
      return false; // keep knitting
    }
    return true; // pattern finished
  }

  cnf_final_line_API6(requested_line: number): void {
    // TODO: Log debug message

    // prepare a blank line as the final line
    const bits = new Uint8Array(
      this.machine ? Machine.width(this.machine) : 200,
    );

    // send line to machine
    const color = 0; // doesn't matter
    const flags = 1; // this is the last line
    this.com.cnfLine(requested_line, color, flags, bits);
  }

  private _update_status(
    line_number: number,
    color: number,
    bits: Uint8Array,
  ): void {
    this.status.totalRows = this.pat_height;
    this.status.currentRow = this.pat_row + 1;
    this.status.lineNumber = line_number;
    if (this.inf_repeat) {
      this.status.repeats = this.pattern_repeats;
    }
    const paletteColor =
      this.pattern?.palette && this.pattern.palette.length > color
        ? this.pattern.palette[color]!
        : 0x000000;
    this.status.color = paletteColor;
    if (
      this.mode !== Mode.SINGLEBED &&
      this.num_colors > 1 &&
      COLOR_SYMBOLS[color]
    ) {
      this.status.colorSymbol = COLOR_SYMBOLS[color] as Status["colorSymbol"];
    } else {
      this.status.colorSymbol = "";
    }
    const knitStart = this.start_needle;
    const knitCount = Math.max(0, this.end_needle - this.start_needle);
    this.status.knitStartNeedle = knitStart;
    this.status.knitNeedleCount = knitCount;
    if (Control.FLANKING_NEEDLES && this.mode !== Mode.SINGLEBED) {
      this.status.bits = sliceNeedleBits(
        bits,
        this.pattern.knitStartNeedle,
        Math.max(0, this.pattern.knitEndNeedle - this.pattern.knitStartNeedle),
      );
    } else {
      this.status.bits = sliceNeedleBits(bits, knitStart, knitCount);
    }
    this.status.carriageType = this.initial_carriage;
    if (line_number % 2 === 0) {
      this.status.carriageDirection = this.initial_direction;
    } else {
      this.status.carriageDirection = Direction.reverse(this.initial_direction);
    }
  }

  select_needles_API6(
    color: number,
    row_index: number,
    blank_line: boolean,
  ): Uint8Array {
    const machineWidth = this.machine ? Machine.width(this.machine) : 200;
    // Create bits array: exactly machineWidth bits, packed into bytes (little-endian)
    // Python: bits = bitarray(self.machine.width, endian="little")
    // For KH270 (112 needles): 112 bits = 14 bytes exactly
    const bytesNeeded = Math.ceil(machineWidth / 8);
    const bits = new Uint8Array(bytesNeeded);

    if (
      Control.FLANKING_NEEDLES &&
      Mode.flankingNeedles(color, this.num_colors) &&
      this.mode !== Mode.SINGLEBED
    ) {
      for (let i = 0; i < this.start_needle; i++) {
        setNeedleBit(bits, i);
      }
      for (let i = this.end_needle; i < machineWidth; i++) {
        setNeedleBit(bits, i);
      }
    }

    if (!blank_line) {
      // Python: bits[start_needle:end_needle] = pattern_expanded[row_index][start_pixel:end_pixel]
      if (
        this.pattern.patternExpanded &&
        this.pattern.patternExpanded.length > 0
      ) {
        const patWidth = this.pattern.width;
        const bytesPerRow = Math.ceil(patWidth / 8);
        const rowOffset = row_index * bytesPerRow;
        const pixelStart = this.start_pixel;
        const pixelEnd = this.end_pixel;
        const needleStart = this.start_needle;
        const count = Math.min(
          pixelEnd - pixelStart,
          this.end_needle - needleStart,
        );
        for (let i = 0; i < count; i++) {
          const srcBit = pixelStart + i;
          const srcByte = Math.floor(srcBit / 8);
          const srcOffset = srcBit % 8;
          if (rowOffset + srcByte >= this.pattern.patternExpanded.length) {
            break;
          }
          const selected =
            ((this.pattern.patternExpanded[rowOffset + srcByte]! >> srcOffset) &
              1) !==
            0;
          if (selected) {
            setNeedleBit(bits, needleStart + i);
          }
        }
      } else {
        console.warn(
          "select_needles_API6: patternExpanded not populated, sending zeros.",
        );
      }
    }

    return bits;
  }

  operate(operation: Operation): Output {
    // Finite State Machine governing serial communication
    const stateName = StateMachineState[this.state];
    if (!stateName) {
      return Output.NONE;
    }
    const methodName =
      "_API" + this.api_version + "_" + stateName.toLowerCase();
    const method = (StateMachine as any)[methodName];
    if (!method) {
      // TODO: Log error
      return Output.NONE;
    }
    return method(this, operation);
  }

  operate_async(operation: Operation): any {
    // Finite State Machine governing serial communication (async version)
    const self = this;
    const stateName = StateMachineState[this.state];
    // Promise is available at runtime in Valdi (polyfilled)
    // Access Promise via eval to avoid TypeScript errors
    const PromiseConstructor = (function () {
      try {
        // eslint-disable-next-line no-eval
        return eval("Promise");
      } catch (e) {
        throw new Error("Promise not available");
      }
    })();
    if (!stateName) {
      return PromiseConstructor.resolve(Output.NONE);
    }
    const methodName =
      "_API" + this.api_version + "_" + stateName.toLowerCase() + "_async";

    // Try async version first, fall back to sync
    let method = (StateMachine as any)[methodName];
    if (!method) {
      // Fall back to sync version
      method = (StateMachine as any)[
        "_API" + this.api_version + "_" + stateName.toLowerCase()
      ];
      if (!method) {
        return PromiseConstructor.resolve(Output.NONE);
      }
      return PromiseConstructor.resolve(method(self, operation));
    }

    return method(self, operation);
  }
}
