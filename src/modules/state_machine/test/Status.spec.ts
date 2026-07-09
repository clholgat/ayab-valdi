import "jasmine/src/jasmine";
import {
  Status,
  Direction,
  Carriage,
} from "state_machine/src/Status";

describe("Status", () => {
  it("Direction.reverse swaps left and right", () => {
    expect(Direction.reverse(Direction.Left)).toBe(Direction.Right);
    expect(Direction.reverse(Direction.Right)).toBe(Direction.Left);
    expect(Direction.reverse(Direction.Unknown)).toBe(Direction.Unknown);
  });

  it("Direction.symbol and text map carriage direction", () => {
    expect(Direction.symbol(Direction.Left)).toBe("←");
    expect(Direction.text(Direction.Right)).toBe("Right");
  });

  it("Carriage.symbol and text map carriage type", () => {
    expect(Carriage.symbol(Carriage.Knit)).toBe("K");
    expect(Carriage.text(Carriage.Lace)).toBe("Lace");
  });

  it("reset restores defaults", () => {
    const status = new Status();
    status.currentRow = 5;
    status.color = 2;
    status.carriageType = Carriage.Garter;
    status.reset();
    expect(status.currentRow).toBe(-1);
    expect(status.color).toBe(-1);
    expect(status.carriageType as Carriage).toBe(Carriage.Unknown);
  });

  it("parseDeviceState parses API6 device message (port test_status.py)", () => {
    const status = new Status();
    status.active = true;
    const msg = new Uint8Array([0, 99, 1, 2, 3, 4, 5, 0, 7, 1]);
    status.parseDeviceState(1, msg);
    expect(status.hallL).toBe(0x203);
    expect(status.hallR).toBe(0x405);
    expect(status.carriageType).toBe(Carriage.Knit);
    expect(status.carriagePosition).toBe(7);
    expect(status.carriageDirection).toBe(Direction.Right);
    expect(status.firmwareState).toBe(1);
  });

  it("parseDeviceState is ignored when inactive", () => {
    const status = new Status();
    status.active = false;
    const msg = new Uint8Array([0, 99, 1, 2, 3, 4, 5, 0, 7, 1]);
    status.parseDeviceState(1, msg);
    expect(status.carriagePosition).toBe(-1);
    expect(status.hallL).toBe(0);
  });

  it("copy duplicates status fields", () => {
    const a = new Status();
    a.currentRow = 3;
    a.colorSymbol = "B";
    a.carriageDirection = Direction.Left;
    const b = new Status();
    b.copy(a);
    expect(b.currentRow).toBe(3);
    expect(b.colorSymbol).toBe("B");
    expect(b.carriageDirection).toBe(Direction.Left);
  });
});
