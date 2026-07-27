import "jasmine/src/jasmine";
import {
  AYAB_FIRMWARE_UNO_HEX,
  AYAB_FIRMWARE_UNO_SHA256,
  AYAB_FIRMWARE_UNO_VERSION,
} from "serial/src/firmware/generated/AyabFirmwareUnoHex";
import {
  buildFlashImage,
  chunkIntoPages,
  parseIntelHex,
} from "serial/src/firmware/IntelHexParser";
import { UNO_FLASH_SIZE, UNO_PAGE_SIZE } from "serial/src/firmware/Stk500Protocol";

/**
 * Guards against a corrupted/truncated vendoring run (scripts/pin-ayab-firmware.sh)
 * by parsing the real vendored firmware end to end and checking it against
 * known-good values recorded when 1.0.0 was pinned.
 */
describe("AyabFirmwareUnoHex (vendored firmware golden test)", () => {
  it("is pinned to the expected release", () => {
    expect(AYAB_FIRMWARE_UNO_VERSION).toBe("1.0.0");
    expect(AYAB_FIRMWARE_UNO_SHA256).toBe(
      "4e620ebf0bc1423117470947cccc138bcc733874022b02b688b79ee86b2b8a6a",
    );
  });

  it("parses into a flash image that fits within the Uno's flash size", () => {
    const records = parseIntelHex(AYAB_FIRMWARE_UNO_HEX);
    const image = buildFlashImage(records);

    expect(image.baseAddress).toBe(0);
    expect(image.bytes.length).toBe(13866);
    expect(image.bytes.length).toBeLessThanOrEqual(UNO_FLASH_SIZE);
  });

  it("chunks into whole, correctly-sized pages", () => {
    const image = buildFlashImage(parseIntelHex(AYAB_FIRMWARE_UNO_HEX));
    const pages = chunkIntoPages(image, UNO_PAGE_SIZE);

    expect(pages.length).toBe(Math.ceil(image.bytes.length / UNO_PAGE_SIZE));
    for (const page of pages) {
      expect(page.data.length).toBe(UNO_PAGE_SIZE);
    }
  });
});
