import "jasmine/src/jasmine";
import {
  clearNetworkServices,
  formatWebSocketUri,
  getNetworkServices,
  registerManualWebSocketService,
  serviceFromMdnsRecord,
  setDiscoveredNetworkServices,
  refreshNetworkServices,
} from "serial/src/NetworkDiscovery";

describe("NetworkDiscovery", () => {
  afterEach(() => {
    clearNetworkServices();
  });

  it("formatWebSocketUri builds ayab-style URIs", () => {
    expect(formatWebSocketUri("ayab.local.", 8080, "/ws")).toBe(
      "ws://ayab:8080/ws",
    );
  });

  it("merges manual and discovered services without duplicate URIs", () => {
    registerManualWebSocketService({
      label: "manual",
      uri: "ws://192.168.0.10/ws",
    });
    setDiscoveredNetworkServices([
      serviceFromMdnsRecord({
        server: "pi.local.",
        port: 8080,
        address: "192.168.0.11",
      }),
      { label: "dup", uri: "ws://192.168.0.10/ws" },
    ]);
    const services = getNetworkServices();
    expect(services.length).toBe(2);
    expect(services.some((s) => s.uri === "ws://pi:8080/ws")).toBe(true);
  });

  it("refreshNetworkServices updates discovered list from browse", async () => {
    const discovered = await refreshNetworkServices();
    expect(Array.isArray(discovered)).toBe(true);
    expect(getNetworkServices().length).toBe(discovered.length);
  });
});
