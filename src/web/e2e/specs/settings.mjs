import { assert } from "../helpers/runner.mjs";
import {
  clickByA11yId,
  textByA11yId,
  waitForAppReady,
  waitForA11yId,
  waitForA11yText,
} from "../helpers/selectors.mjs";

/** Preferences survive panel close/reopen and full page reload (localStorage on web). */
export async function settingsSpec(ctx) {
  const { page } = ctx;
  await waitForAppReady(page);
  await clickByA11yId(page, "settings-button");
  await waitForA11yId(page, "preferences-panel", 15000);

  const initialApp = await textByA11yId(page, "app-beeps-status");
  assert(initialApp.includes("on"), `App beeps should start on, got: ${initialApp}`);
  const initialHardware = await textByA11yId(page, "hardware-beeps-status");
  assert(
    initialHardware.includes("on"),
    `Hardware beeps should start on, got: ${initialHardware}`,
  );

  await clickByA11yId(page, "app-beeps-toggle");
  await waitForA11yText(page, "app-beeps-status", "off", 5000);
  await clickByA11yId(page, "hardware-beeps-toggle");
  await waitForA11yText(page, "hardware-beeps-status", "off", 5000);
  await clickByA11yId(page, "preferences-done");
  await waitForA11yId(page, "settings-button", 15000);

  await clickByA11yId(page, "settings-button");
  await waitForA11yId(page, "preferences-panel", 15000);
  const afterReopen = await textByA11yId(page, "app-beeps-status");
  assert(
    afterReopen.includes("off"),
    `App beeps should persist after reopen, got: ${afterReopen}`,
  );
  const hardwareAfterReopen = await textByA11yId(page, "hardware-beeps-status");
  assert(
    hardwareAfterReopen.includes("off"),
    `Hardware beeps should persist after reopen, got: ${hardwareAfterReopen}`,
  );
  await clickByA11yId(page, "preferences-done");

  await page.reload({ waitUntil: "networkidle0" });
  await waitForAppReady(page);
  await clickByA11yId(page, "settings-button");
  await waitForA11yId(page, "preferences-panel", 15000);
  const afterReload = await textByA11yId(page, "app-beeps-status");
  assert(
    afterReload.includes("off"),
    `App beeps should persist after reload, got: ${afterReload}`,
  );
  const hardwareAfterReload = await textByA11yId(page, "hardware-beeps-status");
  assert(
    hardwareAfterReload.includes("off"),
    `Hardware beeps should persist after reload, got: ${hardwareAfterReload}`,
  );
  await clickByA11yId(page, "preferences-done");
}
