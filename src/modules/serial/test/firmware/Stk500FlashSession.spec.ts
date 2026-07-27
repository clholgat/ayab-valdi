import "jasmine/src/jasmine";
import { Stk500FlashSession } from "serial/src/firmware/Stk500FlashSession";
import { AYAB_FIRMWARE_UNO_HEX } from "serial/src/firmware/generated/AyabFirmwareUnoHex";
import { buildFlashImage, chunkIntoPages, parseIntelHex } from "serial/src/firmware/IntelHexParser";
import { UNO_PAGE_SIZE } from "serial/src/firmware/Stk500Protocol";
import { MockStk500Bootloader } from "./MockStk500Bootloader";

function collectOutput(): { log: string[]; onOutput: (text: string) => void } {
  const log: string[] = [];
  return { log, onOutput: (text: string) => log.push(text) };
}

describe("Stk500FlashSession", () => {
  it("flashes successfully, reporting monotonic progress up to the total byte count", async () => {
    const transport = new MockStk500Bootloader();
    const session = Stk500FlashSession.start({ serialPort: "COM-fake", transport });
    const { log, onOutput } = collectOutput();
    const progressCalls: Array<[number, number]> = [];

    const result = await session.run({
      onOutput,
      onProgress: (written, total) => progressCalls.push([written, total]),
      isDestroyed: () => false,
    });

    expect(result).toBe("finished");
    expect(progressCalls.length).toBeGreaterThan(0);

    let previous = 0;
    for (const [written] of progressCalls) {
      expect(written).toBeGreaterThan(previous);
      previous = written;
    }
    const [, total] = progressCalls[progressCalls.length - 1]!;
    expect(previous).toBe(total);
    expect(log.some((line) => line.includes("Flash complete."))).toBe(true);

    // Cross-check the mock's in-memory flash against the real vendored firmware.
    const image = buildFlashImage(parseIntelHex(AYAB_FIRMWARE_UNO_HEX));
    expect(Array.from(transport.flash.slice(0, image.bytes.length))).toEqual(
      Array.from(image.bytes),
    );
  });

  it("returns 'error' with a diagnostic message when the bootloader never syncs", async () => {
    const transport = new MockStk500Bootloader({ neverSync: true });
    const session = Stk500FlashSession.start({
      serialPort: "COM-fake",
      transport,
      syncTimeoutMs: 50,
    });
    const { log, onOutput } = collectOutput();

    const result = await session.run({
      onOutput,
      onProgress: () => {},
      isDestroyed: () => false,
    });

    expect(result).toBe("error");
    expect(log.some((line) => line.includes("Could not sync with the bootloader"))).toBe(true);
  });

  it("returns 'error' when a page fails read-back verification", async () => {
    const transport = new MockStk500Bootloader({ corruptPageAtAddress: 0 });
    const session = Stk500FlashSession.start({ serialPort: "COM-fake", transport });
    const { log, onOutput } = collectOutput();

    const result = await session.run({
      onOutput,
      onProgress: () => {},
      isDestroyed: () => false,
    });

    expect(result).toBe("error");
    expect(log.some((line) => line.includes("verification failed"))).toBe(true);
  });

  it("cancel() mid-run stops further page writes and returns 'cancelled'", async () => {
    const transport = new MockStk500Bootloader();
    const session = Stk500FlashSession.start({ serialPort: "COM-fake", transport });
    const { onOutput } = collectOutput();

    const totalPages = chunkIntoPages(
      buildFlashImage(parseIntelHex(AYAB_FIRMWARE_UNO_HEX)),
      UNO_PAGE_SIZE,
    ).length;
    expect(totalPages).toBeGreaterThan(1);

    let progressCalls = 0;
    const result = await session.run({
      onOutput,
      onProgress: () => {
        progressCalls += 1;
        if (progressCalls === 1) {
          session.cancel();
        }
      },
      isDestroyed: () => false,
    });

    expect(result).toBe("cancelled");
    expect(progressCalls).toBeLessThan(totalPages);
  });
});
