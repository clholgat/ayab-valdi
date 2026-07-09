import "jasmine/src/jasmine";
import { isSerialPortAlreadyOpenError } from "serial/src/SerialPortErrors";

describe("isSerialPortAlreadyOpenError", () => {
  it("matches InvalidStateError by name", () => {
    expect(
      isSerialPortAlreadyOpenError({ name: "InvalidStateError", message: "x" }),
    ).toBe(true);
  });

  it("matches already-open message", () => {
    expect(
      isSerialPortAlreadyOpenError({
        message:
          "Failed to execute 'open' on 'SerialPort': The port is already open.",
      }),
    ).toBe(true);
  });

  it("rejects unrelated errors", () => {
    expect(isSerialPortAlreadyOpenError(null)).toBe(false);
    expect(isSerialPortAlreadyOpenError({ name: "NetworkError" })).toBe(false);
  });
});
