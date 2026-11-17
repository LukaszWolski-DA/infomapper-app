// S29-08 (slice 29, step 4, Q9): the measurement. Runs only with MEASURE=1 (playwright.pg.config.ts):
//   MEASURE=1 PG_BASE_URL=<the preview> npx playwright test --config playwright.pg.config.ts S29-08
//   MEASURE=1 PG_BASE_URL=http://127.0.0.1:3300 LOCAL_DB=<a demo file> npx playwright test --config playwright.pg.config.ts S29-08
// The second is the local adapter's measurement build (`npm run measure:start` with INFOMAPPER_DEV_DB and
// INFOMAPPER_TIMING=1), signed in through the test users' list; never .data/dev-db.json.
//
// Per data set (the demo's "Retail Co – DWH" and "Performance test") and per page (the workspace home, the first project's
// home, its first canvas, that canvas's thumbnail, and for the demo a document's editor with its snapshot): the first
// load of the run on its own, then WARMUP discarded and LOADS counted loads. A page load gives the browser's TTFB and
// response end, the time until the page is drawn (its tiles, its cards, the editor's first pages) and the page's own
// timing record (`im-timing`); the thumbnail its Server-Timing; the snapshot its action's time and its answer's bytes
// (against Vercel's 4.5 MB). Results go to MEASURE_OUT (default .data/measure/s29/) as JSON and are printed as a table.
// Nothing secret is printed: the bypass header is the config's, and no trace is recorded on Vercel.
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { demoPassword, PEOPLE, query } from "./helpers";

const MEASURE = !!process.env.MEASURE;
const LOADS = Number(process.env.LOADS ?? 10);
const WARMUP = Number(process.env.WARMUP ?? 2);
const LOCAL_DB = process.env.LOCAL_DB;
const DATASETS = ["Retail Co – DWH", "Performance test"] as const;

test.skip(!MEASURE, "MEASURE=1 only");
test.setTimeout(30 * 60_000);

interface Ids {
  workspaceId: string;
  projectId: string;
  canvasId: string;
  documentId: string | null;
}

/** The data set's ids: from Postgres (the app's database), or from the local file the measurement build serves. */
async function idsOf(workspace: string): Promise<Ids> {
  if (LOCAL_DB) {
    const db = JSON.parse(fs.readFileSync(LOCAL_DB, "utf8")) as Record<string, Record<string, unknown>[]>;
    const ws = db.workspace!.find((w) => w.name === workspace && w.deleted_at === null)!;
    const projects = db.project!.filter((p) => p.workspace_id === ws.id && p.deleted_at === null);
    const project = projects[0]!;
    const link = db.project_canvas!.filter((l) => l.project_id === project.id).sort((a, b) => (a.sort_order as number) - (b.sort_order as number))[0]!;
    const doc = (db.document_definition ?? []).find((d) => d.workspace_id === ws.id && d.deleted_at === null && d.shared);
    return { workspaceId: ws.id as string, projectId: project.id as string, canvasId: link.canvas_id as string, documentId: (doc?.id as string) ?? null };
  }
  const [ws] = await query<{ id: string }>("select id from workspace where name = $1 and deleted_at is null", [workspace]);
  // the project shown first (the stored order: created_at, then id; data-model-v2.md)
  const [link] = await query<{ project_id: string; canvas_id: string }>(
    `select l.project_id, l.canvas_id from project_canvas l join project p on p.id = l.project_id and p.deleted_at is null
       join canvas c on c.id = l.canvas_id and c.deleted_at is null
      where l.workspace_id = $1 order by p.created_at, p.id, l.sort_order, l.added_at limit 1`,
    [ws!.id],
  );
  const [doc] = await query<{ id: string }>("select id from document_definition where workspace_id = $1 and deleted_at is null and shared order by created_at, id limit 1", [ws!.id]);
  return { workspaceId: ws!.id, projectId: link!.project_id, canvasId: link!.canvas_id, documentId: doc?.id ?? null };
}

async function signInForMeasure(page: Page) {
  if (LOCAL_DB) {
    await page.goto("/sign-in");
    await page.getByTestId("button-dev-user").filter({ hasText: "Łukasz" }).click();
  } else {
    await page.goto("/sign-in");
    await page.getByTestId("input-sign-in-email").fill(PEOPLE.lukasz);
    await page.getByTestId("input-sign-in-password").fill(demoPassword());
    await page.getByTestId("button-sign-in").click();
  }
  await expect(page).not.toHaveURL(/\/sign-in/);
}

interface Sample {
  ttfbMs: number;
  responseEndMs: number;
  readyMs: number;
  server?: Record<string, number>;
  bytes?: number;
}

/** One page load: the browser's timing, the time until `ready` shows, and the page's timing record. */
async function loadPage(page: Page, url: string, ready: (page: Page) => Promise<void>): Promise<Sample> {
  const start = Date.now();
  await page.goto(url, { waitUntil: "commit" });
  await ready(page);
  const readyMs = Date.now() - start;
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return { ttfb: n.responseStart - n.requestStart, end: n.responseEnd - n.requestStart };
  });
  const json = await page.locator('script[data-testid="im-timing"]').first().textContent({ timeout: 1_000 }).catch(() => null);
  return { ttfbMs: Math.round(nav.ttfb), responseEndMs: Math.round(nav.end), readyMs, server: json ? (JSON.parse(json) as Record<string, number>) : undefined };
}

