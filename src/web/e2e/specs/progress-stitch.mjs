import { assert } from "../helpers/runner.mjs";
import {
  clickByA11yId,
  waitForA11yId,
  waitForAppReady,
  waitForKnitEnabled,
  waitForA11yText,
  waitForText,
  loadDemoPattern,
} from "../helpers/selectors.mjs";

export async function progressStitchSpec(ctx) {
  const { page } = ctx;
  await waitForAppReady(page);
  await loadDemoPattern(page);
  await clickByA11yId(page, "knit-button");
  await waitForA11yId(page, "cancel-button");
  await waitForText(page, "To Be Selected", 90000);
  await waitForA11yId(page, "stitch-cell-0", 30000);
  await clickByA11yId(page, "stitch-cell-0");
  await waitForA11yText(page, "progress-stitch-selection", "Selection:", 10000);
  const selection = await page.$eval(
    '[id="progress-stitch-selection"]',
    (el) => el.textContent ?? "",
  );
  assert(selection.includes("stitch"), `Expected stitch selection label, got: ${selection}`);
  await clickByA11yId(page, "cancel-button");
  await waitForKnitEnabled(page);
}
