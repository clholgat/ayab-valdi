/** Web serial polyglot URI helpers. */

export function isWebSocketUri(uri: string): boolean {
  return uri.startsWith("ws://") || uri.startsWith("wss://");
}
