import "jasmine/src/jasmine";
import {
  buildFlashImage,
  chunkIntoPages,
  parseIntelHex,
  parseIntelHexLine,
} from "serial/src/firmware/IntelHexParser";

describe("IntelHexParser", () => {
  describe("parseIntelHexLine", () => {
    it("parses a single data record", () => {
      const record = parseIntelHexLine(":040000000C94340028", 1);
      expect(record.type).toBe(0x00);
      expect(record.address).toBe(0x0000);
      expect(Array.from(record.data)).toEqual([0x0c, 0x94, 0x34, 0x00]);
    });

    it("parses an extended linear address record", () => {
      const record = parseIntelHexLine(":020000040001F9", 1);
      expect(record.type).toBe(0x04);
      expect(Array.from(record.data)).toEqual([0x00, 0x01]);
    });

    it("parses an EOF record", () => {
      const record = parseIntelHexLine(":00000001FF", 1);
      expect(record.type).toBe(0x01);
      expect(record.data.length).toBe(0);
    });

    it("throws when the line is missing the ':' prefix", () => {
      expect(() => parseIntelHexLine("040000000C94340028", 3)).toThrowError(/line 3/);
    });

    it("throws on a checksum mismatch, naming the line number", () => {
      // Last byte (checksum) corrupted: 28 -> 29.
      expect(() => parseIntelHexLine(":040000000C94340029", 7)).toThrowError(/line 7/);
    });
  });

  describe("parseIntelHex", () => {
    it("parses multiple lines, skipping blank ones", () => {
      const text = [
        ":040000000C94340028",
        "",
        ":00000001FF",
        "",
      ].join("\n");
      const records = parseIntelHex(text);
      expect(records.length).toBe(2);
      expect(records[0]!.type).toBe(0x00);
      expect(records[1]!.type).toBe(0x01);
    });
  });

  describe("buildFlashImage", () => {
    it("flattens a single data record at address 0", () => {
      const records = parseIntelHex([":040000000C94340028", ":00000001FF"].join("\n"));
      const image = buildFlashImage(records);
      expect(image.baseAddress).toBe(0);
      expect(Array.from(image.bytes)).toEqual([0x0c, 0x94, 0x34, 0x00]);
    });

    it("applies extended linear address records to later data records", () => {
      // ELA sets the upper 16 bits to 0x0001 (absolute base 0x00010000), then a
      // data record at local address 0x0002 lands at 0x00010002.
      const records = parseIntelHex(
        [":020000040001F9", ":02000200CCDD53", ":00000001FF"].join("\n"),
      );
      const image = buildFlashImage(records);
      expect(image.baseAddress).toBe(0x00010002);
      expect(Array.from(image.bytes)).toEqual([0xcc, 0xdd]);
    });

    it("stops processing at the EOF record", () => {
      // A bogus data record placed after EOF must be ignored.
      const records = parseIntelHex(
        [":040000000C94340028", ":00000001FF", ":02001000AABB89"].join("\n"),
      );
      const image = buildFlashImage(records);
      expect(Array.from(image.bytes)).toEqual([0x0c, 0x94, 0x34, 0x00]);
    });

    it("fills gaps between non-contiguous records with 0xFF", () => {
      const records = parseIntelHex(
        [":040000000C94340028", ":02001000AABB89", ":00000001FF"].join("\n"),
      );
      const image = buildFlashImage(records);
      expect(image.baseAddress).toBe(0x0000);
      // 4 bytes of data, 12 bytes of 0xFF gap (addresses 0x0004..0x000F), then 2 bytes of data.
      expect(Array.from(image.bytes)).toEqual([
        0x0c, 0x94, 0x34, 0x00,
        ...new Array(12).fill(0xff),
        0xaa, 0xbb,
      ]);
    });

    it("returns an empty image when there are no data records", () => {
      const image = buildFlashImage(parseIntelHex(":00000001FF"));
      expect(image.baseAddress).toBe(0);
      expect(image.bytes.length).toBe(0);
    });
  });

  describe("chunkIntoPages", () => {
    it("chunks an exact multiple of the page size with no padding", () => {
      const image = { baseAddress: 0, bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) };
      const pages = chunkIntoPages(image, 4);
      expect(pages.length).toBe(2);
      expect(pages[0]!.address).toBe(0);
      expect(Array.from(pages[0]!.data)).toEqual([1, 2, 3, 4]);
      expect(pages[1]!.address).toBe(4);
      expect(Array.from(pages[1]!.data)).toEqual([5, 6, 7, 8]);
    });

    it("pads a trailing partial page with 0xFF", () => {
      const image = { baseAddress: 0, bytes: new Uint8Array([1, 2, 3]) };
      const pages = chunkIntoPages(image, 4);
      expect(pages.length).toBe(1);
      expect(Array.from(pages[0]!.data)).toEqual([1, 2, 3, 0xff]);
    });

    it("page-aligns a non-zero, non-page-aligned base address", () => {
      const image = { baseAddress: 2, bytes: new Uint8Array([1, 2, 3, 4]) };
      const pages = chunkIntoPages(image, 4);
      // First page starts at 0 (floor(2/4)*4), padded with 0xFF for bytes 0-1,
      // holding the image's first 2 bytes at offsets 2-3.
      expect(pages[0]!.address).toBe(0);
      expect(Array.from(pages[0]!.data)).toEqual([0xff, 0xff, 1, 2]);
      expect(pages[1]!.address).toBe(4);
      expect(Array.from(pages[1]!.data)).toEqual([3, 4, 0xff, 0xff]);
    });

    it("returns no pages for an empty image", () => {
      expect(chunkIntoPages({ baseAddress: 0, bytes: new Uint8Array(0) }, 4)).toEqual([]);
    });
  });
});
