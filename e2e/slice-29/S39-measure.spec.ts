// Slice 39, step 7b: InfoCatalog's timing on Postgres (AD-37), with the demo accounts only (never Łukasz's own model or
// account). Runs only with MEASURE=1, against `npm run dev:pg` started with INFOMAPPER_TIMING=1:
//   MEASURE=1 PG_BASE_URL=http://localhost:3000 npx playwright test --config playwright.pg.config.ts S39-measure
// As the demo's Łukasz: the landing zone, the first search page, a search as typed ("customer", "a", "customer number"),
// an item opened in the drawer, Open in InfoMapper; as Anna: the searches and the drawer. Each WARMUP times discarded,
// then TRIES counted. A page gives its load until drawn and its timing record (`im-timing`); a search or the drawer the
// browser's time from the action (the last keystroke, the click) until the answer is shown, and its server action's
// request time (the action's own timing record is a log line of the server, `timing {"route":"catalog-…"}`). Writes
// nothing to the data and changes no switch: it reads, and the canvas stores its view in the browser only. Numbers go to
// MEASURE_OUT (default .data/measure/s39/) and are printed as a table.
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page, type Response } from "@playwright/test";
import { fillSignIn, PEOPLE, query } from "./helpers";

const MEASURE = !!process.env.MEASURE;
const TRIES = Number(process.env.TRIES ?? 7);
const WARMUP = Number(process.env.WARMUP ?? 2);
const OUT = process.env.MEASURE_OUT ?? ".data/measure/s39";
const SEARCHES = ["customer", "a", "customer number"] as const;

test.skip(!MEASURE, "MEASURE=1 only");
test.setTimeout(20 * 60_000);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN;
};

type Row = { label: string; shownMs: number[]; requestMs: number[]; server: Record<string, number>[] };
const rows: Row[] = [];
const row = (label: string): Row => {
  const found = rows.find((r) => r.label === label);
  if (found) return found;
  const r = { label, shownMs: [], requestMs: [], server: [] };
  rows.push(r);
  return r;
};

async function tries(label: string, once: (r: Row | null) => Promise<void>) {
  for (let i = 0; i < WARMUP + TRIES; i++) await once(i < WARMUP ? null : row(label));
}

const requestMs = (res: Response) => {
  const t = res.request().timing();
  return Math.round(t.responseEnd > 0 ? t.responseEnd - t.requestStart : t.responseStart - t.requestStart);
};
const actionAnswer = (page: Page) =>
  page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"] && new URL(r.url()).pathname === "/catalog", { timeout: 60_000 });

async function pageLoad(page: Page, url: string, ready: () => Promise<void>, r: Row | null) {
  const start = Date.now();
  await page.goto(url, { waitUntil: "commit" });
  await ready();
  const shown = Date.now() - start;
  const json = await page.locator('script[data-testid="im-timing"]').first().textContent({ timeout: 1_000 }).catch(() => null);
  if (!r) return;
  r.shownMs.push(shown);
  if (json) r.server.push(JSON.parse(json) as Record<string, number>);
}

/** A search as typed: the field cleared, the words typed at once; until the rows (or "Nothing found") of these words show. */
async function typed(page: Page, words: string, r: Row | null) {
  const field = page.getByTestId("input-catalog-search");
  await field.fill("");
  await expect(page.getByTestId("page-catalog")).toHaveAttribute("data-query", "");
  const answer = actionAnswer(page);
  const start = Date.now();
  await field.fill(words);
  await expect(page.getByTestId("page-catalog")).toHaveAttribute("data-query", words, { timeout: 60_000 });
  await expect(page.getByTestId("row-catalog-result").first().or(page.getByTestId("box-catalog-nothing"))).toBeVisible();
  const shown = Date.now() - start;
  const res = await answer;
  if (r) {
    r.shownMs.push(shown);
    r.requestMs.push(requestMs(res));
  }
}

