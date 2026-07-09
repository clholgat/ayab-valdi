/**
 * Mock implementation of ICommunication for Simulation mode.
 * Simulates firmware responses so the state machine runs without hardware.
 * Ported from ayab-desktop's engine/communication_mock.py.
 */

import { Token } from "constants/src/SerialConstants";
import { Machine } from "state_machine/src/Machine";
import { ICommunication } from "constants/src/Interfaces";

function parseToken(
  msg: Uint8Array | null,
): [Uint8Array | null, Token, number] {
  if (msg === null || msg.length === 0) {
    return [null, Token.none, 0];
  }
  const tokenValue = msg[0];
  const param = msg.length > 1 ? msg[1] : 0;
  const tokenKeys = Object.keys(Token) as Array<keyof typeof Token>;
  for (const key of tokenKeys) {
    const token = Token[key];
    if (typeof token === "number" && token === tokenValue) {
      return [msg, token as Token, param];
    }
  }
  return [msg, Token.unknown, 0];
}

export class CommunicationMock implements ICommunication {
  private rxMsgList: Uint8Array[] = [];
  private _isOpen = false;
  private _isStarted = false;
  private _lineCount = 0;
  /** Alternate no-message / reqLine so we step one row per two polls (UI can update). */
  private _startedRow = false;
  private readonly _delay: boolean;

  constructor(delay: boolean = true) {
    this._delay = delay;
    this.reset();
  }

  reset(): void {
    this._isOpen = false;
    this._isStarted = false;
    this._startedRow = false;
    this.rxMsgList = [];
    this._lineCount = 0;
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
    const PromiseConstructor = (function () {
      try {
        return eval("Promise");
      } catch (e) {
        throw new Error("Promise not available");
      }
    })();
    return PromiseConstructor.resolve(true);
  }

  closeSerial(): void {
    this.reset();
  }

  reqInfo(): void {
    // cnfInfo: API version 6, firmware version "mock" (109, 111, 99, 107 = m, o, c, k)
    const cnfInfo = new Uint8Array([
      Token.cnfInfo,
      6,
      1,
      0,
      0,
      109,
      111,
      99,
      107,
      0,
    ]);
    this.rxMsgList.push(cnfInfo);
  }

  reqInit(_machine: Machine): void {
    const cnfInit = new Uint8Array([Token.cnfInit, 0]);
    this.rxMsgList.push(cnfInit);
    const indState = new Uint8Array([
      Token.indState,
      0, // success
      1, // fsm state
      0xff,
      0xff, // left sensor
      0xff,
      0xff, // right sensor
      0xff, // carriage type (unknown)
      0, // position
      1, // direction
    ]);
    this.rxMsgList.push(indState);
  }

  reqStart(
    _startNeedle: number,
    _stopNeedle: number,
    _continuousReporting: boolean,
    _disableHardwareBeep: boolean,
  ): void {
    this._isStarted = true;
    const cnfStart = new Uint8Array([Token.cnfStart, 0]);
    this.rxMsgList.push(cnfStart);
  }

  reqTest(): void {
    const cnfTest = new Uint8Array([Token.cnfTest, 0]);
    this.rxMsgList.push(cnfTest);
  }

  reqQuit(): void {
    // Match firmware: leave knit mode so a fresh session can re-init.
    this._isStarted = false;
    this._startedRow = false;
  }

  cnfLine(
    _lineNumber: number,
    _color: number,
    _flags: number,
    _lineData: Uint8Array,
  ): void {
    // No-op: in simulation we don't send data to hardware
  }

  update_API6(): [Uint8Array | null, Token, number] {
    // Match ayab-desktop communication_mock.py: alternate reqLine / no message while knitting
    if (this._isOpen && this._isStarted) {
      if (this._startedRow) {
        this._startedRow = false;
        const reqLine = new Uint8Array([Token.reqLine, this._lineCount]);
        this._lineCount = (this._lineCount + 1) % 256;
        this.rxMsgList.push(reqLine);
        // Desktop uses sleep(1) when delay=True; App.runKnittingLoop uses a longer tick instead
        if (this._delay) {
          // intentionally no-op here
        }
      } else {
        this._startedRow = true;
      }
    }
    if (this.rxMsgList.length > 0) {
      const msg = this.rxMsgList.shift() || null;
      return parseToken(msg);
    }
    return [null, Token.none, 0];
  }

  update_API6_async(): Promise<[Uint8Array | null, Token, number]> {
    const result = this.update_API6();
    const PromiseConstructor = (function () {
      try {
        return eval("Promise");
      } catch (e) {
        throw new Error("Promise not available");
      }
    })();
    return PromiseConstructor.resolve(result);
  }
}
