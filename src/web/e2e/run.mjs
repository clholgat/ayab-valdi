#!/usr/bin/env node

import { execSync } from "node:child_process";
import { launchBrowser, openApp } from "./helpers/browser.mjs";
import { startDevServer, stopDevServer } from "./helpers/server.mjs";
import { captureFailure, runSpecs } from "./helpers/runner.mjs";
import { smokeSpec } from "./specs/smoke.mjs";
import { validationSpec } from "./specs/validation.mjs";
import { simulationKnitSpec } from "./specs/simulation-knit.mjs";
import { hardwareTestSpec } from "./specs/hardware-test.mjs";
import { loadImageSpec } from "./specs/load-image.mjs";
import { settingsSpec } from "./specs/settings.mjs";
import { previewTransformsSpec } from "./specs/preview-transforms.mjs";
import { progressStitchSpec } from "./specs/progress-stitch.mjs";
import { loadPatSpec } from "./specs/load-pat.mjs";
import {
  knitCancelRestartSimulationSpec,
  knitCancelRestartWebSerialSpec,
} from "./specs/knit-cancel-restart.mjs";
import { knitNaturalCompletionSpec } from "./specs/knit-natural-completion.mjs";
import { startAyabWsServer } from "./helpers/ayabWsServer.mjs";

const webDir = new URL("..", import.meta.url).pathname;

console.log("Building ayab_web for E2E...");
execSync("npm run ensure-ayab-web", { cwd: webDir, stdio: "inherit" });

const allSpecs = [
  { name: "smoke", fn: smokeSpec },
  { name: "load-image", fn: loadImageSpec },
  { name: "load-pat", fn: loadPatSpec },
  { name: "validation", fn: validationSpec },
  { name: "simulation-knit", fn: simulationKnitSpec },
  { name: "hardware-test", fn: hardwareTestSpec },
  { name: "settings", fn: settingsSpec },
  { name: "preview-transforms", fn: previewTransformsSpec },
  { name: "progress-stitch", fn: progressStitchSpec },
  { name: "knit-cancel-restart", fn: knitCancelRestartSimulationSpec },
  { name: "knit-cancel-restart-ws", fn: knitCancelRestartWebSerialSpec },
  { name: "knit-natural-completion", fn: knitNaturalCompletionSpec },
];

// E2E_ONLY=comma,separated,names to run a subset while iterating locally.
const only = process.env.E2E_ONLY?.split(",").map((s) => s.trim());
const specs = only ? allSpecs.filter((s) => only.includes(s.name)) : allSpecs;

let serverChild = null;
let browser = null;
let baseUrl = "";

async function runSpec(spec) {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(String(err));
  });

  const ctx = { page, consoleErrors, url: baseUrl };
  let wsServer = null;
  try {
    if (spec.name === "knit-cancel-restart-ws") {
      wsServer = await startAyabWsServer();
      await page.evaluateOnNewDocument((wsUrl) => {
        window.__E2E_WEBSOCKET_URI__ = wsUrl;
      }, wsServer.url);
      ctx.wsUrl = wsServer.url;
    }
    await openApp(browser, baseUrl, page);
    await spec.fn(ctx);
  } catch (error) {
    if (!error.screenshotPath) {
      throw await captureFailure(page, spec.name);
    }
    throw error;
  } finally {
    if (wsServer) {
      await wsServer.close();
    }
    await page.close();
  }
}

try {
  const { url, child } = await startDevServer(
    Number(process.env.E2E_PORT) || 3199,
  );
  serverChild = child;
  baseUrl = url;
  console.log(`E2E target: ${url}`);

  browser = await launchBrowser();

  const failures = await runSpecs(
    specs.map((spec) => ({
      name: spec.name,
      fn: () => runSpec(spec),
    })),
  );

  if (failures.length > 0) {
    process.exitCode = 1;
    console.error(`\n${failures.length} spec(s) failed.`);
  } else {
    console.log("\nAll E2E specs passed.");
  }
} finally {
  if (browser) {
    await browser.close();
  }
  stopDevServer(serverChild);
}

// All specs have already been graded via process.exitCode above; force-exit
// rather than letting Node wait on the event loop, since an orphaned
// grandchild process or lingering Puppeteer/Chrome handle can otherwise keep
// this script (and the CI job) alive indefinitely after everything we
// actually care about has finished. Observed in CI: all specs passed but the
// job ran for 5+ hours until GitHub's 6h cap force-canceled it.
process.exit(process.exitCode ?? 0);
