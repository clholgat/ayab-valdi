import "jasmine/src/jasmine";
import {
  loadModuleResourceBits,
  moduleResourceBytes,
  moduleEntryBytesFromWebRegistry,
  moduleResourceDataUrl,
  parseModuleResource,
} from "preview/src/ModuleResourceBits";
import { readPngComment } from "process_image/src/PngMetadata";
import {
  parseAyabMemos,
  storedAyabMemosToImageRows,
} from "process_image/src/PatternMemo";

describe("parseModuleResource", () => {
  it("finds collapsed web module entries by their source-path suffix", () => {
    const bytes = moduleEntryBytesFromWebRegistry(
      {
        "../ayab_valdi+/modules/preview/src/patterns/triangles.png.bin":
          "iVBORw0KGgo=",
      },
      "src/patterns/triangles.png.bin",
    );
    expect(Array.from(bytes ?? [])).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  });

  it("parses module:stem refs", () => {
    expect(parseModuleResource("preview:spaceinvader_33x32")).toEqual({
      module: "preview",
      stem: "spaceinvader_33x32",
    });
  });

  it("parses nested module entries used by annotated patterns", () => {
    expect(parseModuleResource("preview:annotated/stitchworld-004")).toEqual({
      module: "preview",
      stem: "annotated/stitchworld-004",
    });
  });

  it("rejects paths and URIs", () => {
    expect(parseModuleResource("/tmp/foo.png")).toBeNull();
    expect(parseModuleResource("file:///tmp/foo.png")).toBeNull();
    expect(parseModuleResource("content://media/1")).toBeNull();
    expect(parseModuleResource("noseparator")).toBeNull();
  });
});

describe("loadModuleResourceBits", () => {
  it("exposes exact bundled PNG bytes as a data URL", () => {
    const dataUrl = moduleResourceDataUrl("preview:spaceinvader_33x32");
    expect(dataUrl).toBeDefined();
    expect(dataUrl!.startsWith("data:image/png;base64,iVBORw0KGgo")).toBeTrue();
  });

  it("exposes a synced annotated PNG from a nested module entry", () => {
    const dataUrl = moduleResourceDataUrl(
      "preview:annotated/stitchworld-004",
    );
    expect(dataUrl).toBeDefined();
    expect(dataUrl!.startsWith("data:image/png;base64,iVBORw0KGgo")).toBeTrue();
  });

  it("orients StitchWorld 94 memos like the printed chart", () => {
    const bytes = moduleResourceBytes("preview:annotated/stitchworld-094");
    expect(bytes).toBeDefined();
    const imageRows = storedAyabMemosToImageRows(
      parseAyabMemos(readPngComment(bytes!)),
    );

    // The original StitchWorld chart prints memo 4 at the soldier's hat,
    // memo 3 through the body, and memo 2 at the feet. The PNG Comment is
    // stored in knitting order (bottom first), so image display reverses it.
    expect(imageRows.length).toBe(66);
    expect(imageRows.slice(0, 10).join("")).toBe("0404040404");
    expect(imageRows.slice(20, 30).join("")).toBe("0404030303");
    expect(imageRows.slice(56).join("")).toBe("0303030302");
  });

  it("decodes a bundled sample at exact pixel dimensions", async () => {
    const bits = await loadModuleResourceBits("preview:spaceinvader_33x32");
    if (bits === null) {
      // Runtimes without the drawing/asset pipeline can't decode here;
      // app runtimes are covered on-device.
      pending("asset pipeline unavailable in this runtime");
      return;
    }
    expect(bits.length).toBe(32);
    expect(bits[0]!.length).toBe(33);
    expect(bits[0]![0]!.length).toBe(4);
  });

  it("returns null for a missing resource", async () => {
    expect(await loadModuleResourceBits("preview:nope_1x1")).toBeNull();
  });

  it("returns null for non-resource sources", async () => {
    expect(await loadModuleResourceBits("/tmp/foo.png")).toBeNull();
  });
});
