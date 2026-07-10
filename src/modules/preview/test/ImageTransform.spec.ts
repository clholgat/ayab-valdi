import "jasmine/src/jasmine";
import {
  rotateLeft,
  rotateRight,
  hflip,
  vflip,
  invert,
  stretch,
  repeat,
  parseRepeatCount,
} from "preview/src/ImageTransform";

/** Flatten a bits grid's first channel to plain numbers for easy comparison. */
function flat(bits: Uint8Array[][]): number[][] {
  return bits.map((row) => row.map((pixel) => pixel[0]!));
}

describe("ImageTransform", () => {
  // 3 rows x 2 cols, values chosen so direction (CW vs CCW) is unambiguous:
  //   1 2
  //   3 4
  //   5 6
  const bits = [
    [new Uint8Array([1]), new Uint8Array([2])],
    [new Uint8Array([3]), new Uint8Array([4])],
    [new Uint8Array([5]), new Uint8Array([6])],
  ];

  it("rotateLeft rotates counter-clockwise (left turn)", () => {
    // Rotating the grid left (CCW) 90 degrees: the right column (2,4,6)
    // becomes the top row, in the same top-to-bottom order.
    const rotated = rotateLeft(bits);
    expect(rotated.length).toBe(2);
    expect(rotated[0]!.length).toBe(3);
    expect(flat(rotated)).toEqual([
      [2, 4, 6],
      [1, 3, 5],
    ]);
  });

  it("rotateRight rotates clockwise (right turn)", () => {
    // Rotating the grid right (CW) 90 degrees: the left column (1,3,5)
    // becomes the top row, in reverse (bottom-to-top) order.
    const rotated = rotateRight(bits);
    expect(rotated.length).toBe(2);
    expect(rotated[0]!.length).toBe(3);
    expect(flat(rotated)).toEqual([
      [5, 3, 1],
      [6, 4, 2],
    ]);
  });

  it("rotating left then right returns to the original", () => {
    expect(flat(rotateRight(rotateLeft(bits)))).toEqual(flat(bits));
  });

  it("hflip mirrors columns", () => {
    const left = new Uint8Array([10]);
    const right = new Uint8Array([20]);
    const flipped = hflip([[left, right]]);
    expect(flipped[0]![0]).toBe(right);
    expect(flipped[0]![1]).toBe(left);
  });

  it("vflip reverses rows", () => {
    const top = [new Uint8Array([1])];
    const bottom = [new Uint8Array([2])];
    const flipped = vflip([top, bottom]);
    expect(flipped[0]).toBe(bottom);
    expect(flipped[1]).toBe(top);
  });

  it("invert inverts RGB channels", () => {
    const pixel = new Uint8Array([0, 128, 255, 255]);
    const out = invert([[pixel]])[0]![0]!;
    expect(out[0]).toBe(255);
    expect(out[1]).toBe(127);
    expect(out[2]).toBe(0);
    expect(out[3]).toBe(255);
  });

  it("stretch with count 1 returns the same dimensions", () => {
    const cell = [new Uint8Array([42])];
    const out = stretch([cell], 1, 1);
    expect(out.length).toBe(1);
    expect(out[0]!.length).toBe(1);
    expect(out[0]![0]![0]).toBe(42);
  });

  it("stretch doubles width and height", () => {
    const cell = [new Uint8Array([42])];
    const out = stretch([cell], 2, 2);
    expect(out.length).toBe(2);
    expect(out[0]!.length).toBe(2);
    expect(out[1]!.length).toBe(2);
    expect(out[0]![0]![0]).toBe(42);
    expect(out[1]![1]![0]).toBe(42);
  });

  it("repeat with count 1 returns the same dimensions", () => {
    const cell = [new Uint8Array([42])];
    const out = repeat([cell], 1, 1);
    expect(out.length).toBe(1);
    expect(out[0]!.length).toBe(1);
    expect(out[0]![0]![0]).toBe(42);
  });

  it("repeat doubles width and height", () => {
    const cell = [new Uint8Array([42])];
    const out = repeat([cell], 2, 2);
    expect(out.length).toBe(2);
    expect(out[0]!.length).toBe(2);
    expect(out[1]!.length).toBe(2);
    expect(out[0]![0]![0]).toBe(42);
    expect(out[1]![1]![0]).toBe(42);
  });

  it("parseRepeatCount clamps invalid and oversized values", () => {
    expect(parseRepeatCount("3")).toBe(3);
    expect(parseRepeatCount("  2 ")).toBe(2);
    expect(parseRepeatCount("abc")).toBe(1);
    expect(parseRepeatCount("0")).toBe(1);
    expect(parseRepeatCount("150")).toBe(99);
  });
});