/** The thumbnail's drawing: the request's time and its Server-Timing (route handlers only, F15). */
async function loadThumbnail(page: Page, href: string): Promise<Sample> {
  const start = Date.now();
  const res = await page.request.get(href, { headers: { "cache-control": "no-cache" } });
  const ms = Date.now() - start;
  expect(res.status()).toBe(200);
  // the whole header at once: its desc ("38 calls, 91 statements") holds a comma, so it is never split on one
  const header = res.headers()["server-timing"] ?? "";
  const server: Record<string, number> = {};
  for (const m of header.matchAll(/(\w+);dur=([\d.]+)/g)) server[m[1] === "db" ? "statementMs" : `${m[1]}Ms`] = Number(m[2]);
  const counts = /(\d+) calls?, (\d+) statements?/.exec(header);
  if (counts) Object.assign(server, { calls: Number(counts[1]), statements: Number(counts[2]) });
  return { ttfbMs: ms, responseEndMs: ms, readyMs: ms, server, bytes: (await res.body()).length };
}

/** The editor's load and its snapshot action: the action's time and its answer's bytes. */
async function loadEditor(page: Page, url: string): Promise<Sample> {
  const start = Date.now();
  // the snapshot action: a POST with Next-Action to the editor's own address, sent once the editor has hydrated
  const answer = page.waitForResponse(
    (r) => r.request().method() === "POST" && !!r.request().headers()["next-action"] && new URL(r.url()).pathname === url,
    { timeout: 120_000 },
  );
  await page.goto(url, { waitUntil: "commit" });
  const res = await answer;
  // the editor has the snapshot once its preview has laid out its first pages; the request's timing is then complete.
  // `finished()` never settled for this answer (a 30-minute run), so the bytes wait 2 s at most (the uncompressed sizes
  // are scripts/pg-snapshot-size.ts's)
  await expect(page.getByTestId("page-document-editor")).toBeVisible();
  await expect(page.getByTestId("text-pages")).toHaveText(/^\d+ pages?$/, { timeout: 60_000 });
  const sizes = await Promise.race([res.request().sizes(), new Promise<null>((r) => setTimeout(() => r(null), 2_000))]).catch(() => null);
  const t = res.request().timing();
  return { ttfbMs: Math.round(t.responseStart - t.requestStart), responseEndMs: t.responseEnd > 0 ? Math.round(t.responseEnd - t.requestStart) : NaN, readyMs: Date.now() - start, bytes: sizes?.responseBodySize };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN;
};

test("S29-08: the pages' load and reads, the thumbnail and the snapshot", async ({ page }) => {
  await signInForMeasure(page);
  const results: Record<string, { first: Sample; samples: Sample[] }> = {};
  const run = async (key: string, once: () => Promise<Sample>) => {
    const first = await once();
    for (let i = 0; i < WARMUP; i++) await once();
    const samples: Sample[] = [];
    for (let i = 0; i < LOADS; i++) samples.push(await once());
    results[key] = { first, samples };
  };

  for (const dataset of DATASETS) {
    const ids = await idsOf(dataset);
    const home = `/w/${ids.workspaceId}`;
    const projectHome = `${home}/p/${ids.projectId}`;
    const canvas = `${projectHome}/c/${ids.canvasId}`;
    await run(`${dataset} | workspace home`, () => loadPage(page, home, (p) => expect(p.getByTestId("page-workspace-home")).toBeVisible()));
    await run(`${dataset} | project home`, () => loadPage(page, projectHome, (p) => expect(p.getByTestId("tile-canvas").first()).toBeVisible()));
    await run(`${dataset} | canvas page`, () => loadPage(page, canvas, (p) => expect(p.locator(".react-flow__node").first()).toBeVisible({ timeout: 60_000 })));
    await page.goto(projectHome);
    const href = (await page.locator(`[data-testid="tile-canvas"] use`).first().getAttribute("href"))!.split("#")[0]!;
    await run(`${dataset} | thumbnail`, () => loadThumbnail(page, href));
    if (ids.documentId) await run(`${dataset} | editor snapshot`, () => loadEditor(page, `${home}/d/${ids.documentId}`));
  }

  const target = LOCAL_DB ? "local adapter (measurement build)" : `Vercel preview ${new URL(test.info().project.use.baseURL!).hostname}`;
  const rows = Object.entries(results).map(([key, { first, samples }]) => {
    const m = (f: (s: Sample) => number | undefined) => median(samples.map(f).filter((x): x is number => typeof x === "number"));
    return {
      key,
      firstReadyMs: first.readyMs,
      ttfbMs: m((s) => s.ttfbMs),
      responseEndMs: m((s) => s.responseEndMs),
      readyMs: m((s) => s.readyMs),
      calls: m((s) => s.server?.calls),
      statements: m((s) => s.server?.statements),
      statementMs: m((s) => s.server?.statementMs),
      waitMs: m((s) => s.server?.waitMs),
      readMs: m((s) => s.server?.readMs),
      serverTotalMs: m((s) => s.server?.totalMs),
      bytes: m((s) => s.bytes),
    };
  });
  console.log(`\nS29-08 on ${target}, ${LOADS} loads after ${WARMUP} discarded (medians; "first" is the run's first load)`);
  console.table(rows);
  const out = process.env.MEASURE_OUT ?? path.join(".data", "measure", "s29");
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, `${LOCAL_DB ? "local" : "preview"}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ target, loads: LOADS, warmup: WARMUP, at: new Date().toISOString(), rows, results }, null, 2));
  console.log(`Written: ${file}`);
});
