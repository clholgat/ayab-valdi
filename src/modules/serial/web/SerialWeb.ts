/**
 * Web implementation of Serial module using Web Serial API
 * @ExportModule
 */

import { isWebSocketUri } from "./SerialUri";
import { WebsocketTransport } from "./WebsocketTransport";
import { isSerialPortAlreadyOpenError } from "./SerialPortErrors";
import { AsyncWriteQueue } from "./AsyncWriteQueue";

// Web Serial API types (not available in all TypeScript versions)
interface SerialPortOpenOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: "none" | "even" | "odd";
  flowControl?: "none" | "hardware";
}

interface SerialPort extends EventTarget {
  open(options: SerialPortOpenOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
  getReader(): ReadableStreamDefaultReader<Uint8Array>;
  getWriter(): WritableStreamDefaultWriter<Uint8Array>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

interface Serial extends EventTarget {
  requestPort(): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

declare global {
  interface Navigator {
    serial?: Serial;
  }
}

let g_serialPort: SerialPort | null = null;
let g_readBuffer: Uint8Array = new Uint8Array(0);
let g_isOpen: boolean = false;
let g_selectedPortName: string | null = null;
let g_knownPorts: Map<string, SerialPort> = new Map();
let g_reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let g_readLoopPromise: Promise<void> | null = null;
let g_pendingReadResolvers: Array<() => void> = [];
let g_wsTransport: WebsocketTransport | null = null;
let g_usingWebsocket = false;
let g_portClosePromise: Promise<void> | null = null;
// Serializes writes to g_serialPort.writable so two rapid calls to write()
// (no await between them - e.g. cnf_final_line_API6() immediately followed
// by reqInfo() at the end of a knit) never race for the writer lock.
let g_writeQueue = new AsyncWriteQueue();

function scheduleTimeout(ms: number): Promise<void> {
  return new Promise(function (resolve) {
    const setTimeoutFn =
      (globalThis as any).__originalTimingFunctions__?.setTimeout || setTimeout;
    setTimeoutFn(resolve, ms);
  });
}

/** Unlock the readable stream, then close the Web Serial port. */
async function shutDownUsbPort(port: SerialPort): Promise<void> {
  const reader = g_reader;
  g_reader = null;
  if (reader) {
    // cancel() aborts a pending read(); releaseLock alone leaves the stream locked.
    try {
      await reader.cancel();
    } catch (_err: unknown) {
      // Ignore — stream may already be closed or cancelled.
    }
    try {
      reader.releaseLock();
    } catch (_err: unknown) {
      // Ignore — lock may already be released by cancel().
    }
  }

  if (g_readLoopPromise) {
    const loopPromise = g_readLoopPromise;
    g_readLoopPromise = null;
    try {
      await loopPromise;
    } catch (_err: unknown) {
      // readLoop errors are already logged.
    }
  }

  // Close may still race if the browser hasn't fully unlocked — retry briefly.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await port.close();
      return;
    } catch (err: unknown) {
      lastError = err;
      await scheduleTimeout(50 * (attempt + 1));
    }
  }
  console.warn(
    "close_serial: Error closing serial port after unlock retries (ignored):",
    lastError,
  );
}

function triggerReadResolvers(): void {
  if (g_pendingReadResolvers.length === 0) {
    return;
  }
  const resolvers = [...g_pendingReadResolvers];
  for (const resolver of resolvers) {
    try {
      resolver();
    } catch (err: unknown) {
      console.error("SerialWeb: Error in read resolver:", err);
    }
  }
}

/** Wake and discard pending async reads when the port closes. */
function rejectPendingReadResolvers(): void {
  triggerReadResolvers();
  g_pendingReadResolvers.length = 0;
}

function formatPortInfo(portInfo: {
  usbVendorId?: number;
  usbProductId?: number;
}): string {
  const hasVendorId =
    portInfo.usbVendorId !== undefined && portInfo.usbVendorId !== null;
  const hasProductId =
    portInfo.usbProductId !== undefined && portInfo.usbProductId !== null;

  if (hasVendorId || hasProductId) {
    const parts: string[] = [];
    if (hasVendorId) {
      const vendorIdHex =
        "0x" +
        portInfo.usbVendorId!.toString(16).toUpperCase().padStart(4, "0");
      parts.push(`Vendor: ${vendorIdHex}`);
    }
    if (hasProductId) {
      const productIdHex =
        "0x" +
        portInfo.usbProductId!.toString(16).toUpperCase().padStart(4, "0");
      parts.push(`Product: ${productIdHex}`);
    }
    let portName = `USB Serial (${parts.join(", ")})`;

    if (hasVendorId && hasProductId) {
      const deviceName = getDeviceName(
        portInfo.usbVendorId!,
        portInfo.usbProductId!,
      );
      if (deviceName) {
        portName = deviceName;
      }
    }
    return portName;
  }

  return "Serial Port (No USB ID)";
}

function registerPort(port: SerialPort): string {
  const baseName = formatPortInfo(port.getInfo());
  let name = baseName;
  let suffix = 2;
  while (g_knownPorts.has(name) && g_knownPorts.get(name) !== port) {
    name = `${baseName} (${suffix})`;
    suffix++;
  }
  g_knownPorts.set(name, port);
  return name;
}

export function get_serial_ports(): string[] {
  if (g_knownPorts.size > 0) {
    return Array.from(g_knownPorts.keys());
  }
  if (g_selectedPortName) {
    return [g_selectedPortName];
  }
  return [];
}

export async function refresh_serial_ports(): Promise<string[]> {
  if (!window.isSecureContext || !navigator.serial) {
    return get_serial_ports();
  }

  try {
    const ports = await navigator.serial.getPorts();
    g_knownPorts.clear();
    for (const port of ports) {
      registerPort(port);
    }
    return get_serial_ports();
  } catch (err: unknown) {
    console.error("refresh_serial_ports: Error listing serial ports:", err);
    return get_serial_ports();
  }
}

// Map common USB vendor/product IDs to device names
function getDeviceName(vendorId: number, productId: number): string | null {
  const vendorHex = vendorId.toString(16).toUpperCase().padStart(4, "0");
  const productHex = productId.toString(16).toUpperCase().padStart(4, "0");
  const key = `${vendorHex}:${productHex}`;

  // Common Arduino/knitting machine vendor IDs
  // Arduino: 0x2341, 0x2A03, 0x1B4F
  // Add more mappings as needed
  const deviceMap: { [key: string]: string } = {
    // Arduino Uno
    "2341:0043": "Arduino Uno",
    "2341:0001": "Arduino Uno",
    "2A03:0043": "Arduino Uno",
    // Arduino Mega
    "2341:0010": "Arduino Mega",
    "2341:0042": "Arduino Mega",
    // CH340 (common USB-to-serial chip)
    "1A86:7523": "CH340 Serial Adapter",
    "1A86:5523": "CH340 Serial Adapter",
    // FTDI (common USB-to-serial chip)
    "0403:6001": "FTDI Serial Adapter",
    "0403:6010": "FTDI Serial Adapter",
    // CP210x (common USB-to-serial chip)
    "10C4:EA60": "CP210x Serial Adapter",
    "10C4:EA70": "CP210x Serial Adapter",
  };

  return deviceMap[key] || null;
}

export function close_serial(): void {
  if (g_usingWebsocket) {
    g_isOpen = false;
    rejectPendingReadResolvers();
    g_wsTransport?.close();
    g_wsTransport = null;
    g_usingWebsocket = false;
    return;
  }

  g_isOpen = false; // Signal readLoop to exit
  rejectPendingReadResolvers();
  g_readBuffer = new Uint8Array(0);

  if (!g_serialPort && !g_reader && !g_readLoopPromise) {
    return;
  }

  const port = g_serialPort;
  g_serialPort = null;

  const closing = port
    ? shutDownUsbPort(port)
    : (async () => {
        const reader = g_reader;
        g_reader = null;
        if (reader) {
          try {
            await reader.cancel();
          } catch (_err: unknown) {
            // ignore
          }
          try {
            reader.releaseLock();
          } catch (_err: unknown) {
            // ignore
          }
        }
        if (g_readLoopPromise) {
          const loopPromise = g_readLoopPromise;
          g_readLoopPromise = null;
          try {
            await loopPromise;
          } catch (_err: unknown) {
            // ignore
          }
        }
      })();

  const tracked = closing.finally(function () {
    if (g_portClosePromise === tracked) {
      g_portClosePromise = null;
    }
  });
  g_portClosePromise = tracked;
}

function afterPortClosed(action: () => Promise<void> | void): Promise<void> | void {
  if (!g_portClosePromise) {
    return action();
  }
  return g_portClosePromise.then(() => action());
}

export function open_serial(uri: string): Promise<void> | void {
  if (isWebSocketUri(uri)) {
    if (g_isOpen) {
      return;
    }

    close_serial();
    g_usingWebsocket = true;
    g_wsTransport = new WebsocketTransport(uri);
    g_wsTransport.setOnData(triggerReadResolvers);

    const openPromise = g_wsTransport
      .open()
      .then((opened) => {
        if (!opened) {
          throw new Error(`Failed to open WebSocket: ${uri}`);
        }
        g_isOpen = true;
      })
      .catch((err: unknown) => {
        console.error("open_serial: Error opening WebSocket:", err);
        g_usingWebsocket = false;
        g_wsTransport = null;
        g_isOpen = false;
        throw err;
      });

    return openPromise;
  }

  g_usingWebsocket = false;
  g_wsTransport = null;

  if (g_knownPorts.has(uri)) {
    g_serialPort = g_knownPorts.get(uri)!;
    g_selectedPortName = uri;
  }

  // On web, the port should already be selected via request_serial_port() or refresh
  // Open it if we have a selected port that isn't already open
  // Returns Promise<void> on web (async), void on native (sync)
  if (!g_serialPort) {
    console.error(
      "open_serial: No serial port selected. Port must be selected via request_serial_port() first.",
    );
    return;
  }

  if (g_isOpen) {
    return;
  }

  const opening = afterPortClosed(async () => {
    const port = g_serialPort!;
    try {
      try {
        await port.open({
          baudRate: 115200,
          dataBits: 8,
          stopBits: 1,
          parity: "none",
          flowControl: "none",
        });
      } catch (err: any) {
        // Previous close may have failed to unlock; recover by shutting down then retrying.
        if (!isSerialPortAlreadyOpenError(err)) {
          throw err;
        }
        console.warn(
          "open_serial: Port still open after cancel — forcing unlock and retry",
        );
        await shutDownUsbPort(port);
        await port.open({
          baudRate: 115200,
          dataBits: 8,
          stopBits: 1,
          parity: "none",
          flowControl: "none",
        });
      }

      g_isOpen = true;
      g_readBuffer = new Uint8Array(0);

      // Delay to allow Arduino to reset/initialize after port opening
      // macOS waits ~2s after DTR reset (pyserial exclusive=True parity).
      await scheduleTimeout(2000);

      if (g_serialPort && g_serialPort.readable) {
        g_reader = g_serialPort.readable.getReader();
        const loopPromise = readLoop(g_reader).catch(function (loopErr: any) {
          console.error("open_serial: readLoop error:", loopErr);
        });
        g_readLoopPromise = loopPromise.finally(function () {
          if (g_readLoopPromise === loopPromise) {
            g_readLoopPromise = null;
          }
        });
      } else {
        console.error("open_serial: Port readable stream not available");
      }
    } catch (err: any) {
      console.error("open_serial: Error opening serial port:", err);
      g_isOpen = false;
      throw err;
    }
  });

  return opening;
}

// Request/select a serial port (web-specific, requires user interaction)
export async function request_serial_port(): Promise<string | null> {
  // Check if we're in a secure context (HTTPS or localhost)
  if (!window.isSecureContext) {
    console.error(
      "Web Serial API requires a secure context (HTTPS or localhost). Current URL:",
      window.location.href,
    );
    return null;
  }

  if (!navigator.serial) {
    console.error("Web Serial API not supported in this browser");
    console.error("User agent:", navigator.userAgent);
    console.error("Web Serial API is supported in Chrome 89+, Edge 89+");
    return null;
  }

  console.log(
    "Web Serial API is available. Secure context:",
    window.isSecureContext,
    "URL:",
    window.location.href,
  );

  try {
    // Close existing port if open — must unlock the readable stream first.
    if (g_serialPort && (g_isOpen || g_reader)) {
      g_isOpen = false;
      rejectPendingReadResolvers();
      const port = g_serialPort;
      await shutDownUsbPort(port);
    }

    // Request port from user
    g_serialPort = await navigator.serial.requestPort();

    const portName = registerPort(g_serialPort);
    g_selectedPortName = portName;
    return portName;
  } catch (err: any) {
    // User cancelled or error occurred
    if (err.name !== "NotFoundError") {
      console.error("Error requesting serial port:", err);
    }
    g_serialPort = null;
    return null;
  }
}

// Background read loop for Web Serial API - continuously reads and buffers data
// reader.read() blocks until data arrives (or stream closes), which is the expected behavior
async function readLoop(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> {
  try {
    while (g_isOpen) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }
      if (!g_isOpen) {
        break;
      }
      if (value && value.length > 0) {
        // Append data to buffer
        const combined = new Uint8Array(g_readBuffer.length + value.length);
        combined.set(g_readBuffer);
        combined.set(value, g_readBuffer.length);
        g_readBuffer = combined;

        // Trigger resolvers synchronously when data arrives
        // Don't clear the array - let resolvers remove themselves when they resolve
        // This allows resolvers to wait for complete frames
        if (g_pendingReadResolvers.length > 0) {
          // Call resolvers synchronously so they can check for complete frames immediately
          // Make a copy to avoid issues if resolvers modify the array
          const resolvers = [...g_pendingReadResolvers];
          for (const resolver of resolvers) {
            try {
              resolver();
            } catch (err: any) {
              console.error("readLoop: Error in resolver:", err);
            }
          }
        }
      }
    }
  } catch (err: any) {
    // Handle connection lost errors gracefully
    const isDeviceLostError =
      err.name === "NetworkError" &&
      err.message?.includes("device has been lost");

    if (g_isOpen) {
      if (isDeviceLostError) {
        console.warn("readLoop: Device connection lost");
        g_isOpen = false;
      } else {
        console.error("readLoop: Error in read loop:", err);
      }

      // Trigger any pending resolvers so they can handle the error appropriately
      // Don't clear the array - let resolvers remove themselves
      if (g_pendingReadResolvers.length > 0) {
        const resolvers = [...g_pendingReadResolvers];
        for (const resolver of resolvers) {
          try {
            resolver();
          } catch (resolverErr: any) {
            console.error("readLoop: Error in resolver:", resolverErr);
          }
        }
      }
    }
    // Ignore errors during closure
  } finally {
    if (g_reader === reader) {
      g_reader = null;
    }
  }
}

