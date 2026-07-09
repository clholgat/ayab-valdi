/** SLIP + AYAB token helpers for E2E mock firmware. */

export const Token = {
  reqInfo: 0x03,
  cnfInfo: 0xc3,
  reqInit: 0x05,
  cnfInit: 0xc5,
  reqStart: 0x01,
  cnfStart: 0xc1,
  reqLine: 0x82,
  cnfLine: 0x42,
  indState: 0x84,
  quitCmd: 0x2f,
};

const SLIP_END = 0xc0;
const SLIP_ESC = 0xdb;
const SLIP_ESC_END = 0xdc;
const SLIP_ESC_ESC = 0xdd;

export function slipEncode(data) {
  const encoded = [];
  for (const byte of data) {
    if (byte === SLIP_END) {
      encoded.push(SLIP_ESC, SLIP_ESC_END);
    } else if (byte === SLIP_ESC) {
      encoded.push(SLIP_ESC, SLIP_ESC_ESC);
    } else {
      encoded.push(byte);
    }
  }
  encoded.push(SLIP_END);
  return Buffer.from(encoded);
}

export function slipDecode(buffer) {
  const frames = [];
  let frame = [];
  let i = 0;
  while (i < buffer.length) {
    const byte = buffer[i];
    if (byte === SLIP_END) {
      if (frame.length > 0) {
        frames.push(Uint8Array.from(frame));
        frame = [];
      }
      i++;
    } else if (byte === SLIP_ESC && i + 1 < buffer.length) {
      const next = buffer[i + 1];
      if (next === SLIP_ESC_END) {
        frame.push(SLIP_END);
        i += 2;
      } else if (next === SLIP_ESC_ESC) {
        frame.push(SLIP_ESC);
        i += 2;
      } else {
        frame.push(byte);
        i++;
      }
    } else {
      frame.push(byte);
      i++;
    }
  }
  return { frames, consumed: i };
}

export function cnfInfoFrame() {
  return new Uint8Array([Token.cnfInfo, 6, 1, 0, 0]);
}

export function cnfInitFrame() {
  return new Uint8Array([Token.cnfInit, 0]);
}

export function indStateFrame() {
  return new Uint8Array([
    Token.indState,
    0,
    1,
    0xff,
    0xff,
    0xff,
    0xff,
    0xff,
    0,
    1,
  ]);
}

export function cnfStartFrame() {
  return new Uint8Array([Token.cnfStart, 0]);
}

export function reqLineFrame(lineNumber) {
  return new Uint8Array([Token.reqLine, lineNumber & 0xff]);
}
