// S6A-09's follow-up (slice 6a, before step 4): why a chip appearing costs more in the dense view (Hand on: +7.2 ms at
// 30 %, +14.7 ms at 100 % dense). Measurement build only, on demand, like S6A-09. Each case traces SWITCHES single
// “Hand on” switches (from a settled screen, the tool off again untraced) and sums the main thread's phases in the
// 300 ms after the click: script, style (UpdateLayoutTree, with its element count), layout (with its dirty and total
// objects), pre-paint, paint, layerize and commit. Cases: 30 % around ent:23 and 100 % dense, each with the bar and with
// `?diag=noviewbar`. Results in test-results/S6A-09-hand.json; raw traces in .data/measure/ (git-ignored).

import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { LARGE_URL, MEASURE, MEASURE_USE, saveResults } from "../slice-01b/measure";
import { PHASE_CATEGORIES as CATEGORIES, median, phasesAfter } from "../measure/phases";
import { PAUSE_MS, saveTrace, startTraceWith } from "../measure/trace";
import { expect, test, type Page } from "./fixtures";
import { signInAs } from "./helpers";

test.use(MEASURE_USE);

const SWITCHES = Number(process.env.SWITCHES ?? 7);
type View = { x: number; y: number; zoom: number };

async function open(page: Page, view: View, diag = "") {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
  await page.goto(diag ? `${LARGE_URL}?diag=${diag}` : LARGE_URL);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.mouse.move(2, 400);
  await page.waitForTimeout(1500);
}

test("S6A-09-hand: what a chip appearing costs, phase by phase, at 30 % and in the dense view", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(30 * 60_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  await open(page, { x: 0, y: 0, zoom: 1 });
  const pane = await page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  const data = generate();
  const ent23 = data.cards.find((c) => c.id === "ent:23")!, src57 = data.cards.find((c) => c.id === "src:57")!;
  const views: Record<string, View> = {
    "30 % around ent:23": { x: pane.w / 2 - (ent23.x + ent23.w / 2) * 0.3, y: pane.h / 2 - (ent23.y + 200) * 0.3, zoom: 0.3 },
    "100 % dense": { x: 768 - src57.x, y: 300 - src57.y, zoom: 1 },
  };
  const results: Record<string, unknown> = {};
  for (const [name, view] of Object.entries(views)) {
    for (const diag of ["", "noviewbar"]) {
      const label = `${name}, ${diag ? "without the bar" : "with the bar"}`;
      await open(page, view, diag);
      const runs: NonNullable<ReturnType<typeof phasesAfter>>[] = [];
      for (let k = 0; k < SWITCHES; k++) {
        await page.waitForTimeout(PAUSE_MS);
        const trace = await startTraceWith(page, CATEGORIES);
        await page.waitForTimeout(PAUSE_MS);
        await page.evaluate(() => {
          performance.mark("hand-on");
          document.querySelector<HTMLElement>('[data-testid="button-tool-hand"]')!.click();
        });
        await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-mode", "hand");
        await page.waitForTimeout(500);
        const events = await trace.stop();
        if (k === 0) saveTrace(`S6A-09-hand ${label}`, events, { kind: "phases" });
        const p = phasesAfter(events, "hand-on");
        expect(p, `${label} ${k}: the mark in the trace`).not.toBeNull();
        runs.push(p!);
        await page.getByTestId("button-tool-hand").click();
        await expect(page.getByTestId("area-canvas")).not.toHaveAttribute("data-mode");
      }
      const phases = [...new Set(runs.flatMap((r) => Object.keys(r.ms)))];
      results[label] = {
        medianMs: Object.fromEntries(phases.map((ph) => [ph, median(runs.map((r) => r.ms[ph] ?? 0))])),
        styleElements: median(runs.map((r) => r.styleElements)),
        layoutDirtyObjects: median(runs.map((r) => r.layoutDirty)),
        layoutTotalObjects: median(runs.map((r) => r.layoutTotal)),
        paints: median(runs.map((r) => r.paints)),
        runs,
      };
    }
  }
  saveResults("S6A-09-hand", { measured: MEASURE, browser: browser.version(), pane, switches: SWITCHES, cases: results });
});
