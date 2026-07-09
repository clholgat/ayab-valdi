import { assert } from "../helpers/runner.mjs";
import {
  clickByA11yId,
  textByA11yId,
  waitForA11yId,
  waitForA11yText,
  waitForAppReady,
} from "../helpers/selectors.mjs";

async function waitForCommandEnabled(page, id, timeoutMs = 60000) {
  await page.waitForFunction(
    (a11yId) => {
      const el = document.querySelector(`[id="${a11yId}"]`);
      if (!el) {
        return false;
      }
      return el.getAttribute("aria-disabled") !== "true";
    },
    { timeout: timeoutMs },
    id,
  );
}

export async function hardwareTestSpec(ctx) {
  const { page } = ctx;
  await waitForAppReady(page);
  await clickByA11yId(page, "settings-button");
  await waitForA11yId(page, "preferences-panel", 15000);
  await clickByA11yId(page, "hardware-test-button");
  await waitForA11yId(page, "hardware-test-panel", 20000);
  await waitForA11yText(page, "hardware-test-status", "Connected", 60000);
  await waitForCommandEnabled(page, "hw-cmd-help");
  await clickByA11yId(page, "hw-cmd-help");
  await waitForA11yText(page, "hardware-test-log", "Called help", 20000);
  const log = await textByA11yId(page, "hardware-test-log");
  assert(log.includes("setSingle"), "Help output should list commands");
  await clickByA11yId(page, "hw-cmd-send");
  await waitForA11yText(page, "hardware-test-log", "123", 20000);
}