export function write(data: Uint8Array): void {
  if (g_usingWebsocket) {
    if (!g_wsTransport || !g_isOpen) {
      console.error("SerialWeb.write: WebSocket connection not open");
      return;
    }
    try {
      g_wsTransport.write(data);
    } catch (err: unknown) {
      console.error("SerialWeb.write: Error writing to WebSocket:", err);
    }
    return;
  }

  if (!g_serialPort || !g_isOpen || !g_serialPort.writable) {
    console.error("SerialWeb.write: Serial port not open or not writable");
    return;
  }

  // Queued (not fired immediately): getWriter() throws if a previous write's
  // writer hasn't released its lock yet, which happens whenever write() is
  // called twice back to back with no await in between.
  g_writeQueue.enqueue(async () => {
    if (!g_serialPort || !g_isOpen || !g_serialPort.writable) {
      // Port may have closed while this write was queued.
      return;
    }
    const writer = g_serialPort.writable.getWriter();
    try {
      await writer.write(data);
    } catch (err: unknown) {
      console.error("SerialWeb.write: Error writing to serial port:", err);
    } finally {
      writer.releaseLock();
    }
  });
}

export function read(): Uint8Array {
  if (g_usingWebsocket && g_wsTransport) {
    return g_wsTransport.peekBuffer();
  }

  // Return a copy of available data from buffer
  // The buffer is NOT cleared here - it will be cleared after slipDecode processes it
  // This ensures we don't lose data if frames arrive in multiple chunks
  return new Uint8Array(g_readBuffer);
}

