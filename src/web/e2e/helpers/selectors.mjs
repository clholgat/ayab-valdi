/** Valdi accessibilityId → DOM id on web (see WebValdiLayout). */
function sel(id) {
  return `[id="${id}"]`;
}

export async function waitForAppReady(page, timeoutMs = 90000) {
  await waitForA11yId(page, "app-root", timeoutMs);
  await dismissFirstRunOverlays(page);
  await page.waitForFunction(
    () =>
      document.querySelector('[id="preview-empty-state"]') != null ||
      document.querySelector('[id="preview-dimensions"]') != null,
    { timeout: timeoutMs, polling: WAIT_POLL_MS },
  );
}

/** Load the default tutorial sample (triangles) for specs that need an image before knitting. */
export async function loadDemoPattern(page, timeoutMs = 60000) {
  await clickByA11yId(page, "preview-browse-samples");
  await waitForA11yId(page, "preview-samples-modal", timeoutMs);
  await clickByA11yId(page, "preview-sample-triangles");
  await waitForA11yId(page, "preview-dimensions", timeoutMs);
  await waitForKnitEnabled(page, timeoutMs);
}

/** First-run tour / settings modal block Knit — clear them for deterministic E2E. */
export async function dismissFirstRunOverlays(page, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const skip = await page.$(sel("onboarding-skip"));
    if (skip) {
      await clickByA11yId(page, "onboarding-skip");
      await new Promise((r) => setTimeout(r, 150));
      continue;
    }
    const close = await page.$(sel("settings-modal-close"));
    if (close) {
      await clickByA11yId(page, "settings-modal-close");
      await new Promise((r) => setTimeout(r, 150));
      continue;
    }
    // No overlay this tick — give async tour one more chance to appear.
    await new Promise((r) => setTimeout(r, 200));
    const still =
      (await page.$(sel("onboarding-skip"))) ||
      (await page.$(sel("preferences-panel")));
    if (!still) {
      return;
    }
  }
}

export async function waitForA11yId(page, id, timeoutMs = 30000) {
  await page.waitForSelector(sel(id), { timeout: timeoutMs });
}

export async function textByA11yId(page, id) {
  return page.$eval(sel(id), (el) => el.textContent ?? "");
}

export async function clickByA11yId(page, id, retries = 3) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await waitForA11yId(page, id);
      const handle = await page.$(sel(id));
      if (!handle) {
        throw new Error(`Element not found: ${id}`);
      }
      await handle.evaluate((node) =>
        node.scrollIntoView({ block: "center", inline: "center" }),
      );
      const box = await handle.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await handle.click();
      }
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

/** Puppeteer must poll — Valdi web updates do not trigger mutation/rAF observers. */
const WAIT_POLL_MS = 100;

export async function waitForText(page, text, timeoutMs = 30000) {
  await page.waitForFunction(
    (needle) => document.body.innerText.includes(needle),
    { timeout: timeoutMs, polling: WAIT_POLL_MS },
    text,
  );
}

export async function waitForA11yText(page, id, text, timeoutMs = 30000) {
  await page.waitForFunction(
    (a11yId, needle) => {
      const el = document.querySelector(`[id="${a11yId}"]`);
      return el != null && (el.textContent ?? "").includes(needle);
    },
    { timeout: timeoutMs, polling: WAIT_POLL_MS },
    id,
    text,
  );
}

export async function setInputByA11yId(page, id, value) {
  await clickByA11yId(page, id);
  const handle = await page.$(sel(id));
  if (!handle) {
    throw new Error(`Element not found: ${id}`);
  }
  const input = await handle.evaluateHandle((host) => {
    return (
      host.shadowRoot?.querySelector("input, textarea") ??
      (host.tagName === "INPUT" || host.tagName === "TEXTAREA"
        ? host
        : host.querySelector("input, textarea"))
    );
  });
  const inputEl = input.asElement();
  if (!inputEl) {
    throw new Error(`No input under accessibilityId=${id}`);
  }
  await inputEl.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await inputEl.type(String(value), { delay: 20 });
  await page.keyboard.press("Tab");
}

export async function waitForKnitEnabled(page, timeoutMs = 90000) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[id="knit-button"]');
      if (!el) {
        return false;
      }
      const disabled =
        el.hasAttribute("disabled") ||
        el.getAttribute("aria-disabled") === "true" ||
        el.classList.contains("disabled") ||
        getComputedStyle(el).pointerEvents === "none";
      return !disabled;
    },
    { timeout: timeoutMs, polling: WAIT_POLL_MS },
  );
}

export async function waitForKnitDisabled(page, timeoutMs = 30000) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[id="knit-button"]');
      if (!el) {
        return false;
      }
      return (
        el.hasAttribute("disabled") ||
        el.getAttribute("aria-disabled") === "true" ||
        el.classList.contains("disabled") ||
        getComputedStyle(el).pointerEvents === "none"
      );
    },
    { timeout: timeoutMs, polling: WAIT_POLL_MS },
  );
}

export async function reloadApp(page, url) {
  await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
  await waitForA11yId(page, "app-root", 60000);
}
