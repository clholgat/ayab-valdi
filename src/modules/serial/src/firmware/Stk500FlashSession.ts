import {
  open_serial,
  close_serial,
  is_open,
  write as native_write,
  read as native_read,
  consumeReadBuffer,
  registerDataAvailableResolver,
  flush as native_flush,
  pulse_dtr_rts_reset,
} from "serial/src/Serial";
import {
  AYAB_FIRMWARE_UNO_HEX,
  AYAB_FIRMWARE_UNO_SHA256,
  AYAB_FIRMWARE_UNO_VERSION,
} from "./generated/AyabFirmwareUnoHex";
import { buildFlashImage, chunkIntoPages, parseIntelHex, FlashPage } from "./IntelHexParser";
import {
  buildEnterProgMode,
  buildGetSync,
  buildLeaveProgMode,
  buildLoadAddress,
  buildProgPage,
  buildReadPage,
  isSyncOk,
  parseReadPageResponse,
  UNO_PAGE_SIZE,
} from "./Stk500Protocol";

// Overall time budget to establish sync with the bootloader before giving up.
const SYNC_TOTAL_TIMEOUT_MS = 5000;
// How long to wait for a response to a single get-sync attempt before retrying.
// Real hardware observed a first-response latency close to 300ms - keep this
// comfortably above that so a slow-but-real reply doesn't get mistaken for a
// miss and trigger a redundant retry (see discardBuffered() below for why an
// overlapping retry is still handled safely even so).
const SYNC_ATTEMPT_TIMEOUT_MS = 500;
const SYNC_RETRY_DELAY_MS = 100;
// How long to wait after the fast bootloader-reset pulse before syncing -
// long enough for the UART/reset circuit to settle, short enough to stay
// inside Optiboot's post-reset sync window (open_serial()'s own ~2s settle
// has already elapsed by the time this transport's open() resolves, and is
// too late to rely on for this - see pulse_dtr_rts_reset()'s doc comment).
const RESET_SETTLE_MS = 150;
// How long to wait for a response to a normal (non-page-write) command.
const COMMAND_TIMEOUT_MS = 2000;
// Page writes/reads move more data over a slow serial link - give them more room.
const PAGE_WRITE_TIMEOUT_MS = 3000;
const PAGE_READ_TIMEOUT_MS = 3000;

/**
 * Everything Stk500FlashSession needs from a serial connection, abstracted so
 * tests can supply an in-memory fake bootloader (see
 * test/firmware/MockStk500Bootloader.ts) instead of the real Web Serial API.
 */
export interface Stk500SerialTransport {
  open(uri: string): Promise<boolean>;
  close(): void;
  write(data: Uint8Array): void;
  /** Waits for at least `byteCount` bytes, consumes and returns exactly that many. */
  readExactly(byteCount: number, timeoutMs: number): Promise<Uint8Array>;
  delay(ms: number): Promise<void>;
  /**
   * Discards any bytes currently sitting in the read buffer without waiting
   * for more. A retried command (e.g. a get-sync attempt that timed out just
   * before its real reply arrived) can leave a stray extra reply queued up
   * behind the one we did consume - left alone, those extra bytes shift the
   * framing of every subsequent response by however many bytes leaked through.
   * Call this once a milestone (like sync) is confirmed to clear any such
   * leftovers before they can corrupt later parsing.
   */
  discardBuffered(): void;
}

/**
 * setTimeout/clearTimeout bound to globalThis, preferring Valdi's original
 * (unpatched) timing functions when available - matches the pattern used in
 * Communication.ts/StateMachine.ts/HardwareTestSession.ts to avoid an "Illegal
 * invocation" error from calling the global timer functions directly in this
 * runtime.
 */
function getBoundTimingFunctions(): {
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
} {
  const originalTiming = (globalThis as any).__originalTimingFunctions__;
  const setTimeoutFn = originalTiming?.setTimeout || setTimeout;
  const clearTimeoutFn = originalTiming?.clearTimeout || clearTimeout;
  return {
    setTimeout: setTimeoutFn.bind(globalThis),
    clearTimeout: clearTimeoutFn.bind(globalThis),
  };
}

/**
 * Stk500SerialTransport backed by the real cross-platform serial/src/Serial
 * exports (Web Serial on web). STK500 isn't SLIP-framed like the AYAB app
 * protocol in Communication.ts, so this talks to the raw write/read/
 * registerDataAvailableResolver primitives directly rather than going through
 * Communication.ts/Control.ts.
 */