/** The drawer: a click on the result row, until the drawer shows its item's answer. */
async function drawer(page: Page, ref: string, r: Row | null) {
  const rowEl = page.locator(`[data-testid="row-catalog-result"][data-ref="${ref}"]`);
  if (await page.getByTestId("drawer-catalog").count()) await page.getByTestId("button-drawer-close").click();
  await expect(page.getByTestId("drawer-catalog")).toHaveCount(0);
  const answer = actionAnswer(page);
  const start = Date.now();
  await rowEl.click();
  await expect(page.getByTestId("details-catalog-item")).toHaveAttribute("data-item", ref, { timeout: 60_000 });
  await expect(page.getByTestId("details-catalog-item")).not.toHaveAttribute("aria-busy", "true");
  const shown = Date.now() - start;
  const res = await answer;
  if (r) {
    r.shownMs.push(shown);
    r.requestMs.push(requestMs(res));
  }
}

async function measureAs(page: Page, who: "lukasz" | "anna", org: string, ref: string) {
  await fillSignIn(page, PEOPLE[who]);
  await expect(page.getByTestId("page-landing")).toBeVisible({ timeout: 60_000 });
  const name = who === "lukasz" ? "Łukasz" : "Anna";
  if (who === "lukasz") {
    await tries(`${name}: the landing zone`, (r) => pageLoad(page, "/", () => expect(page.getByTestId("tile-infocatalog-count")).toBeVisible(), r));
    await tries(`${name}: the first search page`, (r) => pageLoad(page, `/catalog?org=${org}`, () => expect(page.getByTestId("box-catalog-empty")).toBeVisible(), r));
  } else {
    await page.goto(`/catalog?org=${org}`);
    await expect(page.getByTestId("box-catalog-empty")).toBeVisible();
  }
  for (const words of SEARCHES) await tries(`${name}: search "${words}" as typed`, (r) => typed(page, words, r));
  await typed(page, "customer", null);
  await tries(`${name}: an item in the drawer`, (r) => drawer(page, ref, r));
  if (who === "lukasz") {
    await tries(`${name}: Open in InfoMapper`, async (r) => {
      await page.goto(`/catalog?org=${org}&q=customer&item=${encodeURIComponent(ref)}`);
      await expect(page.getByTestId("details-catalog-item")).toHaveAttribute("data-item", ref);
      const start = Date.now();
      await page.getByTestId("button-open-in-infomapper").click();
      await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId("panel-inspector").getByTestId("panel-entity")).toBeVisible({ timeout: 60_000 });
      const shown = Date.now() - start;
      const json = await page.locator('script[data-testid="im-timing"]').first().textContent({ timeout: 1_000 }).catch(() => null);
      if (r) {
        r.shownMs.push(shown);
        if (json) r.server.push(JSON.parse(json) as Record<string, number>);
      }
    });
  }
}

test("S39 step 7b: InfoCatalog's timing on Postgres, the demo accounts", async ({ browser }) => {
  const [org] = await query<{ id: string }>("select id from organization where name = 'InfoMate' and deleted_at is null");
  const [entity] = await query<{ id: string; workspace_id: string }>(
    `select e.id, e.workspace_id from entity e join workspace w on w.id = e.workspace_id and w.deleted_at is null
      where w.name = 'Retail Co – DWH' and e.name = 'Customer' and e.model_level = 'logical' and e.deleted_at is null`,
  );
  expect(org && entity, "the demo's InfoMate and its Customer").toBeTruthy();
  const ref = `entity:${entity!.workspace_id}:${entity!.id}`;
  for (const who of ["lukasz", "anna"] as const) {
    const context = await browser.newContext();
    await measureAs(await context.newPage(), who, org!.id, ref);
    await context.close();
  }

  const lines = rows.map((r) => {
    const server = r.server.length ? `${median(r.server.map((s) => s.readMs ?? 0)).toFixed(0)} ms read, ${median(r.server.map((s) => s.statements ?? 0))} statements` : "";
    return `| ${r.label} | ${median(r.shownMs).toFixed(0)} ms (${Math.min(...r.shownMs)}–${Math.max(...r.shownMs)}) | ${r.requestMs.length ? `${median(r.requestMs).toFixed(0)} ms` : ""} | ${server} |`;
  });
  const table = ["| What | Shown, median (fastest–slowest) | The action's request | The page's timing record |", "| --- | --- | --- | --- |", ...lines].join("\n");
  console.log(`\n${TRIES} tries each after ${WARMUP} discarded\n${table}\n`);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `s39-timing-${Date.now()}.json`), JSON.stringify({ tries: TRIES, warmup: WARMUP, rows }, null, 2));
});
