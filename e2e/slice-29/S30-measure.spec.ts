// S30-05 and S30-13 (slice 30; fixed in slice 31): the writes measured on Postgres, in the style of S29-08. Runs only
// with MEASURE=1 (playwright.pg.config.ts):
//   MEASURE=1 PG_BASE_URL=<dev's preview> npx playwright test --config playwright.pg.config.ts S30-measure
// The server needs INFOMAPPER_TIMING=1 (the preview's Preview variable; for dev:pg in the environment). By default it
// measures the demo's "Retail Co – DWH" as the demo's Łukasz; with MEASURE_WORKSPACE (and MEASURE_EMAIL_VAR,
// MEASURE_PASSWORD_VAR) the workspace of that id as that account, recording numbers only (`measure-target.ts`).
//
// - S30-13: per write kind (a card's entity renamed in the entity panel, an attribute added there, the card moved by its
//   header, Undo in the top bar), WARMUP discarded and LOADS counted writes, each from the action to the top bar's
//   indicator turning "Saved" after "Saving…". The times are stamped in the page on every frame from the indicator's
//   `data-state` (slice 30's measurement: Playwright's polling rounded them up to its retry steps); the page's timing
//   record (`im-timing`) counts as the refresh only when it changed after the write, waited for up to 2 s outside the
//   timed span (slice 30: the first load's record was counted). The card is the canvas's first entity card whose header
//   lies wholly in the canvas's visible area (slice 30: the first card lay under the top bar, where a drag moves nothing).
//   At the end every step the spec made is undone in the top bar, back to the undo list's top before it began.
// - S30-05 (the demo only): a 10,000-column file (`syntheticStandard`, 1,000 tables) through the wizard: the file read
//   and the review shown, the click on "Import into" to the dialog's close, the route's `Server-Timing`; meanwhile Anna
//   renames Customer again and again until after the import's answer: how long each save waits. At the end the import is
//   undone and Anna's renames too.
// The write's own split (its statements, the lock's wait, the transaction) is one log line per write on the server.
// Results go to MEASURE_OUT (default .data/measure/s30/, own mode .data/measure/s31/) as JSON and are printed as a table.
// Nothing secret, and in own mode no name, is printed.
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { syntheticStandard } from "../../scripts/lib/import-synthetic";
import { demoPassword, firstCanvas, PEOPLE, query, workspaceId } from "./helpers";
import { largestCanvas, measureUserId, OWN_MODE, OWN_WORKSPACE, signInToMeasure, undoTop } from "./measure-target";

const MEASURE = !!process.env.MEASURE;
const LOADS = Number(process.env.LOADS ?? 10);
const WARMUP = Number(process.env.WARMUP ?? 2);
const OUT = process.env.MEASURE_OUT ?? path.join(".data", "measure", OWN_MODE ? "s31" : "s30");
const DEMO = "Retail Co – DWH";

test.skip(!MEASURE, "MEASURE=1 only");
test.setTimeout(30 * 60_000);

type Log = { __im: { t: number; s: string }[]; __imDialogClosed: number | null };

/** The canvas to measure: the demo's first canvas, or the own workspace's largest. */
async function target() {
  if (OWN_WORKSPACE) return largestCanvas(OWN_WORKSPACE);
  const ws = await workspaceId(DEMO);
  const { projectId, canvasId } = await firstCanvas(DEMO);
  return { workspaceId: ws, projectId, canvasId, documentId: null };
}

/** Opens the canvas and starts the page's own log. */
async function openCanvas(page: Page, t: { workspaceId: string; projectId: string; canvasId: string }) {
  await page.goto(`/w/${t.workspaceId}/p/${t.projectId}/c/${t.canvasId}`);
  await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 60_000 });
  await startLog(page);
}