export function createWebSerialTransport(): Stk500SerialTransport {
  const boundDelay = (ms: number): Promise<void> => {
    const { setTimeout: boundSetTimeout } = getBoundTimingFunctions();
    return new Promise((resolve) => boundSetTimeout(resolve, ms));
  };

  return {
    async open(uri: string): Promise<boolean> {
      if (!is_open()) {
        // Serial.d.ts declares open_serial as void, but the web implementation
        // actually returns Promise<void> - same dual sync/async handling as
        // Communication.ts's openSerialAsync().
        const openingPromise = (open_serial as any)(uri) as Promise<void> | void;
        if (openingPromise && typeof (openingPromise as any).then === "function") {
          try {
            await (openingPromise as Promise<void>);
          } catch {
            return false;
          }
        }
        if (!is_open()) {
          return false;
        }
      }

      // open_serial()'s own reset pulse happened too long ago (its ~2s settle
      // delay already elapsed by the time we get here) to still be inside
      // Optiboot's short post-reset sync window - re-pulse now, right before
      // syncing, with only a short settle.
      if (typeof pulse_dtr_rts_reset === "function") {
        await pulse_dtr_rts_reset();
        await boundDelay(RESET_SETTLE_MS);
      }

      return true;
    },

    close(): void {
      close_serial();
    },

    write(data: Uint8Array): void {
      native_write(data);
    },

    readExactly(byteCount: number, timeoutMs: number): Promise<Uint8Array> {
      return new Promise((resolve, reject) => {
        const { setTimeout: boundSetTimeout, clearTimeout: boundClearTimeout } =
          getBoundTimingFunctions();
        let resolved = false;
        let removeResolver: (() => void) | null = null;

        const timeoutId = boundSetTimeout(() => {
          if (resolved) {
            return;
          }
          resolved = true;
          removeResolver?.();
          reject(
            new Error(
              `Timed out after ${timeoutMs}ms waiting for ${byteCount} bytes from bootloader`,
            ),
          );
        }, timeoutMs);

        const tryResolve = () => {
          if (resolved) {
            return;
          }
          if (!is_open()) {
            resolved = true;
            boundClearTimeout(timeoutId);
            removeResolver?.();
            reject(new Error("Serial port closed while waiting for bootloader response"));
            return;
          }
          const data = native_read();
          if (data.length >= byteCount) {
            resolved = true;
            boundClearTimeout(timeoutId);
            removeResolver?.();
            consumeReadBuffer(byteCount);
            resolve(data.slice(0, byteCount));
          }
        };

        tryResolve();
        if (!resolved) {
          removeResolver = registerDataAvailableResolver(tryResolve);
        }
      });
    },

    delay(ms: number): Promise<void> {
      const { setTimeout: boundSetTimeout } = getBoundTimingFunctions();
      return new Promise((resolve) => boundSetTimeout(resolve, ms));
    },

    discardBuffered(): void {
      native_flush();
    },
  };
}

export interface Stk500FlashStartParams {
  /** Must be a real serial port URI - the caller is responsible for not passing "Simulation". */
  serialPort: string;
  /** Defaults to the real Web Serial transport; tests inject a fake bootloader. */
  transport?: Stk500SerialTransport;
  /** Overridable so tests don't have to wait out the real 5s sync budget. */
  syncTimeoutMs?: number;
}

export interface Stk500FlashCallbacks {
  onProgress: (bytesWritten: number, totalBytes: number) => void;
  onOutput: (text: string) => void;
  isDestroyed: () => boolean;
}

