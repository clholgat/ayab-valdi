import "jasmine/src/jasmine";
import { Token } from "constants/src/SerialConstants";
import { Machine } from "state_machine/src/Machine";
import { CommunicationMock } from "serial/src/CommunicationMock";

describe("CommunicationMock", () => {
  let comm: CommunicationMock;

  beforeEach(() => {
    comm = new CommunicationMock(false);
  });

  it("closeSerial resets open state", () => {
    comm.openSerial("Simulation");
    comm.closeSerial();
    expect(comm.isOpen()).toBe(false);
  });

  it("openSerial opens the mock port", () => {
    expect(comm.isOpen()).toBe(false);
    comm.openSerial("Simulation");
    expect(comm.isOpen()).toBe(true);
  });

  it("update_API6 returns none when idle", () => {
    expect(comm.update_API6()).toEqual([null, Token.none, 0]);
  });

  it("reqStart queues cnfStart", () => {
    comm.reqStart(0, 10, true, false);
    expect(comm.update_API6()).toEqual([
      new Uint8Array([Token.cnfStart, 0]),
      Token.cnfStart,
      0,
    ]);
  });

  it("reqInfo queues cnfInfo with mock firmware version", () => {
    comm.reqInfo();
    expect(comm.update_API6()).toEqual([
      new Uint8Array([Token.cnfInfo, 6, 1, 0, 0, 109, 111, 99, 107, 0]),
      Token.cnfInfo,
      6,
    ]);
  });

  it("reqInit queues cnfInit then indState", () => {
    comm.reqInit(Machine.KH910_KH950);
    expect(comm.update_API6()).toEqual([
      new Uint8Array([Token.cnfInit, 0]),
      Token.cnfInit,
      0,
    ]);
    expect(comm.update_API6()).toEqual([
      new Uint8Array([
        Token.indState,
        0,
        1,
        0xff,
        0xff,
        0xff,
        0xff,
        0xff,
        0,
        1,
      ]),
      Token.indState,
      0,
    ]);
  });

  it("reqTest queues cnfTest", () => {
    comm.reqTest();
    expect(comm.update_API6()).toEqual([
      new Uint8Array([Token.cnfTest, 0]),
      Token.cnfTest,
      0,
    ]);
  });

  it("reqQuit leaves started knit mode so init can run again", () => {
    comm.openSerial("Simulation");
    comm.reqStart(0, 10, true, false);
    expect(comm.update_API6()[1]).toBe(Token.cnfStart);
    expect(comm.update_API6()[1]).toBe(Token.reqLine);
    comm.reqQuit();
    expect(comm.update_API6()[1]).toBe(Token.none);
  });

  it("cnfLine is a no-op", () => {
    expect(
      comm.cnfLine(13, 0, 0x12, new Uint8Array([0x23, 0x24])),
    ).toBeUndefined();
  });

  it("alternates reqLine and none after start", () => {
    comm.openSerial("Simulation");
    comm.reqStart(0, 10, true, false);
    comm.update_API6(); // cnfStart

    for (let i = 0; i < 256; i++) {
      expect(comm.update_API6()).toEqual([
        new Uint8Array([Token.reqLine, i]),
        Token.reqLine,
        i,
      ]);
      expect(comm.update_API6()).toEqual([null, Token.none, 0]);
    }
  });
});
