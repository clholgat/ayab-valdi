import { assert } from "../helpers/runner.mjs";
import {
  clickByA11yId,
  textByA11yId,
  waitForAppReady,
  waitForA11yId,
  loadDemoPattern,
} from "../helpers/selectors.mjs";

function parseDimensions(text) {
  const match = text.trim().match(/^(\d+)x(\d+)$/);
  if (!match) {
    return null;
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

export async function previewTransformsSpec(ctx) {
  const { page } = ctx;
  await waitForAppReady(page);
  await loadDemoPattern(page);
  await waitForA11yId(page, "preview-dimensions", 60000);

  const initial = parseDimensions(await textByA11yId(page, "preview-dimensions"));
  assert(initial != null, "Preview dimensions should be available");
  assert(initial.width > 0 && initial.height > 0, "Preview should have non-zero size");

  await clickByA11yId(page, "preview-flip-h");
  await page.waitForFunction(
    (expected) => {
      const el = document.querySelector('[id="preview-dimensions"]');
      return (el?.textContent ?? "").trim() === expected;
    },
    {},
    `${initial.width}x${initial.height}`,
  );

  await clickByA11yId(page, "preview-rotate");
  await page.waitForFunction(
    (expected) => {
      const el = document.querySelector('[id="preview-dimensions"]');
      return (el?.textContent ?? "").trim() === expected;
    },
    {},
    `${initial.height}x${initial.width}`,
  );

  const rotated = parseDimensions(await textByA11yId(page, "preview-dimensions"));
  assert(
    rotated?.width === initial.height && rotated?.height === initial.width,
    `Rotate should swap dimensions (${initial.width}x${initial.height} → ${rotated?.width}x${rotated?.height})`,
  );

  await clickByA11yId(page, "preview-invert");
  const afterInvert = parseDimensions(await textByA11yId(page, "preview-dimensions"));
  assert(
    afterInvert?.width === rotated.width && afterInvert?.height === rotated.height,
    "Invert should not change image dimensions",
  );

  await clickByA11yId(page, "preview-repeat-h-increment");
  await page.waitForFunction(
    (expected) => {
      const el = document.querySelector('[id="preview-dimensions"]');
      return (el?.textContent ?? "").trim() === expected;
    },
    {},
    `${afterInvert.width * 2}x${afterInvert.height}`,
  );

  await clickByA11yId(page, "preview-repeat-v-increment");
  await page.waitForFunction(
    (expected) => {
      const el = document.querySelector('[id="preview-dimensions"]');
      return (el?.textContent ?? "").trim() === expected;
    },
    {},
    `${afterInvert.width * 2}x${afterInvert.height * 2}`,
  );
}
