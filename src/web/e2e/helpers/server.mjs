import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_PORT = 3199;

export async function waitForServer(url, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return;
      }
    } catch {
      // Server not ready yet.
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export async function startDevServer(port = DEFAULT_PORT) {
  const url = `http://localhost:${port}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const html = await res.text();
      if (html.includes("ayab_web") || html.includes("Valdi Web App")) {
        return { url, child: null, port };
      }
    }
  } catch {
    // Not running — start below.
  }

  const child = spawn("npm", ["run", "serve"], {
    cwd: new URL("../..", import.meta.url).pathname,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
    // npm doesn't forward signals to the webpack-dev-server process it
    // spawns as its own child, so a plain SIGTERM to `child` can leave that
    // grandchild running as an orphan - which keeps Node's event loop (and
    // the CI job) alive indefinitely even after all specs finish. Run it in
    // its own process group so stopDevServer() can signal the whole tree.
    detached: true,
  });

  child.stdout?.on("data", (chunk) => {
    if (process.env.E2E_VERBOSE) {
      process.stdout.write(chunk);
    }
  });
  child.stderr?.on("data", (chunk) => {
    if (process.env.E2E_VERBOSE) {
      process.stderr.write(chunk);
    }
  });

  await waitForServer(url);
  return { url, child, port };
}

export function stopDevServer(child) {
  if (child && !child.killed && child.pid) {
    try {
      // Negative pid targets the whole process group (see the `detached`
      // comment above) so npm's actual webpack-dev-server grandchild is
      // signaled too, not just the npm wrapper process.
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // Group or process may have already exited.
    }
  }
}
