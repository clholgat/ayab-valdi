import path from "node:path";
import { fileURLToPath } from "node:url";
import { assert } from "../helpers/runner.mjs";
import {
  clickByA11yId,
  waitForA11yId,
  waitForA11yText,
  waitForAppReady,
  waitForKnitEnabled,
  waitForText,
} from "../helpers/selectors.mjs";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../modules/process_image/test/fixtures/stitchworld_374.png",
);

/** Proves PNG Comment metadata survives file selection through knit status UI. */
export async function annotatedImageSpec(ctx) {
  const { page } = ctx;
  await waitForAppReady(page);

  const fileInput = await page.waitForSelector('input[type="file"]', {
    timeout: 15000,
  });
  await fileInput.uploadFile(fixturePath);

  await waitForA11yText(page, "preview-image-name", "stitchworld_374", 60000);
  await waitForKnitEnabled(page);
  await clickByA11yId(page, "knit-button");
  await waitForA11yId(page, "cancel-button");
  await waitForText(page, "Memo: 1", 30000);

  // Valdi web nodes may render their labels through nested/shadow elements,
  // so the host's textContent can be empty even though its visible innerText
  // is correct. Read the rendered page text after targeting the memo above.
  const progressText = await page.evaluate(() => document.body.innerText);
  assert(
    progressText.includes("Memo: 1"),
    `Expected the annotated row memo in progress UI, got: ${progressText}`,
  );

  await clickByA11yId(page, "cancel-button");
  await waitForKnitEnabled(page);
}
