import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assert } from "../helpers/runner.mjs";
import {
  textByA11yId,
  waitForAppReady,
  waitForA11yText,
} from "../helpers/selectors.mjs";
import { buildMinimalPat } from "../fixtures/buildMinimalPat.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadPatSpec(ctx) {
  const { page } = ctx;
  await waitForAppReady(page);

  const patBytes = buildMinimalPat({ width: 2, height: 2 });
  const tmpPath = path.join(os.tmpdir(), `ayab-e2e-minimal-${Date.now()}.pat`);
  fs.writeFileSync(tmpPath, patBytes);

  try {
    const fileInput = await page.waitForSelector('input[type="file"]', {
      timeout: 15000,
    });
    await fileInput.uploadFile(tmpPath);

    await waitForA11yText(page, "preview-image-name", "minimal", 15000);
    const name = await textByA11yId(page, "preview-image-name");
    assert(
      name.toLowerCase().includes(".pat"),
      `Expected .pat file name in preview, got: ${name}`,
    );

    const dimensions = await textByA11yId(page, "preview-dimensions");
    assert(
      dimensions.trim() === "2x2",
      `Expected 2x2 dimensions for minimal .pat, got: ${dimensions}`,
    );

    const knitDisabled = await page.$eval('[id="knit-button"]', (el) => {
      return (
        el.getAttribute("aria-disabled") === "true" ||
        el.hasAttribute("disabled") ||
        getComputedStyle(el).pointerEvents === "none"
      );
    });
    assert(!knitDisabled, "Knit button should be enabled after loading .pat");
  } finally {
    fs.unlinkSync(tmpPath);
  }
}
