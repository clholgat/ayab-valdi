import "jasmine/src/jasmine";
import {
  rotateLeft,
  hflip,
  vflip,
  invert,
  stretch,
  repeat,
  parseRepeatCount,
} from "preview/src/ImageTransform";

describe("ImageTransform", () => {
  it("rotateLeft rotates 2x3 to 3x2", () => {
    const bits = [
      [new Uint8Array([1]), new Uint8Array([2])],
      [new Uint8Array([3]), new Uint8Array([4])],
      [new Uint8Array([5]), new Uint8Array([6])],
    ];
    const rotated = rotateLeft(bits);
    expect(rotated.length).toBe(2);
    expect(rotated[0]!.length).toBe(3);
    expect(rotated[0]![0]![0]).toBe(5);
    expect(rotated[1]![2]![0]).toBe(2);
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
