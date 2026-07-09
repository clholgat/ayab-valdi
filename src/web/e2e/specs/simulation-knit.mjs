import { assert } from "../helpers/runner.mjs";
import {
  clickByA11yId,
  waitForA11yId,
  waitForAppReady,
  waitForText,
  loadDemoPattern,
} from "../helpers/selectors.mjs";

export async function simulationKnitSpec(ctx) {
  const { page } = ctx;
  await waitForAppReady(page);
  await loadDemoPattern(page);
  await clickByA11yId(page, "knit-button");
  await waitForA11yId(page, "cancel-button");
  await waitForText(page, "Progress:");
  await clickByA11yId(page, "cancel-button");
  await waitForAppReady(page);
  const knitLabel = await page.$eval(
    '[id="knit-button"]',
    (el) => el.textContent ?? "",
  );
  assert(knitLabel.includes("Knit"), "Knit button should return to idle label");
}
