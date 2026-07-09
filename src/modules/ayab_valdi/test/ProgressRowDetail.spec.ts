import "jasmine/src/jasmine";
import { Status, Carriage, Direction } from "state_machine/src/Status";
import {
  formatRowDetail,
  formatCompletedRowDetail,
} from "ayab_valdi/src/ProgressRowDetail";

describe("ProgressRowDetail", () => {
  it("shows opposite direction arrows for current vs completed row", () => {
    const status = new Status();
    status.carriageType = Carriage.Knit;
    status.carriageDirection = Direction.Right;
    status.lineNumber = 1;
    status.passesPerRow = 1;

    expect(formatRowDetail(status)).toContain("→");
    expect(formatCompletedRowDetail(status)).toContain("←");
    expect(formatRowDetail(status)).not.toEqual(formatCompletedRowDetail(status));
  });

  it("includes pass and color symbols in row detail", () => {
    const status = new Status();
    status.carriageType = Carriage.Knit;
    status.carriageDirection = Direction.Left;
    status.lineNumber = 3;
    status.passesPerRow = 4;
    status.colorSymbol = "B";

    expect(formatRowDetail(status)).toContain("Pass 4/4");
    expect(formatRowDetail(status)).toContain("Color B");
    expect(formatRowDetail(status)).toContain("←");
  });
});
