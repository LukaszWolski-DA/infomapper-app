// S30-05 and S30-13 (slice 30): the writes measured on Postgres, in the style of S29-08. Prepared in step 4, run on
// dev's preview after the merge (L4 (b)); runs only with MEASURE=1 (playwright.pg.config.ts):
//   MEASURE=1 PG_BASE_URL=<dev's preview> npx playwright test --config playwright.pg.config.ts S30-measure
// The preview needs INFOMAPPER_TIMING=1 (its Preview variable, slice 29). It writes into the demo's "Retail Co – DWH":
// renames of Product (put back at the end), cards moved and back, attributes added and undone, one import into a new
// system "Synth {time}" (left there; Undo it, or a `pg:seed -- --reset` on Łukasz's OK, removes it). Never KB.
//
// - S30-13: per write kind (a rename in the entity panel, an attribute added there, a card moved on the canvas, Undo in
//   the top bar), WARMUP discarded and LOADS counted writes, each from the action to the top bar's indicator showing
//   "Saved" (the write's answer in the browser: for a model write it carries the fresh page). With each, the refreshed
//   page's own timing record (`im-timing`: the refresh's calls and statements). The write's own split (its statements,
//   the lock's wait, the transaction) is one log line per write on the server (`timing {"route":"write",…}`,
//   `{"route":"undo",…}`), read in Vercel's runtime logs.
// - S30-05: a 10,000-column file (`syntheticStandard`, 1,000 tables) through the wizard: the file read and the review
//   shown (the browser's plan), the upload and write (the click on "Import into" to its toast) with the route's
//   `Server-Timing` (inflate, statements, lock, apply, total); meanwhile a second session (Anna) renames an entity in the
//   same workspace, from the click on Import on: how long her save waits.
// Results go to MEASURE_OUT (default .data/measure/s30/) as JSON and are printed as a table. Nothing secret is printed.
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { syntheticStandard } from "../../scripts/lib/import-synthetic";
import { demoPassword, firstCanvas, PEOPLE, query, workspaceId } from "./helpers";

const MEASURE = !!process.env.MEASURE;
const LOADS = Number(process.env.LOADS ?? 10);
const WARMUP = Number(process.env.WARMUP ?? 2);
const OUT = process.env.MEASURE_OUT ?? path.join(".data", "measure", "s30");
const WS = "Retail Co – DWH";

test.skip(!MEASURE, "MEASURE=1 only");
test.setTimeout(30 * 60_000);

