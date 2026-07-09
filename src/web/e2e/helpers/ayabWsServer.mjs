import { WebSocketServer } from "ws";
import {
  Token,
  slipDecode,
  slipEncode,
  cnfInfoFrame,
  cnfInitFrame,
  indStateFrame,
  cnfStartFrame,
  reqLineFrame,
} from "./ayabProtocol.mjs";

/**
 * Minimal AYAB firmware mock over WebSocket (exercises Communication + SerialWeb).
 */
export function startAyabWsServer(port = 0) {
  const wss = new WebSocketServer({ host: "127.0.0.1", port });
  const rxBuffers = new WeakMap();
  /** Shared across reconnects until quitCmd (realistic sticky firmware state). */
  let gSharedKnitting = false;

  wss.on("connection", (ws) => {
    console.log("[ayab-mock] client connected");
    /** Sticky knit mode until quitCmd — matches real firmware across reconnects. */
    let knitting = gSharedKnitting;
    let lineNumber = 0;
    rxBuffers.set(ws, Buffer.alloc(0));

    const sendFrame = (frame) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(slipEncode(frame));
      }
    };

    const sendFrames = (frames) => {
      if (ws.readyState !== ws.OPEN || frames.length === 0) {
        return;
      }
      const parts = frames.map((frame) => slipEncode(frame));
      ws.send(Buffer.concat(parts));
    };

    const scheduleReqLine = () => {
      setTimeout(() => {
        if (knitting && ws.readyState === ws.OPEN) {
          sendFrame(reqLineFrame(lineNumber));
        }
      }, 30);
    };

    ws.on("message", (data) => {
      const prev = rxBuffers.get(ws) ?? Buffer.alloc(0);
      const combined = Buffer.concat([
        prev,
        Buffer.isBuffer(data) ? data : Buffer.from(data),
      ]);
      const { frames, consumed } = slipDecode(combined);
      rxBuffers.set(ws, combined.subarray(consumed));

      for (const frame of frames) {
        const token = frame[0];
        console.log("[ayab-mock] rx token", token);
        switch (token) {
          case Token.reqInfo:
            sendFrame(cnfInfoFrame());
            break;
          case Token.reqInit:
            // Firmware stuck in knit mode ignores init until quit.
            if (knitting) {
              console.log("[ayab-mock] ignoring reqInit while knitting");
              break;
            }
            sendFrames([cnfInitFrame(), indStateFrame()]);
            break;
          case Token.reqStart:
            knitting = true;
            gSharedKnitting = true;
            lineNumber = 0;
            sendFrame(cnfStartFrame());
            scheduleReqLine();
            break;
          case Token.cnfLine:
            if (knitting) {
              lineNumber = (lineNumber + 1) & 0xff;
              scheduleReqLine();
            }
            break;
          case Token.quitCmd:
            knitting = false;
            gSharedKnitting = false;
            lineNumber = 0;
            console.log("[ayab-mock] quit — left knit mode");
            break;
          default:
            break;
        }
      }
    });

    ws.on("close", () => {
      // Keep gSharedKnitting: port close alone does not reset firmware.
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