/** The page's own log: the indicator's state and the import dialog's close, stamped on every frame. */
async function startLog(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as Log;
    w.__im = [];
    w.__imDialogClosed = null;
    let last = "";
    let seen = false;
    // the indicator may be mounted again by a fresh page: its current element is read on every frame
    const tick = () => {
      const s = document.querySelector('[data-testid="indicator-save"]')?.getAttribute("data-state") ?? "";
      if (s !== last) w.__im.push({ t: performance.now(), s: (last = s) });
      const open = !!document.querySelector('[data-testid="dialog-import"]');
      if (open) seen = true;
      else if (seen && w.__imDialogClosed === null) w.__imDialogClosed = performance.now();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

const now = (page: Page) => page.evaluate(() => performance.now());
const indicator = (page: Page) => page.getByTestId("indicator-save");
const timingText = async (page: Page) => {
  const t = page.getByTestId("im-timing");
  return (await t.count()) ? ((await t.first().textContent()) ?? "") : null;
};

/** After `t0`: the first "saving" and the first "saved" or "failed" after it, from the page's log. */
async function ended(page: Page, t0: number, timeout = 60_000) {
  const h = await page.waitForFunction(
    (t0) => {
      const log = (window as unknown as Log).__im.filter((e) => e.t >= t0);
      const saving = log.find((e) => e.s === "saving");
      const end = saving && log.find((e) => e.t >= saving.t && (e.s === "saved" || e.s === "failed"));
      return end ? { saving: saving.t, end: end.t, state: end.s } : null;
    },
    t0,
    { polling: "raf", timeout },
  );
  return (await h.jsonValue()) as { saving: number; end: number; state: string };
}

/** One write: `act`, until the indicator says Saved; the times, and the page's record if a refresh brought a new one. */
async function oneWrite(page: Page, act: () => Promise<void>) {
  await expect(indicator(page)).not.toHaveAttribute("data-state", "saving", { timeout: 60_000 });
  const before = await timingText(page);
  const t0 = await now(page);
  await act();
  const e = await ended(page, t0);
  if (e.state !== "saved") throw new Error("A write failed.");
  // a refresh's record may arrive after "Saved": up to 2 s, outside the timed span
  let after = await timingText(page);
  for (let k = 0; k < 40 && after === before; k++) {
    await page.waitForTimeout(50);
    after = await timingText(page);
  }
  const refreshed = after !== null && after !== before;
  return { ms: Math.round(e.end - t0), savingToSaved: Math.round(e.end - e.saving), refreshed, page: refreshed ? (JSON.parse(after!) as Record<string, number>) : null };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN;
};

async function series(name: string, page: Page, act: (i: number) => Promise<void>) {
  const samples: Awaited<ReturnType<typeof oneWrite>>[] = [];
  for (let i = 0; i < WARMUP + LOADS; i++) {
    const s = await oneWrite(page, () => act(i));
    if (i >= WARMUP) samples.push(s);
  }
  const ms = samples.map((s) => s.ms);
  const refreshed = samples.filter((s) => s.refreshed);
  const pick = (k: string) => (refreshed.length ? median(refreshed.map((s) => s.page![k]!).filter((x) => typeof x === "number")) : null);
  return {
    name,
    medianMs: median(ms),
    minMs: Math.min(...ms),
    maxMs: Math.max(...ms),
    savingToSavedMs: median(samples.map((s) => s.savingToSaved)),
    refreshed: refreshed.length,
    calls: pick("calls"),
    statements: pick("statements"),
    statementMs: pick("statementMs"),
    waitMs: pick("waitMs"),
    readMs: pick("readMs"),
    serverTotalMs: pick("totalMs"),
    samples,
  };
}

/** The first entity card whose header lies wholly inside the canvas's visible area: its canvas item's id and header. */
async function cardInView(page: Page): Promise<{ itemId: string; x: number; y: number }> {
  const found = await page.evaluate(() => {
    const area = document.querySelector('[data-testid="area-canvas"]')?.getBoundingClientRect();
    if (!area) return null;
    for (const node of document.querySelectorAll<HTMLElement>(".react-flow__node")) {
      const head = node.querySelector<HTMLElement>('[data-testid="card-entity"] .c-head');
      if (!head) continue;
      const r = head.getBoundingClientRect();
      if (r.left >= area.left + 8 && r.right <= area.right - 8 && r.top >= area.top + 58 && r.bottom <= area.bottom - 60) {
        return { itemId: node.dataset.id ?? "", x: r.left + Math.min(r.width / 2, 60), y: r.top + r.height / 2 };
      }
    }
    return null;
  });
  if (!found?.itemId) throw new Error("No entity card's header lies wholly in view.");
  return found;
}

/**
 * Undoes in the top bar until the account's undo list is back at `top` (every step the spec made). An Undo the page
 * reports as failed may still be done by the server (a large import's undo from the laptop's dev:pg outlasted the
 * browser's request, slice 31): the list's top is read until the step has left, up to 5 minutes, before it counts as
 * failed.
 */
async function undoBackTo(page: Page, workspace: string, userId: string, top: number) {
  for (let k = 0; k < 200; k++) {
    const before = await undoTop(workspace, userId);
    if (before <= top) break;
    await expect(indicator(page)).not.toHaveAttribute("data-state", "saving", { timeout: 300_000 });
    const t0 = await now(page);
    await page.getByTestId("button-undo").click();
    const e = await ended(page, t0, 300_000);
    if (e.state !== "saved") {
      await expect.poll(() => undoTop(workspace, userId), { timeout: 300_000, intervals: [2_000] }).toBeLessThan(before);
      // the page's answer was lost: a fresh page, and its log again
      await page.reload();
      await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 60_000 });
      await startLog(page);
    }
  }
  expect(await undoTop(workspace, userId)).toBeLessThanOrEqual(top);
}

