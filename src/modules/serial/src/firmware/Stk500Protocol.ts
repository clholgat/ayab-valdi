/**
 * Pure STK500v1 (avrdude "arduino" programmer) frame builders/parsers.
 * Used to talk to the Optiboot bootloader on an Arduino Uno (ATmega328P).
 * No I/O here - callers own reading/writing bytes over the actual serial port.
 */

export const Cmnd_STK_GET_SYNC = 0x30;
export const Sync_CRC_EOP = 0x20;
export const Resp_STK_INSYNC = 0x14;
export const Resp_STK_OK = 0x10;
export const Cmnd_STK_ENTER_PROGMODE = 0x50;
export const Cmnd_STK_LEAVE_PROGMODE = 0x51;
export const Cmnd_STK_LOAD_ADDRESS = 0x55;
export const Cmnd_STK_PROG_PAGE = 0x64;
export const Cmnd_STK_READ_PAGE = 0x74;

export const UNO_PAGE_SIZE = 128;
export const UNO_FLASH_SIZE = 32 * 1024;

export type MemType = "F" | "E";

function memTypeByte(memType: MemType): number {
  return memType.charCodeAt(0);
}

export function buildGetSync(): Uint8Array {
  return new Uint8Array([Cmnd_STK_GET_SYNC, Sync_CRC_EOP]);
}

export function buildEnterProgMode(): Uint8Array {
  return new Uint8Array([Cmnd_STK_ENTER_PROGMODE, Sync_CRC_EOP]);
}

export function buildLeaveProgMode(): Uint8Array {
  return new Uint8Array([Cmnd_STK_LEAVE_PROGMODE, Sync_CRC_EOP]);
}

/** wordAddress is the flash byte address divided by 2 - STK500 addresses flash in 16-bit words. */
export function buildLoadAddress(wordAddress: number): Uint8Array {
  return new Uint8Array([
    Cmnd_STK_LOAD_ADDRESS,
    wordAddress & 0xff,
    (wordAddress >> 8) & 0xff,
    Sync_CRC_EOP,
  ]);
}

export function buildProgPage(
  pageSizeBytes: number,
  memType: MemType,
  data: Uint8Array,
): Uint8Array {
  if (data.length !== pageSizeBytes) {
    throw new Error(
      `buildProgPage: data length ${data.length} does not match pageSizeBytes ${pageSizeBytes}`,
    );
  }
  const frame = new Uint8Array(4 + data.length + 1);
  frame[0] = Cmnd_STK_PROG_PAGE;
  frame[1] = (pageSizeBytes >> 8) & 0xff;
  frame[2] = pageSizeBytes & 0xff;
  frame[3] = memTypeByte(memType);
  frame.set(data, 4);
  frame[frame.length - 1] = Sync_CRC_EOP;
  return frame;
}

export function buildReadPage(pageSizeBytes: number, memType: MemType): Uint8Array {
  return new Uint8Array([
    Cmnd_STK_READ_PAGE,
    (pageSizeBytes >> 8) & 0xff,
    pageSizeBytes & 0xff,
    memTypeByte(memType),
    Sync_CRC_EOP,
  ]);
}

/** True if a short (INSYNC, OK) acknowledgement response is well-formed. */
export function isSyncOk(response: Uint8Array): boolean {
  return (
    response.length >= 2 &&
    response[0] === Resp_STK_INSYNC &&
    response[1] === Resp_STK_OK
  );
}

/**
 * Extracts the page payload from a Cmnd_STK_READ_PAGE response, which is
 * shaped [INSYNC, ...pageSizeBytes data, OK]. Returns null if the response
 * isn't exactly that shape (wrong length, missing INSYNC/OK framing).
 */
export function parseReadPageResponse(
  response: Uint8Array,
  pageSizeBytes: number,
): Uint8Array | null {
  if (response.length !== pageSizeBytes + 2) {
    return null;
  }
  if (response[0] !== Resp_STK_INSYNC || response[response.length - 1] !== Resp_STK_OK) {
    return null;
  }
  return response.slice(1, 1 + pageSizeBytes);
}
