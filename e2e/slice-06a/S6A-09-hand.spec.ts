// S6A-09's follow-up (slice 6a, before step 4): why a chip appearing costs more in the dense view (Hand on: +7.2 ms at
// 30 %, +14.7 ms at 100 % dense). Measurement build only, on demand, like S6A-09. Each case traces SWITCHES single
// “Hand on” switches (from a settled screen, the tool off again untraced) and sums the main thread's phases in the
// 300 ms after the click: script, style (UpdateLayoutTree, with its element count), layout (with its dirty and total
// objects), pre-paint, paint, layerize and commit. Cases: 30 % around ent:23 and 100 % dense, each with the bar and with
// `?diag=noviewbar`. Results in test-results/S6A-09-hand.json; raw traces in .data/measure/ (git-ignored).

import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import type { TraceEvent } from "../../scripts/lib/to-screen";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { LARGE_URL, MEASURE, MEASURE_USE, saveResults } from "../slice-01b/measure";
import { PAUSE_MS, saveTrace, startTraceWith } from "../measure/trace";
import { expect, test, type Page } from "./fixtures";
import { signInAs } from "./helpers";

test.use(MEASURE_USE);

const SWITCHES = Number(process.env.SWITCHES ?? 7);
const CATEGORIES = ["devtools.timeline", "disabled-by-default-devtools.timeline", "blink.user_timing", "v8.execute"];
const PHASES: Record<string, string> = {
  FunctionCall: "script",
  EventDispatch: "script",
  TimerFire: "script",
  FireAnimationFrame: "script",
  RunMicrotasks: "script",
  UpdateLayoutTree: "style",
  Layout: "layout",
  PrePaint: "prePaint",
  Paint: "paint",
  Layerize: "layerize",
  Commit: "commit",
};

type View = { x: number; y: number; zoom: number };

async function open(page: Page, view: View, diag = "") {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
  await page.goto(diag ? `${LARGE_URL}?diag=${diag}` : LARGE_URL);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.mouse.move(2, 400);
  await page.waitForTimeout(1500);
}

/** The main thread's phases in the 300 ms after the `hand-on` mark: time per phase and what style and layout touched. */
function phasesOf(events: readonly TraceEvent[]) {
  const mark = events.find((e) => e.name === "hand-on" && (e.ph === "R" || e.ph === "I" || e.ph === "i" || e.ph === "b" || e.ph === "n"));
  if (!mark) return null;
  const from = mark.ts, to = mark.ts + 300_000;
  const main = events.filter((e) => e.pid === mark.pid && e.tid === mark.tid && e.ph === "X" && e.ts >= from && e.ts <= to);
  const ms: Record<string, number> = {};
  let styleElements = 0, layoutDirty = 0, layoutTotal = 0, paints = 0;
  // only the outermost event of each phase counts (a nested FunctionCall inside EventDispatch is not added twice)
  const open: { end: number; phase: string }[] = [];
  for (const e of [...main].sort((a, b) => a.ts - b.ts)) {
    const phase = PHASES[e.name];
    if (!phase) continue;
    while (open.length && open[open.length - 1]!.end <= e.ts) open.pop();
    const inside = open.some((o) => o.phase === phase);
    open.push({ end: e.ts + (e.dur ?? 0), phase });
    if (inside) continue;
    ms[phase] = (ms[phase] ?? 0) + (e.dur ?? 0) / 1000;
    const args = (e.args ?? {}) as { elementCount?: number; beginData?: { dirtyObjects?: number; totalObjects?: number } };
    if (e.name === "UpdateLayoutTree") styleElements += args.elementCount ?? 0;
    if (e.name === "Layout") {
      layoutDirty += args.beginData?.dirtyObjects ?? 0;
      layoutTotal += args.beginData?.totalObjects ?? 0;
    }
    if (e.name === "Paint") paints++;
  }
  for (const k of Object.keys(ms)) ms[k] = +ms[k]!.toFixed(2);
  return { ms, styleElements, layoutDirty, layoutTotal, paints };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? +s[Math.floor(s.length / 2)]!.toFixed(2) : 0;
};

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
      const runs: NonNullable<ReturnType<typeof phasesOf>>[] = [];
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
        const p = phasesOf(events);
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
