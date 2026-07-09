import { IWorkerService } from "worker/src/IWorkerService";
import {
  WorkerServiceEntryPoint,
  workerService,
} from "worker/src/WorkerServiceEntryPoint";

export interface ISerialWorker {
  /**
   * Process incoming serial data in the worker thread
   * @param data Raw bytes from serial port
   * @returns Processed data (e.g., SLIP-decoded frames)
   */
  processData(data: Uint8Array): Promise<Uint8Array[]>;

  /**
   * Get current buffer state
   */
  getBufferState(): Promise<{ length: number; buffer: Uint8Array }>;

  /**
   * Clear the buffer
   */
  clearBuffer(): Promise<void>;
}

// SLIP protocol constants
const SLIP_END = 0xc0;
const SLIP_ESC = 0xdb;
const SLIP_ESC_END = 0xdc;
const SLIP_ESC_ESC = 0xdd;

class SerialWorkerImpl implements ISerialWorker {
  private rxBuffer: Uint8Array = new Uint8Array(0);

  async processData(data: Uint8Array): Promise<Uint8Array[]> {
    // Combine with existing buffer (for incomplete frames from previous reads)
    const combined = new Uint8Array(this.rxBuffer.length + data.length);
    combined.set(this.rxBuffer);
    combined.set(data, this.rxBuffer.length);

    // Debug logging
    if (this.rxBuffer.length > 0) {
      console.log(
        "SerialWorker.processData: Combining buffer (" +
          this.rxBuffer.length +
          " bytes) with new data (" +
          data.length +
          " bytes)",
      );
      console.log(
        "SerialWorker.processData: Buffer (hex):",
        Array.from(this.rxBuffer)
          .map((b) => "0x" + b.toString(16).padStart(2, "0").toUpperCase())
          .join(" "),
      );
    }
    console.log(
      "SerialWorker.processData: New data (hex):",
      Array.from(data)
        .map((b) => "0x" + b.toString(16).padStart(2, "0").toUpperCase())
        .join(" "),
    );
    console.log(
      "SerialWorker.processData: Combined (hex):",
      Array.from(combined)
        .map((b) => "0x" + b.toString(16).padStart(2, "0").toUpperCase())
        .join(" "),
    );

    const frames: Uint8Array[] = [];
    let frame: number[] = [];
    let i = 0;
    let frameStart = -1; // Track where the current frame started (after SLIP_END)

    while (i < combined.length) {
      const byte = combined[i];

      if (byte === SLIP_END) {
        // End of frame (or start of new frame - SLIP_END is the delimiter)
        if (frame.length > 0) {
          frames.push(new Uint8Array(frame));
          frame = [];
        }
        frameStart = i + 1; // Next byte after this SLIP_END is the start of a new frame
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

    // Save remaining data in buffer (for next call)
    // If we have an incomplete frame (frame.length > 0), save from frameStart to end
    // Otherwise, save any remaining unprocessed bytes from position i
    if (frame.length > 0 && frameStart >= 0) {
      // We have an incomplete frame - save from where it started to the end
      this.rxBuffer = combined.slice(frameStart);
    } else {
      // No incomplete frame, save any remaining unprocessed bytes
      this.rxBuffer = combined.slice(i);
    }
    console.log(
      "SerialWorker.processData: Processed",
      frames.length,
      "frames, remaining buffer length:",
      this.rxBuffer.length,
    );
    if (frames.length > 0) {
      frames.forEach((f, idx) => {
        console.log(
          "SerialWorker.processData: Frame",
          idx,
          "(hex):",
          Array.from(f)
            .map((b) => "0x" + b.toString(16).padStart(2, "0").toUpperCase())
            .join(" "),
        );
      });
    }

    return frames;
  }

  async getBufferState(): Promise<{ length: number; buffer: Uint8Array }> {
    return {
      length: this.rxBuffer.length,
      buffer: new Uint8Array(this.rxBuffer), // Return a copy
    };
  }

  async clearBuffer(): Promise<void> {
    this.rxBuffer = new Uint8Array(0);
  }
}

@workerService("serial_worker", module)
export class SerialWorkerServiceEntryPoint extends WorkerServiceEntryPoint<
  ISerialWorker,
  []
> {
  start(): IWorkerService<ISerialWorker> {
    return {
      api: new SerialWorkerImpl(),
      dispose() {},
    };
  }
}