async function signInAs(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByTestId("input-sign-in-email").fill(email);
  await page.getByTestId("input-sign-in-password").fill(demoPassword());
  await page.getByTestId("button-sign-in").click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

async function openCanvasPage(page: Page) {
  const { projectId, canvasId } = await firstCanvas(WS);
  await page.goto(`/w/${await workspaceId(WS)}/p/${projectId}/c/${canvasId}`);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
}

const indicator = (page: Page) => page.getByTestId("indicator-save");
const pageTiming = async (page: Page) => {
  const t = page.getByTestId("im-timing");
  return (await t.count()) ? (JSON.parse((await t.textContent()) ?? "{}") as Record<string, number>) : null;
};

/** One write: `act`, then until the indicator says Saved; the time and the refreshed page's record. */
async function oneWrite(page: Page, act: () => Promise<void>) {
  await expect(indicator(page)).not.toHaveAttribute("data-state", "saving");
  const start = Date.now();
  await act();
  await expect(indicator(page)).toHaveAttribute("data-state", /saved|fading|idle/, { timeout: 60_000 });
  await expect(indicator(page)).not.toHaveAttribute("data-state", "failed");
  const ms = Date.now() - start;
  return { ms, page: await pageTiming(page) };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN;
};

async function series(name: string, page: Page, act: (i: number) => Promise<void>) {
  const samples: { ms: number; page: Record<string, number> | null }[] = [];
  for (let i = 0; i < WARMUP + LOADS; i++) {
    const s = await oneWrite(page, () => act(i));
    if (i >= WARMUP) samples.push(s);
  }
  const statements = samples.map((s) => s.page?.statements).filter((x): x is number => typeof x === "number");
  return { name, medianMs: median(samples.map((s) => s.ms)), refreshStatements: statements.length ? median(statements) : null, samples };
}

const tree = (page: Page, name: string) => page.getByTestId("tree-item").filter({ has: page.getByText(name, { exact: true }) });

test("S30-13: warm medians of a rename, an added attribute, a moved card and Undo", async ({ page }) => {
  await signInAs(page, PEOPLE.lukasz);
  await openCanvasPage(page);
  await page.getByTestId("tab-model").click();
  const results = [];

  // a rename in the entity panel, Product to Product (m1), (m2), …, then back
  let current = "Product";
  await tree(page, current).click();
  const name = page.getByTestId("panel-entity").getByTestId("input-entity-name");
  results.push(
    await series("rename", page, async (i) => {
      current = `Product (m${i})`;
      await name.fill(current);
      await name.press("Enter");
    }),
  );

  // a card moved by 40 px and back, by its header
  const card = page.locator(".react-flow__node").first();
  results.push(
    await series("move a card", page, async (i) => {
      const box = (await card.boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + 12;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + (i % 2 ? -40 : 40), y, { steps: 8 });
      await page.mouse.up();
    }),
  );

  // an attribute added in the entity panel
  results.push(
    await series("add an attribute", page, async () => {
      await tree(page, current).click();
      await page.getByTestId("panel-entity").getByTestId("button-add-attribute").click();
    }),
  );

  // Undo in the top bar: the attributes just added go again
  results.push(await series("undo", page, () => page.getByTestId("button-undo").click()));

  // Product's name back
  await tree(page, current).click();
  await name.fill("Product");
  await name.press("Enter");
  await expect(indicator(page)).toHaveAttribute("data-state", /saved|fading|idle/);

  report("s30-13", results.map(({ samples, ...r }) => ({ ...r, samples: samples.length })), results);
});

test("S30-05: a 10,000-column import, and another session's save meanwhile", async ({ page, browser }) => {
  const text = syntheticStandard(1000);
  const system = `Synth ${Date.now()}`;
  await signInAs(page, PEOPLE.lukasz);
  await openCanvasPage(page);
  await page.getByTestId("tab-sources").click();
  await page.getByTestId("button-import-sources").click();
  await expect(page.getByTestId("dialog-import")).toBeVisible();
  await page.getByText("A new system", { exact: true }).click();
  await page.getByTestId("input-new-system-name").fill(system);
  const reading = Date.now();
  await page.getByTestId("input-import-file").setInputFiles({ name: "synth.csv", mimeType: "text/plain", buffer: Buffer.from(text, "utf8") });
  await expect(page.getByTestId("import-loaded")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("button-wizard-next").click();
  await page.getByTestId("button-wizard-next").click();
  await expect(page.getByTestId("wizard-step-3")).toHaveAttribute("aria-current", "step", { timeout: 120_000 });
  const reviewMs = Date.now() - reading;

  // the second session, ready on the same workspace
  const anna = await (await browser.newContext()).newPage();
  await signInAs(anna, PEOPLE.anna);
  await openCanvasPage(anna);
  await anna.getByTestId("tab-model").click();
  await tree(anna, "Customer").click();
  const annaName = anna.getByTestId("panel-entity").getByTestId("input-entity-name");

  const serverTiming = page.waitForResponse((r) => r.url().endsWith("/import") && r.request().method() === "POST", { timeout: 300_000 }).then((r) => r.headers()["server-timing"] ?? null);
  const importStart = Date.now();
  await page.getByTestId("button-wizard-import").click();
  // Anna's rename, sent while the import is on its way
  const annaStart = Date.now();
  await annaName.fill("Customer (meanwhile)");
  await annaName.press("Enter");
  const annaDone = expect(indicator(anna)).toHaveAttribute("data-state", /saved|fading|idle|failed/, { timeout: 300_000 }).then(() => Date.now() - annaStart);
  await expect(page.getByTestId("dialog-import")).toHaveCount(0, { timeout: 300_000 });
  const importMs = Date.now() - importStart;
  const annaMs = await annaDone;
  const annaState = await indicator(anna).getAttribute("data-state");

  // Customer's name back
  await annaName.fill("Customer");
  await annaName.press("Enter");
  await expect(indicator(anna)).toHaveAttribute("data-state", /saved|fading|idle/);

  const columns = (await query<{ n: number }>(
    `select count(*)::int as n from source_column c join source_table t on t.id = c.source_table_id join source_system s on s.id = t.source_system_id
      where s.name = $1 and c.deleted_at is null`,
    [system],
  ))[0]!.n;
  report("s30-05", [{ columns, textBytes: Buffer.byteLength(text), reviewMs, importMs, serverTiming: await serverTiming, annaMs, annaState }], null);
});

function report(name: string, table: unknown[], raw: unknown) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), JSON.stringify({ table, raw }, null, 2));
  console.log(`${name}:`);
  console.table(table);
}
