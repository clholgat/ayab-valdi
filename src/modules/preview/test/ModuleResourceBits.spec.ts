import "jasmine/src/jasmine";
import {
  loadModuleResourceBits,
  moduleResourceDataUrl,
  parseModuleResource,
} from "preview/src/ModuleResourceBits";

describe("parseModuleResource", () => {
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
