import { assert } from "../helpers/runner.mjs";
import { clickByA11yId, waitForA11yId } from "../helpers/selectors.mjs";

const sel = (id) => `[id="${id}"]`;

/**
 * The onboarding tour should show once for a fresh install, then stay
 * dismissed across reloads (regression: PersistentStore's web backing was
 * in-memory only, so firstRunTourCompleted never survived a page reload).
 */
export async function firstRunTourSpec(ctx) {
  const { page } = ctx;

  // Start from a clean slate — earlier specs in this run may have already
  // dismissed the tour, leaving its "completed" flag in this browser profile.
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });
  await waitForA11yId(page, "app-root", 60000);

  await waitForA11yId(page, "onboarding-skip", 15000);
  const bubbleOnFirstLoad = await page.$(sel("onboarding-bubble"));
  assert(bubbleOnFirstLoad != null, "Onboarding tour should show on a fresh install");

  await clickByA11yId(page, "onboarding-skip");
  await page.waitForFunction(
    () => document.querySelector('[id="onboarding-skip"]') == null,
    { timeout: 5000 },
  );

  await page.reload({ waitUntil: "networkidle0" });
  await waitForA11yId(page, "app-root", 60000);

  // Give the async tour a moment to (incorrectly) reappear before asserting.
  await new Promise((r) => setTimeout(r, 1000));
  const bubbleAfterReload = await page.$(sel("onboarding-bubble"));
  assert(
    bubbleAfterReload == null,
    "Onboarding tour should not reappear after a page reload once dismissed",
  );
}
