import { Token } from "constants/src/SerialConstants";
import { Machine } from "state_machine/src/Machine";
import { ICommunication } from "constants/src/Interfaces";
import {
  open_serial,
  is_open,
  write as native_write,
  read as native_read,
  close_serial,
  in_waiting as native_in_waiting,
  registerDataAvailableResolver,
  consumeReadBuffer,
} from "serial/src/Serial";

// SLIP protocol constants
const SLIP_END = 0xc0;
const SLIP_ESC = 0xdb;
const SLIP_ESC_END = 0xdc;
const SLIP_ESC_ESC = 0xdd;

export class Communication implements ICommunication {
  private rxMsgList: Uint8Array[] = [];
  private rxBuffer: Uint8Array = new Uint8Array(0);

  constructor() {
    // Communication constructor should not open the port (matches Python behavior)
    // Port opening happens via openSerial() method, called from StateMachine._API6_connect
  }

  isOpen() {
    return is_open();
  }

  openSerial(uri: string): boolean {
    try {
      if (!uri || uri.trim().length === 0) {
        console.error(
          "Communication.openSerial: Invalid serial port URI (empty)",
        );
        return false;
      }

      open_serial(uri);
      return is_open();
    } catch (e) {
      console.error(
        "Communication.openSerial: Exception opening serial port:",
        e,
      );
      return false;
    }
  }

  openSerialAsync(uri: string): Promise<boolean> {
    // Async version that returns a Promise resolving when port is actually open
    // This is the preferred method for async contexts
    const PromiseConstructor = (function () {
      try {
        // eslint-disable-next-line no-eval
        return eval("Promise");
      } catch (e) {
        throw new Error("Promise not available");
      }
    })();

    const self = this;
    return new PromiseConstructor(function (resolve: any, reject: any) {
      try {
        if (!uri || uri.trim().length === 0) {
          console.error(
            "Communication.openSerialAsync: Invalid serial port URI (empty)",
          );
          resolve(false);
          return;
        }

        if (is_open()) {
          resolve(true);
          return;
        }

        // Call open_serial which returns a Promise on web, void on native
        // Use type assertion since .d.ts declares it as void but web impl returns Promise
        const openingPromise = (open_serial as any)(
          uri,
        ) as Promise<void> | void;

        if (
          openingPromise &&
          typeof (openingPromise as any).then === "function"
        ) {
          // open_serial returned a promise (web implementation) - await it
          (openingPromise as Promise<void>)
            .then(function () {
              resolve(is_open());
            })
            .catch(function (err: any) {
              console.error(
                "Communication.openSerialAsync: Port opening failed:",
                err,
              );
              resolve(false);
            });
        } else {
          // open_serial is synchronous (native implementation)
          if (is_open()) {
            resolve(true);
          } else {
            console.error("Communication.openSerialAsync: Port opening failed");
            resolve(false);
          }
        }
      } catch (e) {
        console.error(
          "Communication.openSerialAsync: Exception opening serial port:",
          e,
        );
        resolve(false);
      }
    });
  }

  closeSerial() {
    this.rxMsgList = [];
    this.rxBuffer = new Uint8Array(0);
    close_serial();
  }

  reqInfo() {
    const data = new Uint8Array([Token.reqInfo.valueOf()]);
    this.write_API6(data);
  }

  reqTest() {
    const data = new Uint8Array([Token.reqTest.valueOf()]);
    this.write_API6(data);
  }

  reqQuit() {
    const data = new Uint8Array([Token.quitCmd.valueOf()]);
    this.write_API6(data);
  }

  reqStart(
    startNeedle: number,
    stopNeedle: number,
    continuousReporting: boolean,
    disableHardwareBeep: boolean,
  ) {
    // Match Python: flags = 1 * continuous_reporting + 2 * (not disable_hardware_beep)
    const flags = (continuousReporting ? 1 : 0) + (disableHardwareBeep ? 0 : 2);
    const data = new Uint8Array([
      Token.reqStart.valueOf(),
      startNeedle,
      stopNeedle,
      flags,
    ]);
    const crc = addCrc(data);
    const dataWithCrc = new Uint8Array(data.length + 1);
    dataWithCrc.set(data);
    dataWithCrc[data.length] = crc;
    this.write_API6(dataWithCrc);
  }

  reqInit(machine: Machine) {
    const data = new Uint8Array([Token.reqInit.valueOf(), machine.valueOf()]);
    const crc = addCrc(data);
    const dataWithCrc = new Uint8Array(data.length + 1);
    dataWithCrc.set(data);
    dataWithCrc[data.length] = crc;
    this.write_API6(dataWithCrc);
  }

  cnfLine(
    lineNumber: number,
    color: number,
    flags: number,
    lineData: Uint8Array,
  ) {
    const header = new Uint8Array([
      Token.cnfLine.valueOf(),
      lineNumber,
      color,
      flags,
    ]);
    const data = new Uint8Array(header.length + lineData.length);
    data.set(header);
    data.set(lineData, header.length);
    const crc = addCrc(data);
    const dataWithCrc = new Uint8Array(data.length + 1);
    dataWithCrc.set(data);
    dataWithCrc[data.length] = crc;
    this.write_API6(dataWithCrc);
  }

