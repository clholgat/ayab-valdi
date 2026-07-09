import puppeteer from "puppeteer";
import { waitForA11yId } from "./selectors.mjs";

export async function launchBrowser() {
  return puppeteer.launch({
    headless: process.env.E2E_HEADFUL ? false : true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    protocolTimeout: 300000,
  });
}

export async function openApp(browser, url, existingPage) {
  const page = existingPage ?? (await browser.newPage());
  if (!existingPage) {
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(String(err));
    });
  }

  await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
  await waitForA11yId(page, "app-root", 60000);
  return { page };
}
