/**
 * Serial communication protocol constants.
 * Shared between state_machine and serial modules to avoid circular dependencies.
 */

/**
 * Serial communication protocol tokens.
 */
export enum Token {
  unknown = -2,
  none = -1,
  reqInfo = 0x03,
  cnfInfo = 0xc3,
  reqTest = 0x04,
  cnfTest = 0xc4,
  reqStart = 0x01,
  cnfStart = 0xc1,
  reqLine = 0x82,
  cnfLine = 0x42,
  indState = 0x84,
  helpCmd = 0x25,
  sendCmd = 0x26,
  beepCmd = 0x27,
  setSingleCmd = 0x28,
  setAllCmd = 0x29,
  readEOLsensorsCmd = 0x2a,
  readEncodersCmd = 0x2b,
  autoReadCmd = 0x2c,
  autoTestCmd = 0x2d,
  stopCmd = 0x2e,
  quitCmd = 0x2f,
  reqInit = 0x05,
  cnfInit = 0xc5,
  testRes = 0xee,
  debug = 0x9f,
  slipFrameEnd = 0xc0,
}

/**
 * Maximum line number in a block before wrapping to the next block.
 * Used for serial protocol line number management.
 */
export const BLOCK_LENGTH = 256;

/**
 * The first supported API version for the serial communication protocol.
 * Currently only API version 6 is supported.
 */
export const FIRST_SUPPORTED_API_VERSION = 6;
