import { assert } from "../helpers/runner.mjs";
import {
  clickByA11yId,
  waitForA11yId,
  waitForAppReady,
  waitForKnitEnabled,
  waitForA11yText,
  loadDemoPattern,
} from "../helpers/selectors.mjs";

/** Knitting has left carriage detection and is selecting needles / advancing rows. */
export async function waitForKnittingActive(page, timeoutMs = 120000) {
  await waitForA11yText(page, "knit-action-banner", "Please knit", timeoutMs);
  await waitForA11yId(page, "stitch-cell-0", timeoutMs);
}

export async function knitUntilActive(page) {
  await clickByA11yId(page, "knit-button");
  await waitForA11yId(page, "cancel-button");
  await waitForKnittingActive(page);
}

/**
 * Cancel mid-knit, change settings, knit again — must reach active knitting both times.
 */
export async function knitCancelRestartBody(page) {
  await knitUntilActive(page);
  await clickByA11yId(page, "cancel-button");
  await waitForKnitEnabled(page);
  await clickByA11yId(page, "start-row-increment");
  await clickByA11yId(page, "start-row-increment");
  await knitUntilActive(page);
  await clickByA11yId(page, "cancel-button");
  await waitForKnitEnabled(page);
}

export async function knitCancelRestartSimulationSpec(ctx) {
  const { page } = ctx;
  await waitForAppReady(page);
  await loadDemoPattern(page);
  await knitCancelRestartBody(page);
}

export async function knitCancelRestartWebSerialSpec(ctx) {
  const { page, wsUrl } = ctx;
  assert(wsUrl, "wsUrl required for web-serial spec");
  await waitForAppReady(page);
  await loadDemoPattern(page);

  const connectionStatus = await page.$eval(
    '[id="connection-status"]',
    (el) => el.textContent ?? "",
  );
  assert(
    connectionStatus.includes("Network"),
    `Expected network connection, got: ${connectionStatus}`,
  );

  await knitCancelRestartBody(page);
}
