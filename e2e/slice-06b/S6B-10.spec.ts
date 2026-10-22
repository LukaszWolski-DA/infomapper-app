// S6B-10 (slice 6b, PRD section 6; Łukasz's step 1 answer 6): the diagnosis, by phase traces (e2e/measure/phases.ts),
// measurement build only, on demand (MEASURE=1 MEASURE_BUILD=production, after `npm run measure:build`; no laptop
// preparation, the figures are diagnostic). On “Performance test”, ROUNDS traced switches each:
// - Back to a selection on the same canvas against clicking the same item, at 30 % around ent:23 and in the dense view
//   at 100 % (bar: no more than 2 ms more script; the commits are S6B-03's, development counters);
// - Back to a selection off screen (centred) against the left panel's click on it (select and centre), at 30 %;
// - a button's state change (an entry pushed without a URL): no forced style or layout;
// - the background refresh after Back to the canvas from another page: what it costs (the main thread in the 3 s after
//   Back, the refresh request's time) and that it moves neither the view nor the selection.
// Results in test-results/S6B-10.json; raw traces in .data/measure/ (git-ignored).

import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { LARGE_URL, MEASURE, MEASURE_USE, saveResults } from "../slice-01b/measure";
import { PHASE_CATEGORIES, medianPhases, phasesAfter } from "../measure/phases";
import { PAUSE_MS, saveTrace, startTraceWith } from "../measure/trace";
import { expect, test, type Page } from "./fixtures";
import { expectSelected, selected, signInAs, viewportTransform } from "./helpers";

test.use(MEASURE_USE);

const ROUNDS = Number(process.env.ROUNDS ?? 7);
type View = { x: number; y: number; zoom: number };
type Phases = NonNullable<ReturnType<typeof phasesAfter>>;

async function open(page: Page, view: View) {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
  await page.goto(LARGE_URL);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.mouse.move(2, 400);
  await page.waitForTimeout(1500);
}

/** One traced action: a mark, the action, the main thread's phases in `windowMs` after the mark. */
async function traced(page: Page, label: string, act: () => Promise<void>, windowMs = 300, save = false): Promise<Phases> {
  await page.waitForTimeout(PAUSE_MS);
  const trace = await startTraceWith(page, PHASE_CATEGORIES);
  await page.waitForTimeout(PAUSE_MS);
  await page.evaluate(() => performance.mark("act"));
  await act();
  await page.waitForTimeout(windowMs + 200);
  const events = await trace.stop();
  if (save) saveTrace(`S6B-10 ${label}`, events, { kind: "phases" });
  const p = phasesAfter(events, "act", windowMs);
  expect(p, `${label}: the mark in the trace`).not.toBeNull();
  return p!;
}

const summary = (runs: Phases[]) => ({ ...medianPhases(runs), runs });

