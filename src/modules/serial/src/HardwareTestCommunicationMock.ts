/**
 * Simulation mock for Operation.TEST — port of hw_test_communication_mock.py.
 */

import { Token } from "constants/src/SerialConstants";
import { Machine } from "state_machine/src/Machine";
import { ICommunication } from "constants/src/Interfaces";

const CMD_TOKENS: Token[] = [
  Token.helpCmd,
  Token.sendCmd,
  Token.beepCmd,
  Token.setSingleCmd,
  Token.setAllCmd,
  Token.readEOLsensorsCmd,
  Token.readEncodersCmd,
  Token.autoReadCmd,
  Token.autoTestCmd,
  Token.stopCmd,
  Token.quitCmd,
];

function parseToken(
  msg: Uint8Array | null,
): [Uint8Array | null, Token, number] {
  if (msg == null || msg.length === 0) {
    return [null, Token.none, 0];
  }
  const tokenValue = msg[0]!;
  const param = msg.length > 1 ? msg[1]! : 0;
  for (const key of Object.keys(Token) as Array<keyof typeof Token>) {
    const token = Token[key];
    if (typeof token === "number" && token === tokenValue) {
      return [msg, token as Token, param];
    }
  }
  return [msg, Token.unknown, 0];
}

function asciiToBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
}

export class HardwareTestCommunicationMock implements ICommunication {
  private rxMsgList: Uint8Array[] = [];
  private _isOpen = false;
  private autoReadOn = false;
  private autoTestOn = false;
  private timerEventOdd = false;

  reset(): void {
    this._isOpen = false;
    this.rxMsgList = [];
    this.autoReadOn = false;
    this.autoTestOn = false;
    this.timerEventOdd = false;
  }

  setup(): void {
    this.rxMsgList = [];
    this.autoReadOn = false;
    this.autoTestOn = false;
    this.timerEventOdd = false;
    this._isOpen = true;
    this.output(Token.testRes, "AYAB Hardware Test v1.0 API v6\n\n");
    this.handleHelpCmd(new Uint8Array([Token.helpCmd]));
  }

  isOpen(): boolean {
    return this._isOpen;
  }

  openSerial(_uri: string): boolean {
    this._isOpen = true;
    return true;
  }

  openSerialAsync(_uri: string): Promise<boolean> {
    this._isOpen = true;
    return Promise.resolve(true);
  }

  closeSerial(): void {
    this.reset();
  }

  reqInfo(): void {
    this.rxMsgList.push(
      new Uint8Array([Token.cnfInfo, 6, 1, 0, 0, 109, 111, 99, 107, 0]),
    );
  }

  reqInit(_machine: Machine): void {
    this.rxMsgList.push(new Uint8Array([Token.cnfInit, 0]));
  }

  reqStart(
    _startNeedle: number,
    _stopNeedle: number,
    _continuousReporting: boolean,
    _disableHardwareBeep: boolean,
  ): void {
    // Not used in hardware test flow.
  }

  reqTest(): void {
    this.rxMsgList.push(new Uint8Array([Token.cnfTest, 0]));
  }

  reqQuit(): void {
    this.write_API6(new Uint8Array([Token.quitCmd]));
  }

  cnfLine(
    _lineNumber: number,
    _color: number,
    _flags: number,
    _lineData: Uint8Array,
  ): void {
    // Not used.
  }

  write_API6(msg: Uint8Array): void {
    const token = msg[0]!;
    const cmdIndex = CMD_TOKENS.indexOf(token);
    if (cmdIndex < 0) {
      return;
    }
    const cmdName = Token[CMD_TOKENS[cmdIndex]!] as keyof typeof Token;
    const label = String(cmdName).replace(/Cmd$/, "");
    this.output(Token.testRes, `Called ${label}\n`);
    switch (token) {
      case Token.helpCmd:
        this.handleHelpCmd(msg);
        break;
      case Token.sendCmd:
        this.output(Token.testRes, "123\n");
        break;
      case Token.beepCmd:
        break;
      case Token.readEOLsensorsCmd:
        this.readEolSensors();
        this.output(Token.testRes, "\n");
        break;
      case Token.readEncodersCmd:
        this.readEncoders();
        this.output(Token.testRes, "\n");
        break;
      case Token.autoReadCmd:
        this.autoReadOn = true;
        break;
      case Token.autoTestCmd:
        this.autoTestOn = true;
        break;
      case Token.stopCmd:
        this.autoReadOn = false;
        this.autoTestOn = false;
        break;
      case Token.quitCmd:
        break;
      case Token.setSingleCmd:
        break;
      default:
        break;
    }
  }

  timer_event(): void {
    if (this.autoReadOn && this.timerEventOdd) {
      this.readEolSensors();
      this.readEncoders();
      this.output(Token.testRes, "\n");
    }
    if (this.autoTestOn) {
      if (this.timerEventOdd) {
        this.output(Token.testRes, "Set odd solenoids\n");
      } else {
        this.output(Token.testRes, "Set even solenoids\n");
      }
    }
    this.timerEventOdd = !this.timerEventOdd;
  }

  update_API6(): [Uint8Array | null, Token, number] {
    if (this.rxMsgList.length > 0) {
      const msg = this.rxMsgList.shift() ?? null;
      return parseToken(msg);
    }
    return [null, Token.none, 0];
  }

  update_API6_async(): Promise<[Uint8Array | null, Token, number]> {
    return Promise.resolve(this.update_API6());
  }

  private output(token: Token, text: string): void {
    const bytes = asciiToBytes(text);
    const msg = new Uint8Array(1 + bytes.length);
    msg[0] = token;
    msg.set(bytes, 1);
    this.rxMsgList.push(msg);
  }

  private handleHelpCmd(_msg: Uint8Array): void {
    const lines = [
      "The following commands are available:\n",
      "setSingle [0..15] [1/0]\n",
      "setAll [0..FFFF]\n",
      "readEOLsensors\n",
      "readEncoders\n",
      "beep\n",
      "autoRead\n",
      "autoTest\n",
      "send\n",
      "stop\n",
      "quit\n",
      "help\n",
    ];
    for (const line of lines) {
      this.output(Token.testRes, line);
    }
  }

  private readEolSensors(): void {
    this.output(Token.testRes, "  EOL_L: 0");
    this.output(Token.testRes, "  EOL_R: 0");
  }

  private readEncoders(): void {
    this.output(Token.testRes, "  ENC_A: LOW");
    this.output(Token.testRes, "  ENC_B: LOW");
    this.output(Token.testRes, "  ENC_C: LOW");
  }
}
