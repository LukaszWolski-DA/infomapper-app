// S7B-16 (slice 7b, PRD section 6 as planned in step 1): the Changes view to the screen on “Performance test” with an
// import with changes (`seed:large -- --changes`: 16 changes on 9 of 60 tables), measurement build only (MEASURE=1
// MEASURE_BUILD=production; the normal e2e run leaves this file out). At 100 % and 30 % around ent:23, frames expanded,
// in one sitting: the toolbar button on and off, the select switched between all open changes and the import, and Focus
// on ent:23's card switched by its button, the comparison. Each switch from a settled screen, timed in the page and to
// the screen (slice 4b-1's method, e2e/measure). Results in test-results/S7B-16.json; raw traces in .data/measure/.
// Bars: ≤ 100 ms to the screen (median), and within 10 % of Focus switching on the same view.

import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { addLargeChanges, LARGE_CHANGES_LABEL } from "../../src/data/local/seed-large-changes";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { createLocalDataStore } from "../../src/data/local/store";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { LARGE_URL, MEASURE, MEASURE_USE, saveResults } from "../slice-01b/measure";
import { tracedSwitches, type InPage } from "../measure/switches";
import { PAUSE_MS, SETTLED_PAIRS } from "../measure/trace";
import { expect, test, type Page } from "./fixtures";
import { signInAs } from "./helpers";

test.use(MEASURE_USE);

async function open(page: Page, view: { x: number; y: number; zoom: number }) {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
  await page.goto(LARGE_URL);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.waitForTimeout(MEASURE ? 1500 : 300);
}

/**
 * Clicks `on` and then `off` (CSS selectors of buttons, or `select:<value>` to pick an option of the Changes view's
 * select), `n` times, each from a settled screen; a switch is done when the fade layer's key starts with `onKey`, and
 * with `offKey` (or no fade layer when null).
 */
const clickLoop = (page: Page, on: string, off: string, onKey: string, offKey: string | null, n: number, pause = PAUSE_MS) =>
  page.evaluate(
    async ([on, off, onKey, offKey, n, pause]) => {
      const key = () => document.querySelector<HTMLElement>('[data-testid="layer-fade"]')?.dataset.fade ?? null;
      const act = (what: string) => {
        if (what.startsWith("select:")) {
          const sel = document.querySelector<HTMLSelectElement>('[data-testid="select-changes"]')!;
          Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(sel, what.slice(7));
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        } else document.querySelector<HTMLElement>(what)!.click();
      };
      const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      const out: { dir: string; k: number; ms: number }[] = [];
      for (let k = 0; k < n; k++) {
        for (const dir of ["on", "off"] as const) {
          const t0 = performance.now();
          act(dir === "on" ? on : off);
          const done = () => (dir === "on" ? !!key()?.startsWith(onKey) : offKey === null ? key() === null : !!key()?.startsWith(offKey));
          while (!done() && performance.now() - t0 < 3000) await new Promise((res) => setTimeout(res, 0));
          if (!done()) return { error: `${dir} ${k}: not shown (${key()})` };
          await nextFrame();
          const t1 = performance.now();
          performance.measure(`sw:${dir}:${k}`, { start: t0, end: t1 });
          out.push({ dir, k, ms: +(t1 - t0).toFixed(1) });
          await new Promise((res) => setTimeout(res, pause));
        }
      }
      return out;
    },
    [on, off, onKey, offKey, n, pause] as const,
  ) as Promise<InPage>;

test("S7B-16: the Changes view and Focus to the screen on “Performance test” at 100 % and 30 %", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(30 * 60_000);
  await seedLargeData(E2E_DB);
  await addLargeChanges(E2E_DB);
  const imports = await createLocalDataStore(E2E_DB).model.listImports(LARGE_IDS.workspace);
  // the system with the most of the canvas: its import's changes are a part of all open ones
  const importId = imports.find((i) => i.source_label === LARGE_CHANGES_LABEL)!.id;
  await signInAs(page, "Łukasz");
  const card = generate().cards.find((c) => c.id === "ent:23")!;
  await open(page, { x: 0, y: 0, zoom: 1 });
  const pane = await page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  const around = (zoom: number) => ({ x: pane.w / 2 - (card.x + card.w / 2) * zoom, y: pane.h / 2 - (card.y + 200) * zoom, zoom });
  const results: Record<string, unknown> = {};
  for (const [name, view] of Object.entries({ "100 %": around(1), "30 %": around(0.3) })) {
    await open(page, view);
    const lit: Record<string, string | null> = {};
    // the toolbar button
    const button = await tracedSwitches(page, `S7B-16 ${name} button`, () => clickLoop(page, '[data-testid="button-changes"]', '[data-testid="button-changes"]', "lit:changes:open:", null, SETTLED_PAIRS));
    expect(button, `${name} button`).not.toHaveProperty("error");
    // the select: all open changes and one import
    await page.getByTestId("button-changes").click();
    await expect(page.getByTestId("layer-fade")).toHaveAttribute("data-fade", /^lit:changes:open:/);
    lit.open = await page.getByTestId("layer-fade").getAttribute("data-lit-cards");
    const select = await tracedSwitches(page, `S7B-16 ${name} select`, () => clickLoop(page, `select:${importId}`, "select:open", `lit:changes:${importId}:`, "lit:changes:open:", SETTLED_PAIRS));
    expect(select, `${name} select`).not.toHaveProperty("error");
    await page.getByTestId("button-changes-close").click();
    // Focus on ent:23, the comparison in the same sitting
    await page.locator(".react-flow__node").filter({ has: page.getByTestId("card-name").and(page.locator(`[title="${card.name}"]`)) }).first().getByTestId("card-name").click();
    const focus = await tracedSwitches(page, `S7B-16 ${name} focus`, () => clickLoop(page, '[data-testid="button-focus"]', '[data-testid="button-focus"]', "focus:", null, SETTLED_PAIRS));
    expect(focus, `${name} focus`).not.toHaveProperty("error");
    results[name] = { lit, button, select, focus };
  }
  saveResults("S7B-16", { measured: MEASURE, browser: browser.version(), pane, views: results });
});

// Information only (step 1's plan): the project home's load on “Performance test” with its changes, model consistency
// included; the local adapter reads the whole file on every request, so this is mostly that read.
test("S7B-16: the project home's load with model consistency on “Performance test” (information)", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(5 * 60_000);
  await seedLargeData(E2E_DB);
  await addLargeChanges(E2E_DB);
  await signInAs(page, "Łukasz");
  const url = `/w/${LARGE_IDS.workspace}/p/${LARGE_IDS.project}`;
  await page.goto(url);
  await expect(page.getByTestId("section-consistency")).toBeVisible();
  const times: { response: number; shown: number }[] = [];
  for (let i = 0; i < 7; i++) {
    await page.goto(url);
    await expect(page.getByTestId("section-consistency")).toBeVisible();
    times.push(await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      return { response: +nav.responseEnd.toFixed(1), shown: +nav.domContentLoadedEventEnd.toFixed(1) };
    }));
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const badge = await page.getByTestId("consistency-badge").textContent();
  saveResults("S7B-16-home", { measured: MEASURE, browser: browser.version(), badge, times, median: { response: median(times.map((t) => t.response)), shown: median(times.map((t) => t.shown)) } });
});
