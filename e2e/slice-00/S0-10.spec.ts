import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { rmSync } from "node:fs";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import { createFromSwitcher, expectToast, signInAs } from "./helpers";

// This test starts and stops its own dev server (on its own port and build folder, with the e2e data file),
// so it can restart it without touching the server the other tests use.
const PORT = 3201;
const BASE = `http://localhost:${PORT}`;
const DIST = ".next-e2e-restart";

function startServer(): ChildProcess {
  return spawn("npx", ["next", "dev", "--port", String(PORT)], {
    env: { ...process.env, INFOMAPPER_DEV_DB: E2E_DB, NEXT_DIST_DIR: DIST },
    shell: true,
    stdio: "ignore",
    detached: process.platform !== "win32",
  });
}

/** Stops the server: its process tree, and whatever still listens on the port (npx can leave next running). */
function stopServer(server?: ChildProcess) {
  if (process.platform === "win32") {
    if (server?.pid) spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
    const netstat = spawnSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" }).stdout ?? "";
    const pids = new Set(
      netstat
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.includes(`:${PORT} `) && line.includes("LISTENING"))
        .map((line) => line.split(" ").filter(Boolean).pop()!)
        .filter((pid) => pid && pid !== "0"),
    );
    for (const pid of pids) spawnSync("taskkill", ["/pid", pid, "/T", "/F"]);
  } else if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

/** This test's server, stopped after the test even when it times out (a `finally` does not run then, and a server
 * left on port 3201 disturbed the next run's server). */
let server: ChildProcess | undefined;
test.afterEach(async () => {
  stopServer(server);
  server = undefined;
  await waitUntil(false);
  // a server stopped by force can leave half-written files (route types that `tsc` reads); this folder is only ours
  rmSync(DIST, { recursive: true, force: true });
});

/** Steps on a freshly started dev server wait longer: it compiles each page and action on first use. */
const COLD = 60_000;

async function waitUntil(up: boolean) {
  for (let i = 0; i < 240; i++) {
    const ok = await fetch(`${BASE}/sign-in`).then(
      (r) => r.ok,
      () => false,
    );
    if (ok === up) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not ${up ? "start" : "stop"} in time`);
}

test("S0-10: after stopping and restarting the dev server, created projects and canvases are still there", async ({ browser }) => {
  test.setTimeout(480_000);
  stopServer(); // a server left over from an interrupted run
  await waitUntil(false);
  rmSync(DIST, { recursive: true, force: true });
  server = startServer();
  // a browser session that talks to this test's own server, not the shared one
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  try {
    await waitUntil(true);
    await signInAs(page, "Łukasz");
    expect(new URL(page.url()).port).toBe(String(PORT));
    await createFromSwitcher(page, "switcher-project", "input-new-project", "Survivor");
    await expectToast(page, "Created the project Survivor.", COLD);
    await page.getByTestId("tile-new-canvas").click();
    await page.getByTestId("input-canvas-name").fill("Still here");
    await page.getByTestId("input-canvas-name").press("Enter");
    await expectToast(page, "Renamed the canvas to Still here.", COLD);
    await expect(page).not.toHaveURL(/rename=1/);
    const canvasUrl = page.url();

    stopServer(server);
    await waitUntil(false);
    server = startServer();
    await waitUntil(true);

    await page.goto(canvasUrl);
    expect(new URL(page.url()).port).toBe(String(PORT));
    await expect(page.getByTestId("switcher-project")).toHaveText("Survivor", { timeout: COLD });
    await expect(page.getByTestId("tab-canvas-name")).toHaveText(["First canvas", "Still here"], { timeout: COLD });
    await expect(page.getByTestId("area-canvas")).toBeVisible({ timeout: COLD });
  } finally {
    await context.close();
  }
});
