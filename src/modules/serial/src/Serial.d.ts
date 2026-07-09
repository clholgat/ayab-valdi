/**
 * @ExportModule
 * Exports the whole file
 */

export declare function get_serial_ports(): string[];

export declare function close_serial(): void;

export declare function open_serial(uri: string): void;

export declare function write(data: Uint8Array): void;

// read() is synchronous on native (blocks with timeout) and async on web
// For compatibility, we keep it sync but it may block on native
export declare function read(): Uint8Array;

export declare function is_open(): boolean;

export declare function in_waiting(): number;

export declare function flush(): void;

// Consume (remove) the first N bytes from the read buffer (web only, may be undefined on native)
// This removes only the processed bytes, keeping any unprocessed data
export declare function consumeReadBuffer(bytesToConsume: number): void;

// Request/select a serial port (async to support Web Serial API which requires user interaction)
// On web: Opens browser port picker and returns port identifier
// On native: Returns first available port or null if none available
export declare function request_serial_port(): Promise<string | null>;

// Refresh the list of available serial ports (web: previously authorized USB devices)
export declare function refresh_serial_ports(): Promise<string[]>;

/** Browse _ayab._tcp.local. services. macOS uses Bonjour; other platforms return []. */
export declare function browse_ayab_mdns(): any[];

// Register a resolver to be called when data arrives in the background read loop (web only)
// On web: Registers a callback that will be invoked when new data is received
// Returns a function that removes the resolver from the array when called
// On native: Not implemented (not needed for native)
export declare function registerDataAvailableResolver(
  resolver: () => void,
): () => void;
