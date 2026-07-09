import "jasmine/src/jasmine";
import { Token } from "constants/src/SerialConstants";
import { HardwareTestCommunicationMock } from "serial/src/HardwareTestCommunicationMock";

function drainTestText(com: HardwareTestCommunicationMock): string {
  let text = "";
  for (let i = 0; i < 64; i++) {
    const [msg, token] = com.update_API6();
    if (token === Token.none) {
      break;
    }
    if (token === Token.testRes && msg != null && msg.length > 1) {
      text += new TextDecoder().decode(msg.slice(1));
    }
  }
  return text;
}

describe("HardwareTestCommunicationMock", () => {
  let com: HardwareTestCommunicationMock;

  beforeEach(() => {
    com = new HardwareTestCommunicationMock();
  });

  it("setup emits banner and help text", () => {
    com.setup();
    const text = drainTestText(com);
    expect(text).toContain("AYAB Hardware Test");
    expect(text).toContain("setSingle");
    expect(text).toContain("quit");
  });

  it("write_API6 help echoes command and help lines", () => {
    com.write_API6(new Uint8Array([Token.helpCmd]));
    const text = drainTestText(com);
    expect(text).toContain("Called help");
    expect(text).toContain("readEOLsensors");
  });

  it("write_API6 send returns 123", () => {
    com.write_API6(new Uint8Array([Token.sendCmd]));
    const text = drainTestText(com);
    expect(text).toContain("Called send");
    expect(text).toContain("123");
  });

  it("readEOLsensorsCmd reports sensor values", () => {
    com.write_API6(new Uint8Array([Token.readEOLsensorsCmd]));
    const text = drainTestText(com);
    expect(text).toContain("EOL_L");
    expect(text).toContain("EOL_R");
  });

  it("autoRead timer_event emits sensor reads on odd ticks", () => {
    com.write_API6(new Uint8Array([Token.autoReadCmd]));
    drainTestText(com);
    com.timer_event();
    const first = drainTestText(com);
    expect(first).not.toContain("ENC_A");
    com.timer_event();
    const second = drainTestText(com);
    expect(second).toContain("EOL_L");
    expect(second).toContain("ENC_A");
  });

  it("autoTest timer_event alternates solenoid messages", () => {
    com.write_API6(new Uint8Array([Token.autoTestCmd]));
    drainTestText(com);
    com.timer_event();
    expect(drainTestText(com)).toContain("Set even solenoids");
    com.timer_event();
    expect(drainTestText(com)).toContain("Set odd solenoids");
  });

  it("reqInfo and reqTest queue cnf responses", () => {
    com.reqInfo();
    expect(com.update_API6()[1]).toBe(Token.cnfInfo);
    com.reqTest();
    expect(com.update_API6()[1]).toBe(Token.cnfTest);
  });
});