  read() {
    return native_read();
  }

  write(data: Uint8Array) {
    native_write(data);
  }

  // SLIP encoding: encode data with SLIP protocol
  private slipEncode(data: Uint8Array): Uint8Array {
    const encoded: number[] = [];

    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      if (byte === SLIP_END) {
        encoded.push(SLIP_ESC);
        encoded.push(SLIP_ESC_END);
      } else if (byte === SLIP_ESC) {
        encoded.push(SLIP_ESC);
        encoded.push(SLIP_ESC_ESC);
      } else {
        encoded.push(byte);
      }
    }

    // Add END byte at the end
    encoded.push(SLIP_END);

    return new Uint8Array(encoded);
  }

  // SLIP decoding: decode SLIP-encoded data and extract complete frames
  // Returns: [frames, bytesConsumedFromData]
  // bytesConsumedFromData indicates how many bytes from the data parameter were consumed
  // (used to know how much of g_readBuffer to clear)
  private slipDecode(data: Uint8Array): [Uint8Array[], number] {
    const frames: Uint8Array[] = [];

    // Combine with existing buffer (for incomplete frames from previous reads)
    const combined = new Uint8Array(this.rxBuffer.length + data.length);
    combined.set(this.rxBuffer);
    combined.set(data, this.rxBuffer.length);

    let frame: number[] = [];
    let i = 0;

    while (i < combined.length) {
      const byte = combined[i];

      if (byte === SLIP_END) {
        // End of frame
        if (frame.length > 0) {
          frames.push(new Uint8Array(frame));
          frame = [];
        }
        i++;
      } else if (byte === SLIP_ESC) {
        // Escape sequence
        if (i + 1 < combined.length) {
          const nextByte = combined[i + 1];
          if (nextByte === SLIP_ESC_END) {
            frame.push(SLIP_END);
            i += 2;
          } else if (nextByte === SLIP_ESC_ESC) {
            frame.push(SLIP_ESC);
            i += 2;
          } else {
            // Invalid escape sequence, skip ESC byte
            frame.push(byte);
            i++;
          }
        } else {
          // Incomplete escape sequence, keep in buffer
          break;
        }
      } else {
        frame.push(byte);
        i++;
      }
    }

    // Calculate how many bytes from the data parameter were consumed
    // i is the position in combined buffer, this.rxBuffer.length is how much came from previous buffer
    // So bytes consumed from data = i - this.rxBuffer.length (but not less than 0)
    const bytesConsumedFromData = Math.max(0, i - this.rxBuffer.length);

    // Save remaining data in buffer (for next call)
    this.rxBuffer = combined.slice(i);

    return [frames, bytesConsumedFromData];
  }

  // Write data with SLIP encoding
  private write_API6(data: Uint8Array): void {
    const encoded = this.slipEncode(data);
    this.write(encoded);
  }

  update_API6(): [Uint8Array | null, Token, number] {
    const msg = this.read_API6();
    return this.parse_API6(msg);
  }

  // Async version that blocks until data arrives (matches Python's blocking read behavior)
  // On web: Uses background readLoop to continuously read, waits indefinitely for data
  // Promise is available at runtime in Valdi (polyfilled)
  read_API6_async(): any {
    const self = this;
    // Use Promise directly - it's polyfilled by Valdi
    // Access Promise via eval to avoid TypeScript errors
    const PromiseConstructor = (function () {
      try {
        // eslint-disable-next-line no-eval
        return eval("Promise");
      } catch (e) {
        throw new Error("Promise not available");
      }
    })();

    return new PromiseConstructor(function (resolve: any, reject: any) {
      if (!is_open()) {
        resolve(null);
        return;
      }

      // If we already have messages pending, return immediately
      if (self.rxMsgList.length > 0) {
        resolve(self.rxMsgList.shift() || null);
        return;
      }

      // First check if data is already available in buffer
      let data = self.read();
      if (data && data.length > 0) {
        const [frames, bytesConsumed] = self.slipDecode(data);
        // Consume processed bytes from buffer (slipDecode's internal buffer handles incomplete frames)
        // Only on web - native platforms don't have a buffer to manage
        if (typeof consumeReadBuffer === "function") {
          consumeReadBuffer(bytesConsumed);
        }
        self.rxMsgList.push.apply(self.rxMsgList, frames);
        if (self.rxMsgList.length > 0) {
          resolve(self.rxMsgList.shift() || null);
          return;
        }
      }

      // No data available - wait for data to arrive asynchronously
      // This is truly async and won't block the main thread
      let resolved = false;
      let removeResolver: (() => void) | null = null;

      // Resolver function that gets called when data arrives in background readLoop
      // This will be called when data is available
      // It will ONLY resolve when there's actually a complete message available
      // This is a simple synchronous check - no polling, no blocking
      const resolveFn = function () {
        if (resolved) {
          if (removeResolver) {
            removeResolver();
          }
          return;
        }

        if (!is_open()) {
          resolved = true;
          if (removeResolver) {
            removeResolver();
          }
          resolve(null);
          return;
        }

        // Read available data from buffer (background loop just populated it)
        let data = self.read();

        if (data && data.length > 0) {
          // Decode SLIP frames
          const [frames, bytesConsumed] = self.slipDecode(data);
          // Consume processed bytes from buffer (slipDecode's internal buffer handles incomplete frames)
          // Only on web - native platforms don't have a buffer to manage
          if (typeof consumeReadBuffer === "function") {
            consumeReadBuffer(bytesConsumed);
          }
          self.rxMsgList.push.apply(self.rxMsgList, frames);

          // Return the oldest message if available
          if (self.rxMsgList.length > 0) {
            resolved = true;
            if (removeResolver) {
              removeResolver();
            }
            resolve(self.rxMsgList.shift() || null);
            return;
          }
          // If no complete frames yet, don't resolve - keep waiting
          // The resolver will be called again when more data arrives
        }
        // If no data or no frames, don't resolve - keep waiting
        // This is fine - the resolver will be called again when data arrives
      };

      // Register resolver to be called asynchronously when data arrives in background readLoop
      // This is truly async and won't block the main thread - it just sets up a callback
      try {
        if (typeof registerDataAvailableResolver === "function") {
          removeResolver = registerDataAvailableResolver(resolveFn);
          // Don't do anything else - just return the promise
          // The resolver will be called asynchronously when data arrives
        } else {
          console.error(
            "read_API6_async: registerDataAvailableResolver not available",
          );
          resolve(null);
        }
      } catch (err: any) {
        console.error("read_API6_async: Error registering resolver:", err);
        resolve(null);
      }
    });
  }

  update_API6_async(): any {
    const self = this;
    return this.read_API6_async().then(function (msg: Uint8Array | null) {
      return self.parse_API6(msg);
    });
  }

  read_API6(): Uint8Array | null {
    // If we already have messages pending, return the oldest one
    // This matches Python's behavior: check rx_msg_list first
    if (this.rxMsgList.length > 0) {
      return this.rxMsgList.shift() || null;
    }

    // Read available data from serial port
    // Match Python behavior: read what's available, then check in_waiting and read more
    // The native read() blocks with 0.1s timeout, so it will wait for data
    let data = this.read();

    if (!data || data.length === 0) {
      // No data available - this is fine, state machine will poll again
      return null;
    }

    // If more bytes are available, read them all (matching Python's in_waiting check)
    // This ensures we get all messages that arrived together
    let bytesAvailable = native_in_waiting();
    while (bytesAvailable > 0) {
      const additionalData = this.read();
      if (additionalData && additionalData.length > 0) {
        // Combine the data
        const combined = new Uint8Array(data.length + additionalData.length);
        combined.set(data);
        combined.set(additionalData, data.length);
        data = combined;
        // Check again if more bytes are available
        bytesAvailable = native_in_waiting();
      } else {
        break;
      }
    }

    // Decode SLIP frames - this may extract multiple messages
    const [frames, bytesConsumed] = this.slipDecode(data);
    // Consume processed bytes from buffer (slipDecode's internal buffer handles incomplete frames)
    // Only on web - native platforms don't have a buffer to manage
    if (typeof consumeReadBuffer === "function") {
      consumeReadBuffer(bytesConsumed);
    }

    // Add all decoded frames to message list (FIFO queue)
    this.rxMsgList.push(...frames);

    // Return the oldest message if available
    if (this.rxMsgList.length > 0) {
      return this.rxMsgList.shift() || null;
    }

    return null;
  }

  parse_API6(msg: Uint8Array | null): [Uint8Array | null, Token, number] {
    if (msg === null || msg.length === 0) {
      return [null, Token.none, 0];
    }
    // Check for known tokens
    const tokenValue = msg[0];
    // Iterate over Token enum values
    const tokenKeys = Object.keys(Token) as Array<keyof typeof Token>;
    for (const key of tokenKeys) {
      const token = Token[key];
      if (typeof token === "number" && token === tokenValue) {
        const param = msg.length > 1 ? msg[1] : 0;
        return [msg, token as Token, param];
      }
    }
    // Unknown token
    console.warn(
      "parse_API6: Unknown token value:",
      "0x" + tokenValue.toString(16).toUpperCase(),
    );
    return [msg, Token.unknown, 0];
  }
}

// CRC-8 algorithm after Maxim/Dallas (matches firmware and Python implementation)
// Based on https://www.leonardomiliani.com/en/2013/un-semplice-crc8-per-arduino/
export function addCrc(data: Uint8Array): number {
  let crc = 0x00;
  for (let i = 0; i < data.length; i++) {
    let extract = data[i];
    for (let j = 0; j < 8; j++) {
      const sum = (crc ^ extract) & 0x01;
      crc >>= 1;
      if (sum) {
        crc ^= 0x8c;
      }
      extract >>= 1;
    }
  }
  return crc & 0xff;
}
