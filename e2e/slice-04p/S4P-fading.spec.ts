// Slice 4p, items 1–3 (S4P-02, S4P-03, S4P-08): the fading scenarios on “Performance test”, measurement build only
// (MEASURE=1 MEASURE_BUILD=production; `npm run measure:canvas` runs it on both sides of a sitting). Six views: 100 % and
// 30 % around the Focus entity (ent:23, the most relationships) and S1A-14's 100 % dense area around src:57, frames
// expanded and all collapsed (`?diag=collapsed`; under DIAG=collapsed only the collapsed ones).
//
// In every view, pan and zoom with fading off (both sides: S4P-08 against the reference). Then, only where the page has
// the measuring hook and a fading mechanism (this branch from step 2), for each scenario:
//   Focus        ent:23 and what `relatedOf` gives for it
//   Lens, small  REQ-101 of seed:large: six attributes of ent:19, one of them a gap
//   Lens, large  REQ-102 of seed:large: ent:3, ent:4, ent:7 and ent:19, about half the cards of the 30 % view
// (slice 4b-1, step 3: the lens is gone; the "lens" scenarios are Focus on the requirement, `{ focus: { t:
// "requirement", id } }`, under their old names so the sittings stay comparable. On a reference without it, such as
// slice-04p, they are not shown and only fading off is measured there.)
// and in S1A-14's 100 % view around src:57 (the heaviest view, Łukasz after step 0):
//   Lens, dense  REQ-103 of seed:large: the source tables in that view
// 40 switches on and 40 off, each timed until the fading is in the page and until the next frame (C-10's method), and
// pan and zoom with fading on (S4P-03: against fading off in the same run).
//
// The mechanism's side of the contract: while it shows a request it renders `[data-testid="layer-fade"]` with
// `data-fade` = `focus:<entity id>` or `focus:requirement:<id>` (and may add `data-lit-cards`); with fading off there is
// none. Results go to test-results/S4P-fading.json. This file imports only what `slice-04a` has, so the harness can
// copy it into the reference worktree.
//
// The hover line fade (a trial A variant, Łukasz after step 1): where the page has `window.__imHoverFade`, C-10 in
// S1B-10's view (100 % around src:57, frames expanded) with it "off", "plain" (in the big layer) and "layer" (its own
// compositing layer), 40 hovers each, C-10's method.

import { LARGE_IDS } from "../../src/data/local/seed-large";
import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { seedId } from "../../src/data/local/seed-model";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { expect, test, type Page } from "../slice-01a/fixtures";
import { signInAs } from "../slice-01a/helpers";
import { DIAG, LARGE_URL, MEASURE, MEASURE_USE, panZoom, saveResults, startRecording, stopRecording, type FrameStats } from "../slice-01b/measure";
import { fadingLoop, tracedPan, tracedSwitches, type SwitchSummary } from "../measure/switches";
import { SETTLED_PAIRS, TO_SCREEN } from "../measure/trace";

test.use(MEASURE_USE);

const WS = LARGE_IDS.workspace;
const FOCUS_CARD = "ent:23";
const SCENARIOS = {
  focus: { focus: seedId(WS, `entity:${FOCUS_CARD}`) },
  "lens-small": { focus: { t: "requirement", id: seedId(WS, "requirement:REQ-101") } },
  "lens-large": { focus: { t: "requirement", id: seedId(WS, "requirement:REQ-102") } },
  "lens-dense": { focus: { t: "requirement", id: seedId(WS, "requirement:REQ-103") } },
} as const;
type ScenarioName = keyof typeof SCENARIOS;
type Request = (typeof SCENARIOS)[ScenarioName];
/**
 * `FADING_SCENARIOS=focus,lens-large` measures only these scenarios, and only the views that have one (slice 4b-1's
 * closing sitting: S4B1-10 and S4B1-11 need Focus on ent:23 and on REQ-102 only); unset, all of them.
 */
const ONLY_SCENARIOS = (process.env.FADING_SCENARIOS ?? "").split(",").filter(Boolean);
const wanted = (names: ScenarioName[]) => (ONLY_SCENARIOS.length ? names.filter((n) => ONLY_SCENARIOS.includes(n)) : names);
const AROUND_FOCUS: ScenarioName[] = wanted(["focus", "lens-small", "lens-large"]);
const keyOf = (r: Request) => (typeof r.focus === "string" ? `focus:${r.focus}` : `focus:${r.focus.t}:${r.focus.id}`);
const SWITCHES = MEASURE ? 40 : 5;
const PAN_MS = MEASURE ? 10_000 : 2_000;

