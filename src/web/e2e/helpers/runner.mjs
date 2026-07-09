export async function runSpecs(specs) {
  const failures = [];
  for (const spec of specs) {
    process.stdout.write(`\n▶ ${spec.name}\n`);
    try {
      await spec.fn();
      process.stdout.write(`  ✓ passed\n`);
    } catch (error) {
      failures.push({ name: spec.name, error });
      process.stdout.write(`  ✗ failed: ${error.message}\n`);
      if (error.screenshotPath) {
        process.stdout.write(`    screenshot: ${error.screenshotPath}\n`);
      }
    }
  }
  return failures;
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export async function captureFailure(page, name) {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = new URL("../artifacts", import.meta.url).pathname;
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${name.replace(/\W+/g, "-")}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const err = new Error(`Spec failed — screenshot saved to ${file}`);
  err.screenshotPath = file;
  return err;
}