export function consumeReadBuffer(bytesToConsume: number): void {
  if (g_usingWebsocket && g_wsTransport) {
    g_wsTransport.consumeBuffer(bytesToConsume);
    return;
  }

  // Remove the first N bytes from the read buffer (bytes that have been processed by slipDecode)
  // This is used to clear only the processed portion, keeping any unprocessed data
  if (bytesToConsume >= g_readBuffer.length) {
    // All bytes were consumed
    g_readBuffer = new Uint8Array(0);
  } else if (bytesToConsume > 0) {
    // Remove the first N bytes, keep the rest
    g_readBuffer = g_readBuffer.slice(bytesToConsume);
  }
  // If bytesToConsume is 0 or negative, do nothing (no bytes to consume)
}

// Register a resolver to be called when data arrives
// Returns a function that can be called to remove the resolver from the array
// Resolvers are called when data arrives and remove themselves when they resolve
export function registerDataAvailableResolver(
  resolver: () => void,
): () => void {
  g_pendingReadResolvers.push(resolver);

  // Return a function that removes this resolver from the array
  let removed = false;
  return function () {
    if (!removed) {
      removed = true;
      const index = g_pendingReadResolvers.indexOf(resolver);
      if (index !== -1) {
        g_pendingReadResolvers.splice(index, 1);
      }
    }
  };
}

export function is_open(): boolean {
  if (g_usingWebsocket) {
    return g_isOpen && (g_wsTransport?.isOpen ?? false);
  }
  return g_isOpen && g_serialPort !== null;
}

export function in_waiting(): number {
  if (g_usingWebsocket && g_wsTransport) {
    return g_wsTransport.inWaiting;
  }
  return g_readBuffer.length;
}

export function flush(): void {
  g_readBuffer = new Uint8Array(0);
}

interface AyabMdnsRecord {
  server: string;
  port: number;
  path?: string;
  boardId?: string;
  address?: string;
}

export function browse_ayab_mdns(): AyabMdnsRecord[] {
  return [];
}
