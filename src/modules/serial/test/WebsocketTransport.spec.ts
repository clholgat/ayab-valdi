import "jasmine/src/jasmine";
import { isWebSocketUri } from "serial/src/SerialUri";

describe("SerialUri", () => {
  it("isWebSocketUri detects ws and wss schemes", () => {
    expect(isWebSocketUri("ws://host/ws")).toBe(true);
    expect(isWebSocketUri("wss://host/ws")).toBe(true);
    expect(isWebSocketUri("/dev/ttyUSB0")).toBe(false);
    expect(isWebSocketUri("Simulation")).toBe(false);
  });
});