interface Latency {
  median: number;
  p95: number;
  max: number;
}
type Scenario = { key: string; litCards: string | null; on: Latency; off: Latency; pan: FrameStats; toScreen?: unknown; panToScreen?: unknown } | { notApplicable: string };

/** A direction's in-page time from the traced loop, as `switchTimes` reports it. */
const inPageOf = (d: SwitchSummary[string] | undefined): Latency => ({ median: d?.inPage.median ?? NaN, p95: d?.inPage.p95 ?? NaN, max: d?.inPage.max ?? NaN });

/** One pan of PAN_MS with its rAF figures (for the traced pans). */
const recordPan = async (page: Page) => {
  await startRecording(page);
  await panZoom(page, PAN_MS);
  return stopRecording(page);
};

/** Opens the large canvas at a view (pane coordinates), frames expanded or all collapsed, and lets it settle. */
async function open(page: Page, view: { x: number; y: number; zoom: number }, collapsed: boolean) {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
  const diag = [DIAG, collapsed ? "collapsed" : ""].filter(Boolean).join(",");
  await page.goto(diag ? `${LARGE_URL}?diag=${diag}` : LARGE_URL);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.waitForTimeout(MEASURE ? 1500 : 300);
}

const hasHook = (page: Page) => page.evaluate(() => typeof (window as unknown as { __imFade?: unknown }).__imFade === "function");

/** Switches fading and waits until the page shows it (or shows none), up to `ms`. */
const fade = (page: Page, request: Request | null, ms = 5000) =>
  page.evaluate(
    async ([request, key, ms]) => {
      (window as unknown as { __imFade: (r: unknown) => void }).__imFade(request);
      const t0 = performance.now();
      const shown = () => (key ? !!document.querySelector(`[data-testid="layer-fade"][data-fade="${key}"]`) : !document.querySelector('[data-testid="layer-fade"]'));
      while (!shown() && performance.now() - t0 < ms) await new Promise((res) => setTimeout(res, 10));
      return shown();
    },
    [request, request ? keyOf(request) : "", ms] as const,
  );

/** C-10's method: switch on, wait until it is in the page, then until the next frame; the same for off. */
const switchTimes = (page: Page, request: Request, n: number) =>
  page.evaluate(
    async ([request, key, n]) => {
      const set = (window as unknown as { __imFade: (r: unknown) => void }).__imFade;
      const layer = () => document.querySelector(`[data-testid="layer-fade"][data-fade="${key}"]`);
      const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      const on: number[] = [], off: number[] = [];
      for (let k = 0; k < n; k++) {
        let t0 = performance.now();
        set(request);
        while (!layer() && performance.now() - t0 < 2000) await new Promise((res) => setTimeout(res, 0));
        if (!layer()) return { error: "fading not shown" };
        await nextFrame();
        on.push(performance.now() - t0);
        await nextFrame();
        t0 = performance.now();
        set(null);
        while (document.querySelector('[data-testid="layer-fade"]') && performance.now() - t0 < 2000) await new Promise((res) => setTimeout(res, 0));
        if (document.querySelector('[data-testid="layer-fade"]')) return { error: "fading not removed" };
        await nextFrame();
        off.push(performance.now() - t0);
        await nextFrame();
      }
      const st = (xs: number[]) => {
        const s = [...xs].sort((a, b) => a - b);
        return { median: +s[Math.floor(s.length / 2)]!.toFixed(1), p95: +s[Math.floor(s.length * 0.95)]!.toFixed(1), max: +s[s.length - 1]!.toFixed(1) };
      };
      return { on: st(on), off: st(off) };
    },
    [request, keyOf(request), n] as const,
  );

