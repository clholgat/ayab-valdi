/** Serial port list helpers — testable extraction from SerialPortPicker. */

import { AyabNetworkService } from "serial/src/NetworkDiscovery";

export const SIMULATION_PORT = "Simulation";
export const SELECT_USB_LABEL = "Select USB device...";
export const ADD_WEBSOCKET_LABEL = "Add WebSocket URL...";

export interface SerialPortEntry {
  label: string;
  uri: string;
}

export function buildPortList(
  physicalPorts: string[],
  includeUsbPrompt: boolean,
  networkServices: AyabNetworkService[] = [],
  includeWebSocketPrompt: boolean = false,
): SerialPortEntry[] {
  const entries: SerialPortEntry[] = [
    { label: SIMULATION_PORT, uri: SIMULATION_PORT },
  ];

  for (const service of networkServices) {
    entries.push({ label: service.label, uri: service.uri });
  }

  for (const port of physicalPorts) {
    entries.push({ label: port, uri: port });
  }

  if (includeUsbPrompt) {
    entries.push({ label: SELECT_USB_LABEL, uri: SELECT_USB_LABEL });
  }
  if (includeWebSocketPrompt) {
    entries.push({ label: ADD_WEBSOCKET_LABEL, uri: ADD_WEBSOCKET_LABEL });
  }

  return entries;
}

export function defaultKnitPort(selectedPort?: string): string {
  return selectedPort ?? SIMULATION_PORT;
}

export function entryLabels(entries: SerialPortEntry[]): string[] {
  return entries.map((entry) => entry.label);
}

export function uriForEntryIndex(
  entries: SerialPortEntry[],
  index: number,
): string | undefined {
  return entries[index]?.uri;
}

export type ConnectionStatusKind =
  | "simulation"
  | "ready"
  | "network"
  | "prompt"
  | "idle";

export interface ConnectionStatus {
  kind: ConnectionStatusKind;
  label: string;
}

export function connectionStatusForUri(uri: string | undefined): ConnectionStatus {
  if (!uri || uri === SELECT_USB_LABEL || uri === ADD_WEBSOCKET_LABEL) {
    return { kind: "prompt", label: "Not connected" };
  }
  if (uri === SIMULATION_PORT) {
    return { kind: "simulation", label: "Simulation" };
  }
  if (uri.startsWith("ws://") || uri.startsWith("wss://")) {
    return { kind: "network", label: "Network" };
  }
  return { kind: "ready", label: "Ready" };
}
