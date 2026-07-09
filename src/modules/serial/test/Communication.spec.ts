import "jasmine/src/jasmine";
import { Token } from "constants/src/SerialConstants";
import { Communication, addCrc } from "serial/src/Communication";

describe("Communication", () => {
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
