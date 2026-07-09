import "jasmine/src/jasmine";
import {
  flipRowsVertical,
  prepareImageBitsForKnit,
} from "state_machine/src/ImageOrientation";

describe("ImageOrientation", () => {
  it("flipRowsVertical reverses row order", () => {
    const row0 = [new Uint8Array([1, 0, 0, 255])];
    const row1 = [new Uint8Array([2, 0, 0, 255])];
    const row2 = [new Uint8Array([3, 0, 0, 255])];
    const bits = [row0, row1, row2];

    const flipped = flipRowsVertical(bits);

    expect(flipped.length).toBe(3);
    expect(flipped[0]).toBe(row2);
    expect(flipped[1]).toBe(row1);
    expect(flipped[2]).toBe(row0);
  });

  it("prepareImageBitsForKnit matches flipRowsVertical", () => {
    const bits = [
      [new Uint8Array([10])],
      [new Uint8Array([20])],
    ];
    const prepared = prepareImageBitsForKnit(bits);
    expect(prepared[0]![0]![0]).toBe(20);
    expect(prepared[1]![0]![0]).toBe(10);
  });
});