test("S30-13: warm medians of a rename, an added attribute, a moved card and Undo", async ({ page }) => {
  const t = await target();
  const userId = await measureUserId();
  await signInToMeasure(page);
  await openCanvas(page, t);
  const top = await undoTop(t.workspaceId, userId);
  const results = [];

  const card = await cardInView(page);
  const [item] = await query<{ entity_id: string }>("select entity_id from canvas_item where id = $1", [card.itemId]);
  const [entity] = await query<{ name: string }>("select name from entity where id = $1", [item!.entity_id]);
  const select = async () => {
    const c = await cardInView(page);
    await page.mouse.click(card.itemId === c.itemId ? c.x : card.x, card.itemId === c.itemId ? c.y : card.y);
    await expect(page.getByTestId("panel-entity")).toBeVisible();
  };
  try {
    await select();
    const name = page.getByTestId("panel-entity").getByTestId("input-entity-name");
    await expect(name).toHaveValue(entity!.name);
    results.push(
      await series("rename", page, async (i) => {
        await name.fill(`${entity!.name} (m${i})`);
        await name.press("Enter");
      }),
    );
    results.push(
      await series("move a card", page, async (i) => {
        const at = await cardInView(page);
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
        await page.mouse.move(at.x + (i % 2 ? -40 : 40), at.y, { steps: 8 });
        await page.mouse.up();
      }),
    );
    results.push(
      await series("add an attribute", page, async () => {
        await select();
        await page.getByTestId("panel-entity").getByTestId("button-add-attribute").click();
      }),
    );
    results.push(await series("undo", page, () => page.getByTestId("button-undo").click()));
  } finally {
    await undoBackTo(page, t.workspaceId, userId, top);
  }
  const [after] = await query<{ name: string }>("select name from entity where id = $1", [item!.entity_id]);
  expect(after!.name).toBe(entity!.name);
  report("s30-13", results.map(({ samples, ...r }) => ({ ...r, samples: samples.length })), results);
});

