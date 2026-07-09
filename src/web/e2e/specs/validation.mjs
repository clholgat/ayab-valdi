import { assert } from "../helpers/runner.mjs";
import {
  clickByA11yId,
  setInputByA11yId,
  waitForA11yText,
  waitForAppReady,
  loadDemoPattern,
} from "../helpers/selectors.mjs";

export async function validationSpec(ctx) {
  const { page } = ctx;
  await waitForAppReady(page);
  await loadDemoPattern(page);
  await setInputByA11yId(page, "start-row-input", "9999");
  await clickByA11yId(page, "knit-button");
  await waitForA11yText(
    page,
    "user-message",
    "Start row is larger than the image.",
    15000,
  );
  const message = await page.$eval(
    '[id="user-message"]',
    (el) => el.textContent ?? "",
  );
  assert(
    message.includes("larger than the image"),
    `Expected validation message, got: ${message}`,
  );
}
