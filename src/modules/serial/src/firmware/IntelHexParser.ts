/**
 * Pure Intel HEX parser for AVR flash images (no I/O).
 * Parses `:llaaaatt[data]cc` records into a flat, page-chunkable memory image.
 */

const RECORD_TYPE_DATA = 0x00;
const RECORD_TYPE_EOF = 0x01;
const RECORD_TYPE_EXTENDED_LINEAR_ADDRESS = 0x04;

/** Value of an unwritten (erased) AVR flash byte. */
const ERASED_FLASH_BYTE = 0xff;

export interface HexRecord {
  type: number;
  address: number;
  data: Uint8Array;
}

function hexByte(line: string, offset: number, lineNumber: number): number {
  const text = line.substr(offset, 2);
  const value = parseInt(text, 16);
  if (text.length !== 2 || Number.isNaN(value)) {
    throw new Error(`Intel HEX line ${lineNumber}: invalid hex byte at offset ${offset}`);
  }
  return value;
}

export function parseIntelHexLine(line: string, lineNumber: number): HexRecord {
  if (line[0] !== ":") {
    throw new Error(`Intel HEX line ${lineNumber}: missing ':' prefix`);
  }

  const byteCount = hexByte(line, 1, lineNumber);
  const address = (hexByte(line, 3, lineNumber) << 8) | hexByte(line, 5, lineNumber);
  const type = hexByte(line, 7, lineNumber);

  const dataStart = 9;
  const expectedLength = dataStart + byteCount * 2 + 2;
  if (line.length < expectedLength) {
    throw new Error(`Intel HEX line ${lineNumber}: line shorter than declared byte count`);
  }

  const data = new Uint8Array(byteCount);
  let sum = byteCount + (address >> 8) + (address & 0xff) + type;
  for (let i = 0; i < byteCount; i++) {
    const value = hexByte(line, dataStart + i * 2, lineNumber);
    data[i] = value;
    sum += value;
  }

  const checksum = hexByte(line, dataStart + byteCount * 2, lineNumber);
  const computedChecksum = (0x100 - (sum & 0xff)) & 0xff;
  if (computedChecksum !== checksum) {
    throw new Error(
      `Intel HEX line ${lineNumber}: checksum mismatch (expected 0x${checksum
        .toString(16)
        .padStart(2, "0")}, computed 0x${computedChecksum.toString(16).padStart(2, "0")})`,
    );
  }

  return { type, address, data };
}

export function parseIntelHex(text: string): HexRecord[] {
  const records: HexRecord[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.length === 0) {
      continue;
    }
    records.push(parseIntelHexLine(line, i + 1));
  }
  return records;
}

export interface FlashImage {
  baseAddress: number;
  bytes: Uint8Array;
}

export function buildFlashImage(records: HexRecord[]): FlashImage {
  let extendedLinearAddress = 0;
  let minAddress = Number.POSITIVE_INFINITY;
  let maxAddress = Number.NEGATIVE_INFINITY;
  const chunks: Array<{ address: number; data: Uint8Array }> = [];

  for (const record of records) {
    if (record.type === RECORD_TYPE_EXTENDED_LINEAR_ADDRESS) {
      if (record.data.length !== 2) {
        throw new Error("Intel HEX: malformed extended linear address record");
      }
      extendedLinearAddress = ((record.data[0]! << 8) | record.data[1]!) << 16;
      continue;
    }
    if (record.type === RECORD_TYPE_EOF) {
      break;
    }
    if (record.type !== RECORD_TYPE_DATA) {
      // Ignore record types not used by AVR application images (e.g. start
      // segment/linear address records, which target x86 real mode).
      continue;
    }

    const absoluteAddress = extendedLinearAddress + record.address;
    chunks.push({ address: absoluteAddress, data: record.data });
    minAddress = Math.min(minAddress, absoluteAddress);
    maxAddress = Math.max(maxAddress, absoluteAddress + record.data.length);
  }

  if (chunks.length === 0) {
    return { baseAddress: 0, bytes: new Uint8Array(0) };
  }

  const bytes = new Uint8Array(maxAddress - minAddress).fill(ERASED_FLASH_BYTE);
  for (const chunk of chunks) {
    bytes.set(chunk.data, chunk.address - minAddress);
  }
  return { baseAddress: minAddress, bytes };
}

export interface FlashPage {
  address: number;
  data: Uint8Array;
}

/** Chunks a flash image into page-aligned, page-sized (0xFF-padded) pages. */
export function chunkIntoPages(image: FlashImage, pageSize: number): FlashPage[] {
  if (image.bytes.length === 0) {
    return [];
  }

  const imageEnd = image.baseAddress + image.bytes.length;
  const firstPageAddress = Math.floor(image.baseAddress / pageSize) * pageSize;
  const pages: FlashPage[] = [];

  for (
    let pageAddress = firstPageAddress;
    pageAddress < imageEnd;
    pageAddress += pageSize
  ) {
    const page = new Uint8Array(pageSize).fill(ERASED_FLASH_BYTE);
    for (let i = 0; i < pageSize; i++) {
      const byteAddress = pageAddress + i;
      if (byteAddress >= image.baseAddress && byteAddress < imageEnd) {
        page[i] = image.bytes[byteAddress - image.baseAddress]!;
      }
    }
    pages.push({ address: pageAddress, data: page });
  }

  return pages;
}