test("S6B-10: selection places, the buttons and the background refresh, phase by phase, on “Performance test”", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(60 * 60_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  await open(page, { x: 0, y: 0, zoom: 1 });
  const pane = await page.locator(".react-flow__pane").boundingBox();
  const size = { w: pane!.width, h: pane!.height };
  const data = generate();
  const byId = (id: string) => data.cards.find((c) => c.id === id)!;
  const ent23 = byId("ent:23"), src57 = byId("src:57");
  const views: Record<string, View> = {
    "30 % around ent:23": { x: size.w / 2 - (ent23.x + ent23.w / 2) * 0.3, y: size.h / 2 - (ent23.y + 200) * 0.3, zoom: 0.3 },
    "100 % dense": { x: 768 - src57.x, y: 300 - src57.y, zoom: 1 },
  };
  /** The two cards nearest the view's middle, and where their headers are on the screen. */
  const twoCards = (view: View) => {
    const mid = { x: (size.w / 2 - view.x) / view.zoom, y: (size.h / 2 - view.y) / view.zoom };
    const near = [...data.cards].sort((a, b) => Math.hypot(a.x + a.w / 2 - mid.x, a.y - mid.y) - Math.hypot(b.x + b.w / 2 - mid.x, b.y - mid.y));
    return near.slice(0, 2).map((c) => ({ card: c, at: { x: pane!.x + view.x + (c.x + 12) * view.zoom, y: pane!.y + view.y + (c.y + 10) * view.zoom } }));
  };
  const back = () => page.evaluate(() => document.querySelector<HTMLElement>("[data-testid='button-back']")!.click());
  const results: Record<string, Record<string, unknown>> = {};

  for (const [name, view] of Object.entries(views)) {
    const r: Record<string, unknown> = (results[name] = {});
    await open(page, view);
    const [x, y] = twoCards(view);
    const click = async (c: typeof x) => page.mouse.click(c!.at.x, c!.at.y);
    // Back to X against a click on X, both from Y selected
    const byClick: Phases[] = [], byBack: Phases[] = [];
    for (let k = 0; k < ROUNDS; k++) {
      await click(y);
      byClick.push(await traced(page, `${name} click`, () => click(x), 300, k === 0));
      await click(y);
      byBack.push(await traced(page, `${name} back`, back, 300, k === 0));
    }
    r.cards = [x!.card.id, y!.card.id];
    r["click on X"] = summary(byClick);
    r["Back to X"] = summary(byBack);
  }

  // Back to a selection off screen, against the left panel's click on it (select and centre), at 30 % around ent:23
  {
    const name = "30 % around ent:23";
    const r = results[name]!;
    const view = views[name]!;
    await open(page, view);
    const [x, y] = twoCards(view);
    const far = async () => {
      await page.mouse.move(pane!.x + size.w / 2, pane!.y + size.h / 2);
      await page.mouse.wheel(6000, 4000);
      await page.waitForTimeout(400);
    };
    const tree = page.getByTestId("tree-item").filter({ has: page.getByText(x!.card.name, { exact: true }) }).first();
    const byBack: Phases[] = [], byTree: Phases[] = [];
    for (let k = 0; k < ROUNDS; k++) {
      await open(page, view);
      await page.mouse.click(x!.at.x, x!.at.y);
      await page.mouse.click(y!.at.x, y!.at.y);
      await far();
      byBack.push(await traced(page, "off screen back", back, 500, k === 0));
      await far();
      await page.mouse.click(5, 5); // nothing focused
      byTree.push(await traced(page, "off screen tree", () => tree.click(), 500, k === 0));
    }
    r["off screen: Back to X (centred)"] = summary(byBack);
    r["off screen: the left panel's click on X (select and centre)"] = summary(byTree);
  }

  // a button's state change: an entry pushed without a URL enables Back
  {
    await open(page, views["100 % dense"]!);
    const runs: Phases[] = [];
    for (let k = 0; k < ROUNDS; k++) runs.push(await traced(page, "button state", () => page.evaluate(() => window.history.pushState(null, "")), 300, k === 0));
    results["100 % dense"]!["a button's state change"] = summary(runs);
  }

  // the background refresh after Back to the canvas from the project home, in the dense view
  {
    const view = views["100 % dense"]!;
    const runs: Phases[] = [];
    const refresh: { ms: number | null; viewKept: boolean; selectionKept: boolean }[] = [];
    for (let k = 0; k < Math.min(ROUNDS, 5); k++) {
      await open(page, view);
      const [x] = twoCards(view);
      await page.mouse.click(x!.at.x, x!.at.y);
      const chosen = await selected(page);
      await page.getByTestId("breadcrumb").nth(2).click();
      await expect(page.getByTestId("area-canvas")).toHaveCount(0);
      await page.waitForTimeout(800);
      let before: { x: number; y: number; zoom: number } | null = null;
      runs.push(
        await traced(
          page,
          "back to the canvas, with the refresh",
          async () => {
            await back();
            await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
            await expectSelected(page, chosen);
            before = await viewportTransform(page);
          },
          3000,
          k === 0,
        ),
      );
      const timing = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .filter((e) => e.name.includes("_rsc="))
          .map((e) => Math.round(e.duration))
          .pop() ?? null,
      );
      const after = await viewportTransform(page);
      refresh.push({ ms: timing, viewKept: JSON.stringify(after) === JSON.stringify(before), selectionKept: (await selected(page)) === chosen });
    }
    results["100 % dense"]!["Back from the project home, with the background refresh (3 s)"] = { ...summary(runs), refresh };
  }

  saveResults("S6B-10", { measured: MEASURE, browser: browser.version(), pane: size, results });
});
