import { Stk500SerialTransport } from "serial/src/firmware/Stk500FlashSession";
import {
  Cmnd_STK_ENTER_PROGMODE,
  Cmnd_STK_GET_SYNC,
  Cmnd_STK_LEAVE_PROGMODE,
  Cmnd_STK_LOAD_ADDRESS,
  Cmnd_STK_PROG_PAGE,
  Cmnd_STK_READ_PAGE,
  Resp_STK_INSYNC,
  Resp_STK_OK,
} from "serial/src/firmware/Stk500Protocol";

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function ackOk(): Uint8Array {
  return new Uint8Array([Resp_STK_INSYNC, Resp_STK_OK]);
}

export interface MockStk500BootloaderOptions {
  flashSize?: number;
  /** get-sync never gets a response - simulates a non-responding/wrong board. */
  neverSync?: boolean;
  /** Flips a byte in flash right after it's written at this byte address, so the
   *  session's read-back verify step fails - simulates a corrupted page write. */
  corruptPageAtAddress?: number;
}

/**
 * In-memory fake of an Optiboot bootloader's STK500v1 responses, implementing
 * the same Stk500SerialTransport interface Stk500FlashSession talks to. Lets
 * the flash session's state machine (sync/retry, program/verify loop, cancel,
 * error paths) be exercised end to end without real hardware - analogous to
 * HardwareTestCommunicationMock for the AYAB app protocol.
 */
export class MockStk500Bootloader implements Stk500SerialTransport {
  readonly flash: Uint8Array;
  readonly writtenFrames: Uint8Array[] = [];

  private opened = false;
  private loadedWordAddress = 0;
  private pendingResponse = new Uint8Array(0);

  constructor(private readonly options: MockStk500BootloaderOptions = {}) {
    this.flash = new Uint8Array(options.flashSize ?? 32 * 1024).fill(0xff);
  }

  async open(): Promise<boolean> {
    this.opened = true;
    return true;
  }

  close(): void {
    this.opened = false;
  }

  write(data: Uint8Array): void {
    this.writtenFrames.push(data);
    if (!this.opened) {
      return;
    }
    const response = this.handleCommand(data);
    if (response) {
      this.pendingResponse = concat(this.pendingResponse, response);
    }
  }

  async readExactly(byteCount: number): Promise<Uint8Array> {
    if (!this.opened) {
      throw new Error("MockStk500Bootloader: port is closed");
    }
    if (this.pendingResponse.length < byteCount) {
      throw new Error(
        `MockStk500Bootloader: no response available (wanted ${byteCount} bytes, ` +
          `have ${this.pendingResponse.length})`,
      );
    }
    const result = this.pendingResponse.slice(0, byteCount);
    this.pendingResponse = this.pendingResponse.slice(byteCount);
    return result;
  }

  async delay(): Promise<void> {
    // Resolve immediately - tests don't need real wall-clock delays.
  }

  discardBuffered(): void {
    this.pendingResponse = new Uint8Array(0);
  }

  private handleCommand(frame: Uint8Array): Uint8Array | null {
    switch (frame[0]) {
      case Cmnd_STK_GET_SYNC:
        return this.options.neverSync ? null : ackOk();

      case Cmnd_STK_ENTER_PROGMODE:
      case Cmnd_STK_LEAVE_PROGMODE:
        return ackOk();

      case Cmnd_STK_LOAD_ADDRESS: {
        const low = frame[1]!;
        const high = frame[2]!;
        this.loadedWordAddress = (high << 8) | low;
        return ackOk();
      }

      case Cmnd_STK_PROG_PAGE: {
        const pageSize = (frame[1]! << 8) | frame[2]!;
        const data = frame.slice(4, 4 + pageSize);
        const byteAddress = this.loadedWordAddress << 1;
        this.flash.set(data, byteAddress);
        if (this.options.corruptPageAtAddress === byteAddress) {
          this.flash[byteAddress] = this.flash[byteAddress]! ^ 0xff;
        }
        return ackOk();
      }

      case Cmnd_STK_READ_PAGE: {
        const pageSize = (frame[1]! << 8) | frame[2]!;
        const byteAddress = this.loadedWordAddress << 1;
        const page = this.flash.slice(byteAddress, byteAddress + pageSize);
        return concat(concat(new Uint8Array([Resp_STK_INSYNC]), page), new Uint8Array([Resp_STK_OK]));
      }

      default:
        return null;
    }
  }
}
