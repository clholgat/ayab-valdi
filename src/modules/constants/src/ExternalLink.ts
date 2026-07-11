/**
 * Builds a GitHub "new issue" URL for the bug_report.yml issue form,
 * pre-filling the platform/environment fields where possible.
 * Field ids must match .github/ISSUE_TEMPLATE/bug_report.yml.
 * Uses encodeURIComponent (a plain ECMAScript global) rather than
 * URLSearchParams, which isn't guaranteed to exist in the native Hermes
 * runtime this app also targets (macOS/Android), only in browsers.
 */
export function buildBugReportUrl(params: {
  repoUrl: string;
  platform: string;
  environment?: string;
}): string {
  const fields: Array<[string, string]> = [
    ["template", "bug_report.yml"],
    ["platform", params.platform],
  ];
  if (params.environment) {
    fields.push(["environment", params.environment]);
  }
  const query = fields
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return `${params.repoUrl}/issues/new?${query}`;
}

/**
 * Opens a URL in the system browser where possible (web). There's no
 * cross-platform "open in browser" API in Valdi's core module, so on
 * native (macOS/Android) this falls back to copying the URL to the
 * clipboard - the caller should tell the user that happened.
 */
export function openExternalUrl(
  url: string,
  isWeb: boolean,
  copyToClipboard: (text: string) => void,
): { opened: boolean } {
  if (isWeb && typeof globalThis.open === "function") {
    globalThis.open(url, "_blank", "noopener,noreferrer");
    return { opened: true };
  }
  copyToClipboard(url);
  return { opened: false };
}
