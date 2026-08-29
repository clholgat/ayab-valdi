import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { assert } from "../helpers/runner.mjs";
import {
  a11ySelector,
  clickByA11yId,
  textByA11yId,
  waitForA11yId,
  waitForA11yText,
  waitForAppReady,
  waitForText,
} from "../helpers/selectors.mjs";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../modules/machine_job/test/fixtures/fixed-two-color.machine-job.json",
);

export async function machineJobImportSpec(ctx) {
  const { page } = ctx;
  await waitForAppReady(page);

  const fixtureText = fs.readFileSync(fixturePath, "utf8");
  const checkpoint = {
    version: 1,
    revision: 0,
    identity: {
      jobId: "golden-fixed-two-color",
      checksum: `sha256:${crypto.createHash("sha256").update(fixtureText).digest("hex")}`,
    },
    machineProfileId: "ayab-0-singlebed-2c",
    status: "active",
    nextPassIndex: 0,
    expectedSide: "unknown",
    acknowledgedPromptIds: [],
    yarnAssignments: [],
    corrections: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  await page.evaluate((savedCheckpoint) => {
    localStorage.setItem(
      "valdi.PersistentStore.ayab_machine_job_checkpoints",
      JSON.stringify({
        active: { s: JSON.stringify(savedCheckpoint) },
      }),
    );
  }, checkpoint);

  const inputs = await page.$$('#root >>> input[type="file"]');
  assert(inputs.length >= 2, "Expected separate pattern and machine-job pickers");
  await inputs[1].uploadFile(fixturePath);

  await waitForA11yId(page, "machine-job-inspection", 15000);
  await waitForA11yText(page, "machine-job-compatibility", "Compatible", 15000);
  await waitForA11yText(page, "machine-job-recovery", "0 of 1 passes", 15000);
  await waitForA11yId(page, "machine-job-resume", 15000);

  const summary = await textByA11yId(page, "machine-job-summary");
  assert(summary.includes("1 rows"), `Expected logical-row total, got: ${summary}`);
  assert(summary.includes("1 passes"), `Expected pass total, got: ${summary}`);
  assert(summary.includes("2 yarns"), `Expected yarn total, got: ${summary}`);
  assert(summary.includes("needles 0–3"), `Expected needle bounds, got: ${summary}`);

  await waitForA11yId(page, "preview-empty-state", 15000);
  const dimensions = await page.$(a11ySelector("preview-dimensions"));
  assert(dimensions === null, "Inspecting a machine job must not replace the raster pattern");

  await clickByA11yId(page, "machine-job-resume");
  await waitForA11yId(page, "cancel-button", 15000);
  // Cancel as soon as the session is live. The browser simulation can finish
  // this one-pass fixture before a text-poll plus click round trip completes.
  await clickByA11yId(page, "cancel-button");
  await waitForText(page, "Progress was retained for recovery", 15000);
  const retainedCheckpoint = await page.evaluate(() => {
    const raw = localStorage.getItem(
      "valdi.PersistentStore.ayab_machine_job_checkpoints",
    );
    const store = raw ? JSON.parse(raw) : undefined;
    return typeof store?.active?.s === "string"
      ? JSON.parse(store.active.s)
      : undefined;
  });
  assert(
    retainedCheckpoint?.status === "active",
    `Expected cancel to retain active progress, got ${JSON.stringify(retainedCheckpoint)}`,
  );

  await clickByA11yId(page, "machine-job-resume");
  await waitForText(page, "Machine job simulation completed", 30000);
  await waitForA11yText(page, "machine-job-compatibility", "Compatible", 15000);

  const durable = await page.evaluate(() => {
    const raw = localStorage.getItem(
      "valdi.PersistentStore.ayab_machine_job_checkpoints",
    );
    const store = raw ? JSON.parse(raw) : undefined;
    const readCheckpoint = (key) => {
      const entry = store?.[key];
      return typeof entry?.s === "string" ? JSON.parse(entry.s) : undefined;
    };
    return {
      current: readCheckpoint("active"),
      hasPrevious: readCheckpoint("active.previous") != null,
    };
  });
  assert(durable?.current, "Expected a durable machine-job checkpoint");
  assert(durable.hasPrevious, "Expected the previous checkpoint generation");
  assert(durable.current.status === "completed", "Expected completed checkpoint status");
  assert(durable.current.identity.jobId === "golden-fixed-two-color", "Expected checkpoint job identity");
  assert(/^sha256:[0-9a-f]{64}$/.test(durable.current.identity.checksum), "Expected SHA-256 checkpoint identity");
  assert(durable.current.nextPassIndex === 1, "Expected final pass boundary in checkpoint");
  assert(durable.current.lastCompletedPassId === "row-1-pass-1", "Expected stable completed pass ID");
}