test("S4P-fading: switching fading on and off, and pan and zoom with fading on and off, on “Performance test” at 100 % and 30 %, frames expanded and collapsed", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production): the collapsed views need ?diag=collapsed").toBe(true);
  test.setTimeout(30 * 60_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");

  // the pane's size, to centre the views on the Focus entity
  const card = generate().cards.find((c) => c.id === FOCUS_CARD)!;
  await open(page, { x: 0, y: 0, zoom: 1 }, false);
  const pane = await page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  const centre = { x: card.x + card.w / 2, y: card.y + 200 };
  const src57 = generate().cards.find((c) => c.id === "src:57")!;
  const hook = await hasHook(page);

  type View = { label?: string; view: { x: number; y: number; zoom: number }; collapsed: boolean; scenarioNames: ScenarioName[]; inView?: string[]; off?: FrameStats; offToScreen?: unknown; scenarios?: Record<string, Scenario> };
  const around = (zoom: number) => ({ x: pane.w / 2 - centre.x * zoom, y: pane.h / 2 - centre.y * zoom, zoom });
  // S1A-14's 100 % view (pane coordinates, as S1A-14 writes it)
  const dense = { x: 768 - src57.x, y: 300 - src57.y, zoom: 1 };
  const all: Record<string, View> = {
    "100 %, expanded": { view: around(1), collapsed: false, scenarioNames: AROUND_FOCUS },
    "30 %, expanded": { view: around(0.3), collapsed: false, scenarioNames: AROUND_FOCUS },
    "100 % dense area, expanded": { view: dense, collapsed: false, scenarioNames: wanted(["lens-dense"]) },
    "100 %, collapsed": { view: around(1), collapsed: true, scenarioNames: AROUND_FOCUS },
    "30 %, collapsed": { view: around(0.3), collapsed: true, scenarioNames: AROUND_FOCUS },
    "100 % dense area, collapsed": { view: dense, collapsed: true, scenarioNames: wanted(["lens-dense"]) },
  };
  // under DIAG=collapsed every view is collapsed: the expanded ones would only repeat them
  const views = Object.fromEntries(Object.entries(all).filter(([, v]) => (v.collapsed || !DIAG.split(",").includes("collapsed")) && v.scenarioNames.length));
  let mechanism: boolean | null = hook ? null : false;
  for (const [label, v] of Object.entries(views)) {
    const view = v.view;
    v.label = label;
    await open(page, view, v.collapsed);
    // the cards (and blocks) in view, to check the lit counts against
    v.inView = await page.evaluate(() => {
      const p = document.querySelector(".react-flow__pane")!.getBoundingClientRect();
      return [...document.querySelectorAll<HTMLElement>(".react-flow__node")]
        .filter((n) => {
          const b = n.getBoundingClientRect();
          return getComputedStyle(n).visibility !== "hidden" && n.style.display !== "none" && b.right > p.left && b.left < p.right && b.bottom > p.top && b.top < p.bottom;
        })
        .map((n) => n.dataset.id!);
    });
    await startRecording(page);
    await panZoom(page, PAN_MS);
    v.off = await stopRecording(page);
    // slice 4b-1: with TO_SCREEN=1 the same pan again, traced, as presented frames (the run above stays as the rAF
    // figure and the trace's own cost)
    if (TO_SCREEN) {
      await open(page, view, v.collapsed);
      v.offToScreen = (await tracedPan(page, `S4P-fading ${label} off`, () => recordPan(page))).presented;
    }

    if (mechanism === false) continue;
    v.scenarios = {};
    for (const name of v.scenarioNames) {
      const request = SCENARIOS[name];
      await open(page, view, v.collapsed);
      // the first time: is there a mechanism that shows the fading? (none before step 2 of slice 4p)
      if (mechanism === null) {
        mechanism = await fade(page, request);
        await fade(page, null);
        if (!mechanism) break;
      }
      // slice 4b-1: with TO_SCREEN=1, settled switches traced to the screen (their in-page times as `on` and `off`)
      const traced = TO_SCREEN ? await tracedSwitches(page, `S4P-fading ${v.label} ${name}`, () => fadingLoop(page, request, keyOf(request), SETTLED_PAIRS)) : null;
      const times = traced
        ? "error" in traced
          ? traced
          : { on: inPageOf(traced.byDir.on), off: inPageOf(traced.byDir.off) }
        : await switchTimes(page, request, SWITCHES);
      expect(times, `${name}: switching`).not.toHaveProperty("error");
      const shown = await fade(page, request);
      expect(shown, `${name}: fading shown before pan and zoom`).toBe(true);
      const litCards = await page.evaluate(() => document.querySelector<HTMLElement>('[data-testid="layer-fade"]')?.dataset.litCards ?? null);
      await page.waitForTimeout(MEASURE ? 1000 : 200);
      await startRecording(page);
      await panZoom(page, PAN_MS);
      const pan = await stopRecording(page);
      const panToScreen = TO_SCREEN ? (await tracedPan(page, `S4P-fading ${v.label} ${name} on`, () => recordPan(page))).presented : undefined;
      await fade(page, null);
      v.scenarios[name] = { key: keyOf(request), litCards, ...(times as { on: Latency; off: Latency }), pan, ...(traced && !("error" in traced) ? { toScreen: traced, panToScreen } : {}) };
    }
    if (mechanism === false) delete v.scenarios;
  }

  // ---- C-10 with the hover line fade variants (trial A), where the page has them ----
  const hoverFade: Record<string, unknown> = {};
  if (await page.evaluate(() => typeof (window as unknown as { __imHoverFade?: unknown }).__imHoverFade === "function")) {
    const dense = all["100 % dense area, expanded"]!.view;
    for (const mode of ["off", "plain", "layer"] as const) {
      await open(page, dense, false);
      hoverFade[mode] = await page.evaluate(
        async ([mode, hovers]) => {
          (window as unknown as { __imHoverFade: (m: string) => void }).__imHoverFade(mode);
          const pane = document.querySelector(".react-flow__pane")!;
          const p = pane.getBoundingClientRect();
          const rows = [...document.querySelectorAll<HTMLElement>(".row[data-row]")]
            .filter((r) => {
              const b = r.getBoundingClientRect();
              return b.top > p.top + 10 && b.bottom < p.bottom - 10 && b.left > p.left && b.right < p.right && r.querySelector(".st.ok, .st.warn");
            })
            .slice(0, 40);
          if (!rows.length) return { error: "no mapped rows in view" };
          const shown = () => !!document.querySelector('[data-testid="hover-row"]') && (mode === "off" || !!document.querySelector('[data-testid="hover-veil"]'));
          const frame: number[] = [];
          for (let k = 0; k < hovers; k++) {
            const r = rows[k % rows.length]!;
            const t0 = performance.now();
            r.querySelector(".nm")!.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
            while (!shown() && performance.now() - t0 < 2000) await new Promise((res) => setTimeout(res, 0));
            if (!shown()) return { error: "hover not shown " + r.dataset.row };
            await new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
            frame.push(performance.now() - t0);
            pane.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
            await new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
          }
          (window as unknown as { __imHoverFade: (m: string) => void }).__imHoverFade("off");
          const sorted = [...frame].sort((a, b) => a - b);
          return { rows: rows.length, toNextFrameMs: { median: +sorted[Math.floor(sorted.length / 2)]!.toFixed(1), p95: +sorted[Math.floor(sorted.length * 0.95)]!.toFixed(1), max: +sorted[sorted.length - 1]!.toFixed(1) } };
        },
        [mode, SWITCHES] as const,
      );
      expect(hoverFade[mode], `hover fade ${mode}`).not.toHaveProperty("error");
    }
  }

  const results = {
    measured: MEASURE,
    browser: browser.version(),
    viewport: page.viewportSize(),
    pane,
    centre: { card: FOCUS_CARD, ...centre },
    fading: hook ? (mechanism ? "measured" : "hook without a fading mechanism: only fading off measured") : "no hook on this side: only fading off measured",
    views,
    hoverFade,
  };
  saveResults("S4P-fading", results);
  await test.info().attach("S4P-fading results", { body: JSON.stringify(results, null, 2), contentType: "application/json" });
  if (MEASURE && mechanism) {
    for (const [name, v] of Object.entries(views)) {
      for (const [scenario, s] of Object.entries(v.scenarios ?? {})) {
        if ("notApplicable" in s) continue;
        expect.soft(s.on.median, `S4P-02 ${name}, ${scenario}: on, median ms (bar 100)`).toBeLessThanOrEqual(100);
        expect.soft(s.off.median, `S4P-02 ${name}, ${scenario}: off, median ms (bar 100)`).toBeLessThanOrEqual(100);
      }
    }
  }
});
