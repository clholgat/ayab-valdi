/** URI helpers shared between native callers and the web serial polyglot layer. */

export function isWebSocketUri(uri: string): boolean {
  return uri.startsWith("ws://") || uri.startsWith("wss://");
}
