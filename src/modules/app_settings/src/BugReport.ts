import { Device } from "valdi_core/src/Device";
import { buildBugReportUrl, openExternalUrl } from "constants/src/ExternalLink";
import { APP_NAME, APP_VERSION, APP_REPO_URL } from "constants/src/AppInfo";

function platformLabel(): string {
  if (Device.isWeb()) {
    return "Web (browser)";
  }
  if (Device.isAndroid()) {
    return "Android";
  }
  if (Device.isDesktop()) {
    return "macOS (native)";
  }
  return "Other";
}

/** Device.getSystemVersion() has no safe fallback for environments where the
 * native bridge isn't wired up (e.g. component tests) - this is just a nice
 * to have for the bug report body, so don't let it crash the tap handler. */
function systemVersion(): string {
  try {
    return Device.getSystemVersion();
  } catch {
    return "unknown";
  }
}

/**
 * Opens a pre-filled GitHub bug report on web, or copies the link to the
 * clipboard on native platforms (there's no cross-platform "open browser"
 * API). Returns whether it opened directly so the caller can tell the user
 * to check their clipboard when it didn't.
 */
export function reportBug(): { opened: boolean } {
  const url = buildBugReportUrl({
    repoUrl: APP_REPO_URL,
    platform: platformLabel(),
    environment: `${APP_NAME} ${APP_VERSION}, ${systemVersion()}`,
  });
  return openExternalUrl(url, Device.isWeb(), (text) =>
    Device.copyToClipBoard(text),
  );
}
