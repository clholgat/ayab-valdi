import { WebSocketServer } from "ws";

const Resp_STK_INSYNC = 0x14;
const Resp_STK_OK = 0x10;
const Cmnd_STK_ENTER_PROGMODE = 0x50;
const Cmnd_STK_LEAVE_PROGMODE = 0x51;
const Cmnd_STK_LOAD_ADDRESS = 0x55;
const Cmnd_STK_PROG_PAGE = 0x64;
const Cmnd_STK_READ_PAGE = 0x74;
// Cmnd_STK_GET_SYNC (0x30) matches any other unrecognized single-command
// frame too, so it isn't special-cased below - any 2-byte "cmd, 0x20" frame
// this handler doesn't otherwise recognize still gets a plain INSYNC/OK ack,
// which is all GET_SYNC needs.

const FLASH_SIZE = 32 * 1024;

/**
 * Minimal in-memory Optiboot/STK500v1 mock over WebSocket, for E2E-testing
 * Stk500FlashSession without real Arduino hardware (mirrors ayabWsServer.mjs's
 * role for the AYAB app protocol). Unlike that server, STK500 isn't
 * SLIP-framed, and Stk500FlashSession sends exactly one full command per
 * write() call, so each incoming WS message is already a complete frame -
 * no buffering/reassembly needed.
 */
export function startStk500WsServer(port = 0) {
  const wss = new WebSocketServer({ host: "127.0.0.1", port });

  wss.on("connection", (ws) => {
    const flash = new Uint8Array(FLASH_SIZE).fill(0xff);
    let loadedWordAddress = 0;

    const ack = () => new Uint8Array([Resp_STK_INSYNC, Resp_STK_OK]);

    ws.on("message", (data) => {
      const frame = new Uint8Array(data);
      const command = frame[0];

      if (command === Cmnd_STK_LOAD_ADDRESS) {
        loadedWordAddress = frame[1] | (frame[2] << 8);
        ws.send(ack());
        return;
      }

      if (command === Cmnd_STK_PROG_PAGE) {
        const pageSize = (frame[1] << 8) | frame[2];
        const pageData = frame.subarray(4, 4 + pageSize);
        flash.set(pageData, loadedWordAddress << 1);
        ws.send(ack());
        return;
      }

      if (command === Cmnd_STK_READ_PAGE) {
        const pageSize = (frame[1] << 8) | frame[2];
        const byteAddress = loadedWordAddress << 1;
        const page = flash.subarray(byteAddress, byteAddress + pageSize);
        const response = new Uint8Array(pageSize + 2);
        response[0] = Resp_STK_INSYNC;
        response.set(page, 1);
        response[response.length - 1] = Resp_STK_OK;
        ws.send(response);
        return;
      }

      // Cmnd_STK_GET_SYNC / Cmnd_STK_ENTER_PROGMODE / Cmnd_STK_LEAVE_PROGMODE
      // (and anything else) all just get a plain ack.
      void Cmnd_STK_ENTER_PROGMODE;
      void Cmnd_STK_LEAVE_PROGMODE;
      ws.send(ack());
    });
  });

  return new Promise((resolve, reject) => {
    wss.on("listening", () => {
      const address = wss.address();
      const actualPort =
        typeof address === "object" && address ? address.port : port;
      resolve({
        url: `ws://127.0.0.1:${actualPort}/ws`,
        close: () =>
          new Promise((closeResolve) => {
            wss.close(() => closeResolve());
          }),
      });
    });
    wss.on("error", reject);
  });
}
