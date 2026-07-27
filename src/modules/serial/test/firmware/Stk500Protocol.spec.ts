import "jasmine/src/jasmine";
import {
  buildEnterProgMode,
  buildGetSync,
  buildLeaveProgMode,
  buildLoadAddress,
  buildProgPage,
  buildReadPage,
  isSyncOk,
  parseReadPageResponse,
  Resp_STK_INSYNC,
  Resp_STK_OK,
} from "serial/src/firmware/Stk500Protocol";

describe("Stk500Protocol", () => {
  it("builds the get-sync frame", () => {
    expect(Array.from(buildGetSync())).toEqual([0x30, 0x20]);
  });

  it("builds the enter-progmode frame", () => {
    expect(Array.from(buildEnterProgMode())).toEqual([0x50, 0x20]);
  });

  it("builds the leave-progmode frame", () => {
    expect(Array.from(buildLeaveProgMode())).toEqual([0x51, 0x20]);
  });

  describe("buildLoadAddress", () => {
    it("encodes the word address little-endian", () => {
      expect(Array.from(buildLoadAddress(0x0000))).toEqual([0x55, 0x00, 0x00, 0x20]);
      expect(Array.from(buildLoadAddress(0x0080))).toEqual([0x55, 0x80, 0x00, 0x20]);
      expect(Array.from(buildLoadAddress(0x1234))).toEqual([0x55, 0x34, 0x12, 0x20]);
    });
  });

  describe("buildProgPage", () => {
    it("encodes page size big-endian, memtype, then data, then EOP", () => {
      const data = new Uint8Array(4).fill(0xaa);
      const frame = buildProgPage(4, "F", data);
      expect(Array.from(frame)).toEqual([
        0x64, 0x00, 0x04, 0x46, 0xaa, 0xaa, 0xaa, 0xaa, 0x20,
      ]);
    });

    it("uses the ASCII code for the 'E' (EEPROM) memtype", () => {
      const frame = buildProgPage(1, "E", new Uint8Array([0x01]));
      expect(Array.from(frame)).toEqual([0x64, 0x00, 0x01, 0x45, 0x01, 0x20]);
    });

    it("throws if data length does not match the declared page size", () => {
      expect(() => buildProgPage(4, "F", new Uint8Array(3))).toThrowError();
    });
  });

  describe("buildReadPage", () => {
    it("encodes page size big-endian, memtype, then EOP", () => {
      expect(Array.from(buildReadPage(128, "F"))).toEqual([0x74, 0x00, 0x80, 0x46, 0x20]);
    });
  });

  describe("isSyncOk", () => {
    it("is true for a well-formed [INSYNC, OK] response", () => {
      expect(isSyncOk(new Uint8Array([Resp_STK_INSYNC, Resp_STK_OK]))).toBe(true);
    });

    it("is true even with trailing bytes", () => {
      expect(isSyncOk(new Uint8Array([Resp_STK_INSYNC, Resp_STK_OK, 0xff]))).toBe(true);
    });

    it("is false when INSYNC is missing", () => {
      expect(isSyncOk(new Uint8Array([0x00, Resp_STK_OK]))).toBe(false);
    });

    it("is false when OK is missing", () => {
      expect(isSyncOk(new Uint8Array([Resp_STK_INSYNC, 0x00]))).toBe(false);
    });

    it("is false for a too-short response", () => {
      expect(isSyncOk(new Uint8Array([Resp_STK_INSYNC]))).toBe(false);
    });
  });

  describe("parseReadPageResponse", () => {
    it("extracts the page payload from a well-formed response", () => {
      const page = new Uint8Array([0x01, 0x02, 0x03]);
      const response = new Uint8Array([Resp_STK_INSYNC, ...page, Resp_STK_OK]);
      expect(Array.from(parseReadPageResponse(response, 3)!)).toEqual([0x01, 0x02, 0x03]);
    });

    it("returns null for the wrong length", () => {
      const response = new Uint8Array([Resp_STK_INSYNC, 0x01, Resp_STK_OK]);
      expect(parseReadPageResponse(response, 3)).toBeNull();
    });

    it("returns null when INSYNC/OK framing is missing", () => {
      const response = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x00]);
      expect(parseReadPageResponse(response, 3)).toBeNull();
    });
  });
});
