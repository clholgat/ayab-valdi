import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assert } from "../helpers/runner.mjs";
import {
  textByA11yId,
  waitForAppReady,
  waitForA11yText,
  waitForKnitDisabled,
  waitForKnitEnabled,
} from "../helpers/selectors.mjs";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/triangles_60x10.png",
);

export async function loadImageSpec(ctx) {
  const { page } = ctx;
  await waitForAppReady(page);
  await waitForKnitDisabled(page);

  const fileInput = await page.waitForSelector('input[type="file"]', {
    timeout: 15000,
  });
  await fileInput.uploadFile(fixturePath);

  await waitForA11yText(page, "preview-image-name", "triangles_60x10", 60000);
  const name = await textByA11yId(page, "preview-image-name");
  assert(
    name.toLowerCase().includes("triangles_60x10"),
    `Expected uploaded file name, got: ${name}`,
  );

  const dimensions = await textByA11yId(page, "preview-dimensions");
  assert(/^\d+x\d+$/.test(dimensions.trim()), `Expected WxH dimensions, got: ${dimensions}`);

  await waitForKnitEnabled(page);
}