test("S30-05: a 10,000-column import, and another session's save meanwhile", async ({ page, browser }) => {
  test.skip(OWN_MODE, "the demo only: an import would add 10,000 columns to the workspace measured");
  const t = await target();
  const text = syntheticStandard(1000);
  const system = `Synth ${Date.now()}`;
  const lukasz = await measureUserId();
  await signInToMeasure(page);
  await openCanvas(page, t);
  const lukaszTop = await undoTop(t.workspaceId, lukasz);
  await page.getByTestId("tab-sources").click();
  await page.getByTestId("button-import-sources").click();
  await expect(page.getByTestId("dialog-import")).toBeVisible();
  await page.getByText("A new system", { exact: true }).click();
  await page.getByTestId("input-new-system-name").fill(system);
  const reading = Date.now();
  await page.getByTestId("input-import-file").setInputFiles({ name: "synth.csv", mimeType: "text/plain", buffer: Buffer.from(text, "utf8") });
  await expect(page.getByTestId("import-loaded")).toBeVisible({ timeout: 120_000 });
  const loadedMs = Date.now() - reading;
  await page.getByTestId("button-wizard-next").click();
  await page.getByTestId("button-wizard-next").click();
  await expect(page.getByTestId("wizard-step-3")).toHaveAttribute("aria-current", "step", { timeout: 120_000 });
  const reviewMs = Date.now() - reading;

  // the second session, ready on the same workspace
  const [annaRow] = await query<{ id: string }>("select id from app_user where email = $1", [PEOPLE.anna]);
  const anna = await (await browser.newContext()).newPage();
  await anna.goto("/sign-in");
  await anna.getByTestId("input-sign-in-email").fill(PEOPLE.anna);
  await anna.getByTestId("input-sign-in-password").fill(demoPassword());
  await anna.getByTestId("button-sign-in").click();
  await expect(anna).not.toHaveURL(/\/sign-in/);
  await openCanvas(anna, t);
  const annaTop = await undoTop(t.workspaceId, annaRow!.id);
  await anna.getByTestId("tab-model").click();
  await anna.getByTestId("tree-item").filter({ has: anna.getByText("Customer", { exact: true }) }).click();
  const annaName = anna.getByTestId("panel-entity").getByTestId("input-entity-name");
  await expect(annaName).toHaveValue("Customer");

  try {
    // Anna's rename alone first, as the reference
    const a0 = await now(anna);
    await annaName.fill("Customer (alone)");
    await annaName.press("Enter");
    const annaAloneMs = Math.round((await ended(anna, a0)).end - a0);

    let requestAt = 0;
    let responseAt = 0;
    page.on("request", (r) => {
      if (r.url().endsWith("/import") && r.method() === "POST" && !requestAt) requestAt = Date.now();
    });
    const response = page
      .waitForResponse((r) => r.url().endsWith("/import") && r.request().method() === "POST", { timeout: 300_000 })
      .then((r) => {
        responseAt = Date.now();
        return { status: r.status(), timing: r.headers()["server-timing"] ?? null };
      });
    const t0 = await now(page);
    const clickAt = Date.now();
    await page.getByTestId("button-wizard-import").click();
    // Anna's renames, one after another from the click until the import's answer, and one after it
    const annaSaves: { sentAfterClickMs: number; ms: number; state: string }[] = [];
    for (let k = 1, after = 0; after < 1; k++) {
      if (responseAt) after++;
      await expect(indicator(anna)).not.toHaveAttribute("data-state", "saving", { timeout: 300_000 });
      const sentAt = Date.now();
      const a1 = await now(anna);
      await annaName.fill(`Customer (meanwhile ${k})`);
      await annaName.press("Enter");
      const a = await ended(anna, a1, 300_000);
      annaSaves.push({ sentAfterClickMs: sentAt - clickAt, ms: Math.round(a.end - a1), state: a.state });
    }
    const closed = (await (await page.waitForFunction(() => (window as unknown as Log).__imDialogClosed, null, { polling: "raf", timeout: 300_000 })).jsonValue()) as number;
    const st = await response;
    const longest = annaSaves.reduce((m, s) => (s.ms > m.ms ? s : m));
    const [cols] = await query<{ n: number }>(
      `select count(*)::int as n from source_column c join source_table t on t.id = c.source_table_id join source_system s on s.id = t.source_system_id
        where s.name = $1 and c.deleted_at is null`,
      [system],
    );
    report(
      "s30-05",
      [
        {
          columns: cols!.n,
          textBytes: Buffer.byteLength(text),
          loadedMs,
          reviewMs,
          importMs: Math.round(closed - t0),
          requestAfterClickMs: requestAt - clickAt,
          responseAfterClickMs: responseAt - clickAt,
          annaAloneMs,
          annaSaves: annaSaves.length,
          annaLongestMs: longest.ms,
          annaLongestSentAfterClickMs: longest.sentAfterClickMs,
          annaFailed: annaSaves.filter((s) => s.state !== "saved").length,
          status: st.status,
          serverTiming: st.timing,
        },
      ],
      annaSaves,
    );
  } finally {
    // Anna's renames and the import undone, each in its own page
    await undoBackTo(anna, t.workspaceId, annaRow!.id, annaTop);
    await undoBackTo(page, t.workspaceId, lukasz, lukaszTop);
  }
  const [left] = await query<{ n: number }>("select count(*)::int as n from source_system where name = $1 and deleted_at is null", [system]);
  expect(left!.n).toBe(0);
});

function report(name: string, table: unknown[], raw: unknown) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), JSON.stringify({ own: OWN_MODE, table, raw }, null, 2));
  console.log(`${name}${OWN_MODE ? " (the workspace given)" : ""}:`);
  console.table(table);
}
