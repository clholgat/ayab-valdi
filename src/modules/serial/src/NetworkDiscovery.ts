/**
 * Network AYAB device discovery (_ayab._tcp.local.) and manual WebSocket entries.
 */

import { browse_ayab_mdns } from "serial/src/Serial";

export interface AyabMdnsRecord {
  server: string;
  port: number;
  path?: string;
  boardId?: string;
  address?: string;
}

export interface AyabNetworkService {
  /** Display label in the port picker */
  label: string;
  /** ws://host:port/path connection URI */
  uri: string;
  boardId?: string;
}

const manualServices: AyabNetworkService[] = [];
let discoveredServices: AyabNetworkService[] = [];

export function registerManualWebSocketService(
  service: AyabNetworkService,
): void {
  manualServices.push(service);
}

export function setDiscoveredNetworkServices(
  services: AyabNetworkService[],
): void {
  discoveredServices = services.slice();
}

export function clearNetworkServices(): void {
  manualServices.length = 0;
  discoveredServices = [];
}

function mapMdnsRecord(record: AyabMdnsRecord): AyabNetworkService {
  return serviceFromMdnsRecord({
    server: record.server,
    port: record.port,
    path: record.path,
    boardId: record.boardId,
    address: record.address,
  });
}

/** Refresh mDNS services via platform browse (Bonjour on macOS). */
export async function refreshNetworkServices(): Promise<AyabNetworkService[]> {
  try {
    const records = (
      typeof browse_ayab_mdns === "function" ? browse_ayab_mdns() : []
    ) as AyabMdnsRecord[];
    setDiscoveredNetworkServices(records.map(mapMdnsRecord));
  } catch (error) {
    console.error("mDNS browse failed:", error);
  }
  return discoveredServices.slice();
}

export function getNetworkServices(): AyabNetworkService[] {
  const seen = new Set<string>();
  const merged: AyabNetworkService[] = [];
  for (const service of [...manualServices, ...discoveredServices]) {
    if (seen.has(service.uri)) {
      continue;
    }
    seen.add(service.uri);
    merged.push(service);
  }
  return merged;
}

export function formatWebSocketUri(
  host: string,
  port: number,
  path: string = "/ws",
): string {
  const normalizedHost = host.replace(/\.local\.?$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `ws://${normalizedHost}:${port}${normalizedPath}`;
}

export function serviceFromMdnsRecord(options: {
  server: string;
  port: number;
  path?: string;
  boardId?: string;
  address?: string;
}): AyabNetworkService {
  const host = options.server.replace(/\.local\.?$/, "");
  const ip = options.address ?? host;
  const uri = formatWebSocketUri(host, options.port, options.path ?? "/ws");
  return {
    label: `${host} (${ip})`,
    uri,
    boardId: options.boardId,
  };
}