export type Stk500FlashResult = "finished" | "cancelled" | "error";

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export class Stk500FlashSession {
  private cancelled = false;

  private constructor(
    private readonly transport: Stk500SerialTransport,
    private readonly portname: string,
    private readonly syncTimeoutMs: number,
  ) {}

  static start(params: Stk500FlashStartParams): Stk500FlashSession {
    return new Stk500FlashSession(
      params.transport ?? createWebSerialTransport(),
      params.serialPort,
      params.syncTimeoutMs ?? SYNC_TOTAL_TIMEOUT_MS,
    );
  }

  cancel(): void {
    this.cancelled = true;
  }

  async run(callbacks: Stk500FlashCallbacks): Promise<Stk500FlashResult> {
    const startedAt = Date.now();
    const elapsed = () => `${Date.now() - startedAt}ms`;

    callbacks.onOutput(
      `Firmware ${AYAB_FIRMWARE_UNO_VERSION} (sha256 ${AYAB_FIRMWARE_UNO_SHA256.slice(0, 12)}...)`,
    );
    callbacks.onOutput(`Opening serial port: ${this.portname}...`);
    const opened = await this.transport.open(this.portname);
    if (!opened) {
      callbacks.onOutput(`Failed to open the serial port (${elapsed()}).`);
      return "error";
    }

    try {
      if (this.cancelled) {
        return "cancelled";
      }

      callbacks.onOutput("Syncing with bootloader...");
      await this.syncWithRetry(callbacks);
      if (this.cancelled) {
        return "cancelled";
      }

      callbacks.onOutput("Entering programming mode...");
      await this.sendAndExpectSyncOk(buildEnterProgMode(), COMMAND_TIMEOUT_MS);
      if (this.cancelled) {
        return "cancelled";
      }

      const image = buildFlashImage(parseIntelHex(AYAB_FIRMWARE_UNO_HEX));
      const pages = chunkIntoPages(image, UNO_PAGE_SIZE);
      const totalBytes = pages.length * UNO_PAGE_SIZE;
      // Log roughly every 10% of pages (at least every 10 pages) - fine-grained
      // enough to localize a mid-flash failure to a page range, coarse enough
      // not to spam the log for a ~100+ page image.
      const progressLogInterval = Math.max(1, Math.min(10, Math.floor(pages.length / 10)));

      callbacks.onOutput(`Writing ${pages.length} pages (${totalBytes} bytes)...`);
      for (let i = 0; i < pages.length; i++) {
        if (this.cancelled) {
          callbacks.onOutput(`Cancelled after page ${i}/${pages.length} (${elapsed()}).`);
          return "cancelled";
        }
        await this.writeAndVerifyPage(pages[i]!);
        callbacks.onProgress((i + 1) * UNO_PAGE_SIZE, totalBytes);
        if ((i + 1) % progressLogInterval === 0 || i === pages.length - 1) {
          callbacks.onOutput(
            `  page ${i + 1}/${pages.length} written+verified (${elapsed()})`,
          );
        }
      }

      callbacks.onOutput("Leaving programming mode...");
      await this.sendAndExpectSyncOk(buildLeaveProgMode(), COMMAND_TIMEOUT_MS);

      callbacks.onOutput(`Flash complete. (${elapsed()})`);
      return "finished";
    } catch (err: unknown) {
      const detail =
        err instanceof Error ? err.message : `non-Error thrown: ${String(err)}`;
      callbacks.onOutput(`Flash failed after ${elapsed()}: ${detail}`);
      return "error";
    } finally {
      this.transport.close();
    }
  }

  private async syncWithRetry(callbacks: Stk500FlashCallbacks): Promise<void> {
    const startedAt = Date.now();
    const deadline = startedAt + this.syncTimeoutMs;
    let lastError: Error | undefined;
    let attempts = 0;

    while (Date.now() < deadline) {
      if (this.cancelled) {
        return;
      }
      attempts += 1;
      try {
        this.transport.write(buildGetSync());
        const response = await this.transport.readExactly(2, SYNC_ATTEMPT_TIMEOUT_MS);
        if (isSyncOk(response)) {
          // A retried get-sync can leave a stray extra reply queued behind
          // this one (see discardBuffered()'s doc comment) - clear it now,
          // before it can shift the framing of the next command's response.
          this.transport.discardBuffered();
          callbacks.onOutput(
            `Synced after ${attempts} attempt(s), ${Date.now() - startedAt}ms.`,
          );
          return;
        }
        lastError = new Error("bootloader responded, but not with INSYNC/OK");
      } catch (err: unknown) {
        lastError = err as Error;
      }
      await this.transport.delay(SYNC_RETRY_DELAY_MS);
    }

    throw new Error(
      "Could not sync with the bootloader after " +
        `${attempts} attempt(s) over ${Date.now() - startedAt}ms - check the board is an ` +
        `Arduino Uno and try reconnecting. (${lastError?.message ?? "no response"})`,
    );
  }

  private async sendAndExpectSyncOk(frame: Uint8Array, timeoutMs: number): Promise<void> {
    this.transport.write(frame);
    const response = await this.transport.readExactly(2, timeoutMs);
    if (!isSyncOk(response)) {
      throw new Error("bootloader did not acknowledge the command");
    }
  }

  private async writeAndVerifyPage(page: FlashPage): Promise<void> {
    const wordAddress = page.address >> 1;
    const pageLabel = `0x${page.address.toString(16).padStart(4, "0")}`;

    await this.loadAddress(wordAddress, pageLabel);

    this.transport.write(buildProgPage(UNO_PAGE_SIZE, "F", page.data));
    const progResponse = await this.transport.readExactly(2, PAGE_WRITE_TIMEOUT_MS);
    if (!isSyncOk(progResponse)) {
      throw new Error(`page write failed at ${pageLabel}`);
    }

    await this.loadAddress(wordAddress, pageLabel);

    this.transport.write(buildReadPage(UNO_PAGE_SIZE, "F"));
    const readResponse = await this.transport.readExactly(UNO_PAGE_SIZE + 2, PAGE_READ_TIMEOUT_MS);
    const verified = parseReadPageResponse(readResponse, UNO_PAGE_SIZE);
    if (!verified || !bytesEqual(verified, page.data)) {
      throw new Error(`verification failed at ${pageLabel}`);
    }
  }

  private async loadAddress(wordAddress: number, pageLabel: string): Promise<void> {
    this.transport.write(buildLoadAddress(wordAddress));
    const response = await this.transport.readExactly(2, COMMAND_TIMEOUT_MS);
    if (!isSyncOk(response)) {
      throw new Error(`load address failed at ${pageLabel}`);
    }
  }
}
