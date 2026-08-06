import path from "node:path";
import { fileURLToPath } from "node:url";
import { assert } from "../helpers/runner.mjs";
import {
  clickByA11yId,
  textByA11yId,
  waitForA11yId,
  waitForA11yText,
  waitForAppReady,
  waitForText,
} from "../helpers/selectors.mjs";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../modules/knitout/test/fixtures/basic-stockinette.k",
);

async function acknowledgePrompt(page, text) {
  await waitForText(page, text, 30000);
  await clickByA11yId(page, "machine-job-prompt-acknowledge");
}

export async function knitoutImportSpec(ctx) {
  const { page } = ctx;
  await waitForAppReady(page);

  const inputs = await page.$$('input[type="file"]');
  assert(inputs.length >= 2, "Expected separate pattern and executable-job pickers");
  await inputs[1].uploadFile(fixturePath);

  await waitForA11yId(page, "knitout-inspection", 15000);
  await waitForA11yText(
    page,
    "knitout-compatibility",
    "Compatible with AYAB's conservative Knitout profile",
    15000,
  );
  const summary = await textByA11yId(page, "knitout-summary");
  assert(summary.includes("10 operations"), `Expected operation total, got: ${summary}`);
  assert(summary.includes("2 passes"), `Expected pass total, got: ${summary}`);
  await waitForA11yText(page, "knitout-placement", "Placement: center", 15000);
  await waitForA11yText(page, "knitout-pass-0", "Pass 1 ←", 15000);

  await clickByA11yId(page, "knitout-cycle-placement");
  await waitForA11yText(page, "knitout-placement", "Placement: right", 15000);

  await clickByA11yId(page, "machine-job-simulate");
  await acknowledgePrompt(page, "Place yarn carrier A");
  await acknowledgePrompt(page, "Release the inserted yarn");
  await acknowledgePrompt(page, "Turn the row counter to zero");
  await acknowledgePrompt(page, "Remove yarn carrier A");
  await waitForText(page, "Machine job simulation completed", 30000);
  await waitForA11yText(
    page,
    "knitout-compatibility",
    "Compatible with AYAB's conservative Knitout profile",
    15000,
  );
}
