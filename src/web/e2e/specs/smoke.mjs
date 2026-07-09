import { assert } from "../helpers/runner.mjs";
import {
  clickByA11yId,
  waitForAppReady,
  waitForA11yId,
} from "../helpers/selectors.mjs";

export async function smokeSpec(ctx) {
  const { page } = ctx;
  await waitForAppReady(page);
  await waitForA11yId(page, "settings-button");
  await waitForA11yId(page, "knit-button");
  await waitForA11yId(page, "preview-empty-state");
  await waitForA11yId(page, "preview-browse-samples");

  const settingsText = await page.$eval(
    '[id="settings-button"]',
    (el) => el.textContent ?? "",
  );
  assert(settingsText.includes("Settings"), "Settings button should render");

  await clickByA11yId(page, "settings-button");
  await waitForA11yId(page, "preferences-panel", 15000);
  await waitForA11yId(page, "hardware-test-button");
  await waitForA11yId(page, "about-button");
  await waitForA11yId(page, "settings-modal-close");
  await clickByA11yId(page, "settings-modal-close");
  await waitForA11yId(page, "knit-button");

  const title = await page.title();
  assert(title.length > 0, "Page title should be set");

  const benign = ctx.consoleErrors.filter(
    (line) =>
      !/ResizeObserver loop/i.test(line) &&
      !/Failed to load resource.*404/i.test(line),
  );
  assert(benign.length === 0, `Unexpected console errors: ${benign.join("; ")}`);
}
