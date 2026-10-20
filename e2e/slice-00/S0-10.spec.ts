import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { E2E_DB } from "../config";
import type { BrowserContext } from "@playwright/test";
import { expect, test } from "./fixtures";
import { createFromSwitcher, expectToast, signInAs } from "./helpers";

// This test starts and stops its own dev server (on its own port and build folder, with the e2e data file),
// so it can restart it without touching the server the other tests use.
const PORT = 3201;
const BASE = `http://localhost:${PORT}`;
/**
 * The first start's build folder, and the restart's (slice 4b-2, step 8): `next dev` holds a lock in its build folder,
 * and on Windows a lock left by a server stopped by force is released only some time after its process is gone. A
 * restart on the same folder then found it held, gave up and exited, and the test waited out its 300 s (the S0-10
 * failures since slice 1a). The data the test checks lives in the data file, not here.
 */
const DISTS = [".next-e2e-restart", ".next-e2e-restart-2"] as const;
/** The servers' output, for when a start fails. */
const LOGS = path.join(".data", "e2e-runs");
const logOf = (n: number) => path.join(LOGS, `S0-10-server-${n}.log`);

/** Starts the dev server on the given build folder; its output goes to `logOf(n)`; `exited` is set when it ends. */
function startServer(n: number): ChildProcess {
  mkdirSync(LOGS, { recursive: true });
  const out = openSync(logOf(n), "w");
  const child = spawn("npx", ["next", "dev", "--port", String(PORT)], {
    env: { ...process.env, INFOMAPPER_DEV_DB: E2E_DB, NEXT_DIST_DIR: DISTS[n] },
    shell: true,
    stdio: ["ignore", out, out],
    detached: process.platform !== "win32",
  });
  closeSync(out);
  exited = null;
  // only the current server's end counts (the stopped one's may be reported after the restart began)
  child.on("exit", (code) => {
    if (server === child) exited = { code, log: logOf(n) };
  });
  return child;
}
let exited: { code: number | null; log: string } | null = null;

const removeDists = () => {
  for (const d of DISTS) rmSync(d, { recursive: true, force: true });
};

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
  // a server stopped by force can leave half-written files (route types that `tsc` reads); these folders are only ours
  removeDists();
});

/** Steps on a freshly started dev server wait longer: it compiles each page and action on first use. */
const COLD = 60_000;
/**
 * How long a cold dev server may take to answer: it starts without Turbopack's cache and compiles the sign-in page on
 * the first request. On the development laptop that sometimes took more than two minutes (slice 1a and 1b runs).
 */
const START = 300_000;
const STOP = 120_000;

/** Waits until the server answers (or no longer answers), by the clock: a request that hangs on a compile counts too. */
async function waitUntil(up: boolean) {
  const deadline = Date.now() + (up ? START : STOP);
  while (Date.now() < deadline) {
    // a server that ended before it answered will not answer: fail now, with its last words (slice 4b-2, step 8)
    if (up && exited) {
      const tail = readFileSync(exited.log, "utf8").split("\n").slice(-15).join("\n");
      throw new Error(`Server exited (code ${exited.code}) before it answered; ${exited.log}:\n${tail}`);
    }
    const ok = await fetch(`${BASE}/sign-in`, { signal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())) }).then(
      (r) => r.ok,
      () => false,
    );
    if (ok === up) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not ${up ? "start" : "stop"} within ${(up ? START : STOP) / 1000} s`);
}

/** Compiles a page on the restarted server before the test looks at it, as the global setup does for the shared one. */
async function warm(context: BrowserContext, url: string) {
  await context.request.get(url, { timeout: START });
}

test("S0-10: after stopping and restarting the dev server, created projects and canvases are still there", async ({ browser }) => {
  // two cold starts (START each), two stops and the steps with COLD waits
  test.setTimeout(900_000);
  stopServer(); // a server left over from an interrupted run
  await waitUntil(false);
  removeDists();
  server = startServer(0);
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
    // Leave the page first: its dev client would reload it on its own once the server is back, and that reload would
    // cut the navigation below short.
    await page.goto("about:blank");

    stopServer(server);
    await waitUntil(false);
    exited = null;
    // the restart on a build folder of its own (DISTS): the first server's lock cannot hold it up
    server = startServer(1);
    await waitUntil(true);
    await warm(context, canvasUrl);

    await page.goto(canvasUrl);
    expect(new URL(page.url()).port).toBe(String(PORT));
    await expect(page.getByTestId("switcher-project")).toHaveText("Survivor", { timeout: COLD });
    await expect(page.getByTestId("tab-canvas-name")).toHaveText(["First canvas", "Still here"], { timeout: COLD });
    await expect(page.getByTestId("area-canvas")).toBeVisible({ timeout: COLD });
  } finally {
    await context.close();
  }
});
