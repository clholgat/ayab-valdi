import { assert } from "../helpers/runner.mjs";
import {
  a11ySelector,
  clickByA11yId,
  waitForA11yId,
  waitForAppReady,
  waitForText,
  loadDemoPattern,
} from "../helpers/selectors.mjs";

/**
 * Lets a simulated knit run all the way to natural completion (no cancel)
 * and checks the UI resets to the idle state - cancel-button goes away,
 * knit-button comes back - the same way it does after an explicit cancel.
 */
export async function knitNaturalCompletionSpec(ctx) {
  const { page } = ctx;
  await waitForAppReady(page);
  await loadDemoPattern(page);
  const infiniteRepeatOn = await page.evaluate(
    () =>
      document
        .getElementById("root")
        ?.shadowRoot?.querySelector('[id="infinite-repeat-toggle"]')
        ?.getAttribute("aria-selected") === "true",
  );
  if (infiniteRepeatOn) {
    await clickByA11yId(page, "infinite-repeat-toggle");
  }
  await clickByA11yId(page, "knit-button");
  await waitForA11yId(page, "cancel-button");
  await waitForText(page, "Progress:");

  // Let the simulation run to completion instead of cancelling.
  await waitForText(page, "Pattern completed", 120000);
  await waitForA11yId(page, "knit-button", 15000);

  const knitLabel = await page.$eval(
    a11ySelector("knit-button"),
    (el) => el.textContent ?? "",
  );
  assert(
    knitLabel.includes("Knit"),
    "Knit button should return to idle label after natural completion",
  );

  const cancelButton = await page.$(a11ySelector("cancel-button"));
  assert(
    cancelButton === null,
    "Cancel button should be gone after natural completion",
  );
}
