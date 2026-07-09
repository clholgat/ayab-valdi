import "jasmine/src/jasmine";
import {
  SIMULATION_PORT,
  ADD_WEBSOCKET_LABEL,
  buildPortList,
  connectionStatusForUri,
  defaultKnitPort,
  entryLabels,
  SELECT_USB_LABEL,
  uriForEntryIndex,
} from "ayab_valdi/src/SerialPortList";

describe("SerialPortList", () => {
  it("buildPortList always includes Simulation first", () => {
    expect(buildPortList([], false)).toEqual([
      { label: SIMULATION_PORT, uri: SIMULATION_PORT },
    ]);
    expect(buildPortList(["/dev/ttyUSB0"], false)).toEqual([
      { label: SIMULATION_PORT, uri: SIMULATION_PORT },
      { label: "/dev/ttyUSB0", uri: "/dev/ttyUSB0" },
    ]);
  });

  it("buildPortList merges network services and USB prompt", () => {
    const entries = buildPortList(
      [],
      true,
      [{ label: "pi (192.168.1.2)", uri: "ws://192.168.1.2:8080/ws" }],
      true,
    );
    expect(entryLabels(entries)).toEqual([
      SIMULATION_PORT,
      "pi (192.168.1.2)",
      "Select USB device...",
      ADD_WEBSOCKET_LABEL,
    ]);
    expect(uriForEntryIndex(entries, 1)).toBe("ws://192.168.1.2:8080/ws");
  });

  it("defaultKnitPort uses Simulation when undefined", () => {
    expect(defaultKnitPort()).toBe(SIMULATION_PORT);
    expect(defaultKnitPort(undefined)).toBe(SIMULATION_PORT);
  });

  it("defaultKnitPort preserves explicit selection", () => {
    expect(defaultKnitPort("ws://host/ws")).toBe("ws://host/ws");
  });

  it("connectionStatusForUri maps known connection kinds", () => {
    expect(connectionStatusForUri(SIMULATION_PORT)).toEqual({
      kind: "simulation",
      label: "Simulation",
    });
    expect(connectionStatusForUri("/dev/ttyUSB0")).toEqual({
      kind: "ready",
      label: "Ready",
    });
    expect(connectionStatusForUri("ws://host/ws")).toEqual({
      kind: "network",
      label: "Network",
    });
    expect(connectionStatusForUri(SELECT_USB_LABEL)).toEqual({
      kind: "prompt",
      label: "Not connected",
    });
  });
});
