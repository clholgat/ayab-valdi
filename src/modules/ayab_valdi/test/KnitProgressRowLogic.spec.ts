import "jasmine/src/jasmine";
import {
  alternateBedHex,
  colorToHex,
  computeKnitProgressCells,
  isColumnSelected,
  knitProgressStitchColor,
  needleNumberFromR1,
} from "ayab_valdi/src/KnitProgressRowLogic";

describe("KnitProgressRowLogic", () => {
  const baseVm = {
    title: "To Be Selected",
    bits: new Uint8Array([0b00000001]),
    knitStartNeedle: 98,
    knitNeedleCount: 4,
    machineWidth: 200,
    color: 0xff0000,
    altColor: 0x00ff00,
  };

  it("colorToHex formats 24-bit palette values", () => {
    expect(colorToHex(0xff8040)).toBe("#ff8040");
  });

  it("isColumnSelected reads packed little-endian bits", () => {
    expect(isColumnSelected(new Uint8Array([0b00001010]), 1)).toBe(true);
    expect(isColumnSelected(new Uint8Array([0b00001010]), 0)).toBe(false);
  });

  it("needleNumberFromR1 labels left and right bed needles", () => {
    expect(needleNumberFromR1(90, 200)).toBe("10");
    expect(needleNumberFromR1(110, 200)).toBe("11");
  });

  it("knitProgressStitchColor uses yarn color for selected stitches", () => {
    expect(knitProgressStitchColor(baseVm, 0, true)).toBe("#ff0000");
  });

  it("knitProgressStitchColor uses alt color for unselected single-bed rows", () => {
    expect(knitProgressStitchColor(baseVm, 1, false)).toBe("#00ff00");
  });

  it("knitProgressStitchColor falls back to bed stripes without alt color", () => {
    const vm = { ...baseVm, altColor: null };
    expect(knitProgressStitchColor(vm, 1, false)).toBe(
      alternateBedHex(vm.knitStartNeedle + 1, vm.machineWidth),
    );
  });

  it("computeKnitProgressCells marks selected column and needle labels", () => {
    const cells = computeKnitProgressCells(baseVm);
    expect(cells.length).toBe(4);
    expect(cells[0]!.backgroundColor).toBe("#ff0000");
    expect(cells[1]!.backgroundColor).toBe("#00ff00");
    expect(cells[0]!.numberLabel).toBe("2");
    expect(cells[3]!.isLeftNumber).toBe(false);
  });
});
