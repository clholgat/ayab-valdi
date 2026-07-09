/**
 * WebSocket serial transport — pyserial-compatible surface for ayab websocketserial.py.
 * Web-only; wired through SerialWeb.ts on the web polyglot serial module.
 */

export class WebsocketTransport {
  private ws: WebSocket | null = null;
  private rxBuffer = new Uint8Array(0);
  private readonly uri: string;
  private onData: (() => void) | null = null;

  constructor(uri: string) {
    this.uri = uri;
  }

  setOnData(callback: (() => void) | null): void {
    this.onData = callback;
  }

  get isOpen(): boolean {
    return this.ws != null && this.ws.readyState === WebSocket.OPEN;
  }

  get inWaiting(): number {
    return this.rxBuffer.length;
  }

  async open(timeoutMs: number = 5000): Promise<boolean> {
    if (this.isOpen) {
      return true;
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.uri);
      ws.binaryType = "arraybuffer";
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error(`WebSocket connect timeout: ${this.uri}`));
      }, timeoutMs);

      ws.onopen = () => {
        clearTimeout(timer);
        this.ws = ws;
        ws.onmessage = (event) => {
          this.appendRx(event.data);
          this.onData?.();
        };
        ws.onclose = () => {
          if (this.ws === ws) {
            this.ws = null;
          }
        };
        resolve(true);
      };

      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error(`Failed to connect to ${this.uri}`));
      };
    });
  }

  private appendRx(data: ArrayBuffer | Blob | string): void {
    let chunk: Uint8Array;
    if (data instanceof ArrayBuffer) {
      chunk = new Uint8Array(data);
    } else if (typeof data === "string") {
      chunk = new TextEncoder().encode(data);
    } else {
      return;
    }

    const combined = new Uint8Array(this.rxBuffer.length + chunk.length);
    combined.set(this.rxBuffer);
    combined.set(chunk, this.rxBuffer.length);
    this.rxBuffer = combined;
  }

  read(maxSize: number = 256): Uint8Array {
    const size = Math.min(maxSize, this.rxBuffer.length);
    if (size <= 0) {
      return new Uint8Array(0);
    }
    const out = this.rxBuffer.subarray(0, size);
    this.rxBuffer = this.rxBuffer.subarray(size);
    return out;
  }

  peekBuffer(): Uint8Array {
    return new Uint8Array(this.rxBuffer);
  }

  consumeBuffer(bytesToConsume: number): void {
    if (bytesToConsume >= this.rxBuffer.length) {
      this.rxBuffer = new Uint8Array(0);
    } else if (bytesToConsume > 0) {
      this.rxBuffer = this.rxBuffer.subarray(bytesToConsume);
    }
  }

  write(data: Uint8Array): number {
    if (!this.isOpen || !this.ws) {
      throw new Error("WebSocket connection is closed");
    }
    this.ws.send(data);
    return data.length;
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.rxBuffer = new Uint8Array(0);
    this.onData = null;
  }
}
