import { assert } from "../helpers/runner.mjs";
import {
  clickByA11yId,
  textByA11yId,
  waitForA11yId,
  waitForA11yText,
  waitForAppReady,
} from "../helpers/selectors.mjs";

export async function flashFirmwareSpec(ctx) {
  const { page } = ctx;
  await waitForAppReady(page);
  await clickByA11yId(page, "settings-button");
  await waitForA11yId(page, "preferences-panel", 15000);
  await clickByA11yId(page, "flash-firmware-button");
  await waitForA11yId(page, "flash-firmware-panel", 20000);
  await waitForA11yText(page, "flash-firmware-status", "Complete", 60000);
  const log = await textByA11yId(page, "flash-firmware-log");
  assert(log.includes("Flash complete."), "Flash log should report completion");
  await clickByA11yId(page, "flash-firmware-close");
}
