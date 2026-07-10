import "jasmine/src/jasmine";
import { Token } from "constants/src/SerialConstants";
import { Communication, addCrc, slipDecodeChunk, withTimeout } from "serial/src/Communication";

describe("Communication", () => {
  describe("withTimeout", () => {
    it("resolves with the underlying value when it settles before the timeout", async () => {
      const result = await withTimeout(Promise.resolve(42), 200, () => {});
      expect(result).toBe(42);
    });

    it("rejects and invokes onTimeout when the promise never settles in time", async () => {
      const never = new Promise<number>(() => {
        // Deliberately never resolves - simulates a silent device.
      });
      let onTimeoutCalls = 0;
      let threw = false;
      try {
        await withTimeout(never, 20, () => {
          onTimeoutCalls += 1;
        });
      } catch (error) {
        threw = true;
      }
      expect(threw).toBe(true);
      expect(onTimeoutCalls).toBe(1);
    });

    it("does not invoke onTimeout once the promise has already resolved", async () => {
      let onTimeoutCalls = 0;
      const result = await withTimeout(Promise.resolve("ok"), 30, () => {
        onTimeoutCalls += 1;
      });
      expect(result).toBe("ok");
      // Wait past where the timeout would have fired if it weren't cancelled.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(onTimeoutCalls).toBe(0);
    });

    it("propagates rejection from the underlying promise without calling onTimeout", async () => {
      let onTimeoutCalls = 0;
      let caught: unknown;
      try {
        await withTimeout(Promise.reject(new Error("device error")), 200, () => {
          onTimeoutCalls += 1;
        });
      } catch (error) {
        caught = error;
      }
      expect((caught as Error)?.message).toBe("device error");
      expect(onTimeoutCalls).toBe(0);
    });
  });

  describe("slipDecodeChunk", () => {
    const SLIP_END = 0xc0;

    it("decodes a single frame delivered in one chunk", () => {
      const data = new Uint8Array([1, 2, 3, SLIP_END]);
      const { frames, remaining } = slipDecodeChunk(new Uint8Array(0), data);
      expect(frames.length).toBe(1);
      expect(Array.from(frames[0]!)).toEqual([1, 2, 3]);
      expect(remaining.length).toBe(0);
    });

    it("reconstructs a frame split across multiple reads instead of dropping it", () => {
      // First chunk arrives without the terminating SLIP_END - the frame is incomplete.
      const first = slipDecodeChunk(new Uint8Array(0), new Uint8Array([0xaa, 1, 2]));
      expect(first.frames.length).toBe(0);
      // The 3 in-progress bytes must be preserved for the next call, not dropped.
      expect(Array.from(first.remaining)).toEqual([0xaa, 1, 2]);

      // Second chunk completes the frame.
      const second = slipDecodeChunk(first.remaining, new Uint8Array([3, SLIP_END]));
      expect(second.frames.length).toBe(1);
      expect(Array.from(second.frames[0]!)).toEqual([0xaa, 1, 2, 3]);
      expect(second.remaining.length).toBe(0);
    });

    it("reconstructs a frame split across three reads", () => {
      const a = slipDecodeChunk(new Uint8Array(0), new Uint8Array([1]));
      const b = slipDecodeChunk(a.remaining, new Uint8Array([2]));
      const c = slipDecodeChunk(b.remaining, new Uint8Array([3, SLIP_END]));
      expect(c.frames.length).toBe(1);
      expect(Array.from(c.frames[0]!)).toEqual([1, 2, 3]);
    });

    it("handles a second frame starting immediately after one completes mid-chunk", () => {
      const data = new Uint8Array([1, 2, SLIP_END, 3, 4]);
      const { frames, remaining } = slipDecodeChunk(new Uint8Array(0), data);
      expect(frames.length).toBe(1);
      expect(Array.from(frames[0]!)).toEqual([1, 2]);
      // The second (incomplete) frame's bytes must be preserved, not dropped.
      expect(Array.from(remaining)).toEqual([3, 4]);
    });
  });

  describe("addCrc", () => {
    it("matches reqStart fixture from test_communication.py", () => {
      const data = new Uint8Array([
        Token.reqStart,
        0,
        10,
        3, // continuous_reporting + hardware beep enabled
      ]);
      expect(addCrc(data)).toBe(0x8a);
    });

    it("matches cnfLine fixture from test_communication.py", () => {
      const lineData = new Uint8Array(25);
      lineData[0] = 0xde;
      lineData[1] = 0xad;
      lineData[2] = 0xbe;
      lineData[3] = 0xef;
      const data = new Uint8Array([
        Token.cnfLine,
        0,
        0,
        1,
        ...lineData,
      ]);
      expect(addCrc(data)).toBe(0xa7);
    });
  });

  describe("parse_API6", () => {
    let comm: Communication;

    beforeEach(() => {
      comm = new Communication();
    });

    it("returns none for null message", () => {
      expect(comm.parse_API6(null)).toEqual([null, Token.none, 0]);
    });

    it("returns cnfStart token and param", () => {
      const msg = new Uint8Array([Token.cnfStart, 0]);
      expect(comm.parse_API6(msg)).toEqual([msg, Token.cnfStart, 0]);
    });

    it("returns unknown token for unrecognized values", () => {
      const msg = new Uint8Array([0xff, 1]);
      const [parsed, token, param] = comm.parse_API6(msg);
      expect(parsed).toBe(msg);
      expect(token).toBe(Token.unknown);
      expect(param).toBe(0);
    });
  });
});
