// S4B1-09 (slice 4b-1, PRD item 16; section 6): coverage colours to the screen, measurement build only (MEASURE=1
// MEASURE_BUILD=production; `npm run measure:canvas -- --to-screen --only colours`). On “Performance test”, REQ-102 (46
// attributes of ent:3, ent:4, ent:7 and ent:19; its colours: the rows at 100 %, the summary dots below 40 % and on the
// collapsed frames' blocks) selected from the Requirements tab and cleared with Escape, SETTLED_PAIRS times from a
// settled screen, at 100 % and 30 % around ent:23, frames expanded and collapsed. Each switch is timed in the page (to the first setTimeout after the next rAF)
// and to the screen (the first GPU present after its commit is activated; e2e/measure). Results in
// test-results/S4B1-09.json; raw traces in TRACE_DIR (.data/measure/, git-ignored). Bar: ≤ 100 ms, median (p95 and max
// reported).

import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { saveResults, LARGE_URL, MEASURE, MEASURE_USE } from "../slice-01b/measure";
import { tracedSwitches, type InPage } from "../measure/switches";
import { PAUSE_MS, SETTLED_PAIRS } from "../measure/trace";
import { expect, test, type Page } from "./fixtures";
import { signInAs } from "./helpers";

test.use(MEASURE_USE);

async function open(page: Page, view: { x: number; y: number; zoom: number }, collapsed: boolean) {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
  await page.goto(collapsed ? `${LARGE_URL}?diag=collapsed` : LARGE_URL);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  if ((await page.getByTestId("tab-requirements").getAttribute("aria-selected")) !== "true") await page.getByTestId("tab-requirements").click();
  await expect(page.locator('[data-testid="tree-req"][data-key="REQ-102"]')).toBeVisible();
  await page.waitForTimeout(MEASURE ? 1500 : 300);
}

/** REQ-102 selected from its row (on), then cleared with Escape (off), `n` times, each from a settled screen. */
const coloursLoop = (page: Page, n: number, pause = PAUSE_MS) =>
  page.evaluate(
    async ([n, pause]) => {
      const row = document.querySelector<HTMLElement>('[data-testid="tree-req"][data-key="REQ-102"]')!;
      const shown = () => !!document.querySelector('[data-testid="layer-coverage-rows"], [data-testid="layer-coverage-headers"]');
      const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      const out: { dir: string; k: number; ms: number }[] = [];
      for (let k = 0; k < n; k++) {
        for (const dir of ["on", "off"] as const) {
          const t0 = performance.now();
          if (dir === "on") row.click();
          else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          const done = () => (dir === "on" ? shown() : !shown());
          while (!done() && performance.now() - t0 < 3000) await new Promise((res) => setTimeout(res, 0));
          if (!done()) return { error: `colours ${dir} ${k}: not shown` };
          await nextFrame();
          const t1 = performance.now();
          performance.measure(`sw:${dir}:${k}`, { start: t0, end: t1 });
          out.push({ dir, k, ms: +(t1 - t0).toFixed(1) });
          await new Promise((res) => setTimeout(res, pause));
        }
      }
      return out;
    },
    [n, pause] as const,
  ) as Promise<InPage>;

test("S4B1-09: coverage colours to the screen on “Performance test” (REQ-102) at 100 % and 30 %, frames expanded and collapsed", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(20 * 60_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  const card = generate().cards.find((c) => c.id === "ent:23")!;
  await open(page, { x: 0, y: 0, zoom: 1 }, false);
  const pane = await page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  const around = (zoom: number) => ({ x: pane.w / 2 - (card.x + card.w / 2) * zoom, y: pane.h / 2 - (card.y + 200) * zoom, zoom });
  const views: Record<string, { view: { x: number; y: number; zoom: number }; collapsed: boolean }> = {
    "100 %, expanded": { view: around(1), collapsed: false },
    "30 %, expanded": { view: around(0.3), collapsed: false },
    "100 %, collapsed": { view: around(1), collapsed: true },
    "30 %, collapsed": { view: around(0.3), collapsed: true },
  };
  const results: Record<string, unknown> = {};
  for (const [name, v] of Object.entries(views)) {
    await open(page, v.view, v.collapsed);
    if (v.collapsed) {
      // every frame collapsed: REQ-102's cards are in blocks, and the blocks' rows carry their summary dots (Łukasz's
      // answer to step 6); checked once before timing
      await page.locator('[data-testid="tree-req"][data-key="REQ-102"]').click();
      await expect(page.locator('[data-testid^="coverage-block-dot-"]').first()).toBeAttached();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(PAUSE_MS);
    }
    const traced = await tracedSwitches(page, `S4B1-09 ${name}`, () => coloursLoop(page, SETTLED_PAIRS));
    expect(traced, name).not.toHaveProperty("error");
    results[name] = traced;
  }
  saveResults("S4B1-09", { measured: MEASURE, browser: browser.version(), pane, views: results });
});
