// S4B2-12 (slice 4b-2, section 6; measurement build only, `npm run measure:canvas -- --to-screen --only s4b2screen`):
// to the screen, from a settled screen, SETTLED_PAIRS each, on “Performance test – requirements”, frames expanded:
//   - the drop target lit while a requirement from the left panel is dragged over a row (100 % only: rows are not drawn
//     below 40 %), a card's header and a mapping line, then off again over empty canvas; at 100 % and 30 % around ent:23.
//     The drag is dispatched in the page (`dragstart` on the requirement's row, then `dragover` at each point) and each
//     switch is bracketed from just before its `dragover` (answer F: the mark before each dispatched `dragover`);
//   - selecting REQ-102's card (its coverage colours on), then Escape; at 100 % around the card and at 30 % around ent:23;
//   - Focus on with requirement cards lit (ent:4: REQ-102, REQ-105 and REQ-109's cards; REQ-102: its card), then off;
//     at 30 % around ent:23 and at 100 % around REQ-102's card.
// Bar: ≤ 100 ms to the screen, median (p95 and max reported). Results in test-results/S4B2-12.json.

import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { fadingLoop, tracedSwitches, type InPage } from "../measure/switches";
import { PAUSE_MS, SETTLED_PAIRS } from "../measure/trace";
import { MEASURE, MEASURE_USE, saveResults } from "../slice-01b/measure";
import { expect, test, type Page } from "./fixtures";
import { signInAs, store } from "./helpers";
import { aroundEnt23, centredOn, focusEntity, focusRequirement, openReq, paneSize, REQ_CANVAS, requirementId, type View } from "./measure";

test.use(MEASURE_USE);

/** The requirement dragged: linked to nothing in these views, so every target reads “Link to …”. */
const DRAGGED = "REQ-110";

async function withRequirementsTab(page: Page) {
  if ((await page.getByTestId("tab-requirements").getAttribute("aria-selected")) !== "true") await page.getByTestId("tab-requirements").click();
  await expect(page.locator(`[data-testid="tree-req"][data-key="${DRAGGED}"]`)).toBeVisible();
  await page.waitForTimeout(PAUSE_MS);
}

/** Points in the pane for each kind of target, and a spot with nothing to link under it. */
const targetPoints = (page: Page) =>
  page.evaluate(() => {
    const p = document.querySelector(".react-flow__pane")!.getBoundingClientRect();
    const inside = (x: number, y: number) => x > p.left + 40 && x < p.right - 260 && y > p.top + 40 && y < p.bottom - 180;
    const centre = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const first = <T,>(xs: T[]) => xs.find((v) => v !== null && v !== undefined) ?? null;
    const row = first([...document.querySelectorAll(".react-flow__node-card .row[data-row]")].map(centre).filter((c) => inside(c.x, c.y) && document.elementFromPoint(c.x, c.y)?.closest(".row[data-row]")));
    const card = first([...document.querySelectorAll(".react-flow__node-card .c-head")].map(centre).filter((c) => inside(c.x, c.y) && document.elementFromPoint(c.x, c.y)?.closest(".c-head")));
    const line = first(
      [...document.querySelectorAll<SVGPathElement>(".lnk.map .hit")].map((path) => {
        const m = path.getScreenCTM();
        if (!m) return null;
        // several points along the line: its middle often lies under a card
        for (const f of [0.5, 0.35, 0.65, 0.2, 0.8]) {
          const q = path.getPointAtLength(path.getTotalLength() * f);
          const pt = { x: q.x * m.a + q.y * m.c + m.e, y: q.x * m.b + q.y * m.d + m.f };
          if (inside(pt.x, pt.y) && document.elementFromPoint(pt.x, pt.y)?.closest(".lnk.map")) return pt;
        }
        return null;
      }),
    );
    let empty: { x: number; y: number } | null = null;
    for (let y = p.top + 60; y < p.bottom - 200 && !empty; y += 23)
      for (let x = p.left + 60; x < p.right - 280 && !empty; x += 29) {
        // no card, block, note or line under it: the empty canvas or a frame's body (“Place card”)
        const el = document.elementFromPoint(x, y);
        if (el && el.closest(".react-flow") && !el.closest(".react-flow__node, .lnk, [data-note], .react-flow__panel")) empty = { x, y };
      }
    return { row, card, line, empty };
  });

/** The drag: `dragover` at the target (on), then at the empty spot (off), `n` times, each from a settled screen. */
const dropLoop = (page: Page, key: string, at: { x: number; y: number }, empty: { x: number; y: number }, n: number, pause = PAUSE_MS) =>
  page.evaluate(
    async ([key, at, empty, n, pause]) => {
      const row = document.querySelector<HTMLElement>(`[data-testid="tree-req"][data-key="${key}"]`)!;
      const dt = new DataTransfer();
      row.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
      const over = (x: number, y: number) => document.elementFromPoint(x, y)!.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
      const lit = () => !!document.querySelector('[data-testid="mark-drop-target"], [data-testid="layer-drop-line"] path');
      const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      const out: { dir: string; k: number; ms: number }[] = [];
      try {
        for (let k = 0; k < n; k++) {
          for (const dir of ["on", "off"] as const) {
            const t0 = performance.now();
            if (dir === "on") over(at.x, at.y);
            else over(empty.x, empty.y);
            const done = () => (dir === "on" ? lit() : !lit());
            while (!done() && performance.now() - t0 < 3000) await new Promise((res) => setTimeout(res, 0));
            if (!done()) return { error: `drop target ${dir} ${k}: not shown` };
            await nextFrame();
            const t1 = performance.now();
            performance.measure(`sw:${dir}:${k}`, { start: t0, end: t1 });
            out.push({ dir, k, ms: +(t1 - t0).toFixed(1) });
            await new Promise((res) => setTimeout(res, pause));
          }
        }
      } finally {
        row.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
      }
      return out;
    },
    [key, at, empty, n, pause] as const,
  ) as Promise<InPage>;

/** REQ-102's card clicked (on: its coverage colours), then Escape (off), `n` times, each from a settled screen. */
const selectLoop = (page: Page, n: number, pause = PAUSE_MS) =>
  page.evaluate(
    async ([n, pause]) => {
      const card = document.querySelector<HTMLElement>('[data-testid="card-requirement"][data-key="REQ-102"]');
      if (!card) return { error: "REQ-102's card is not on the page" };
      const shown = () => !!document.querySelector('[data-testid="layer-coverage-rows"], [data-testid="layer-coverage-headers"]');
      const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      const out: { dir: string; k: number; ms: number }[] = [];
      for (let k = 0; k < n; k++) {
        for (const dir of ["on", "off"] as const) {
          const t0 = performance.now();
          if (dir === "on") card.click();
          else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          const done = () => (dir === "on" ? shown() : !shown());
          while (!done() && performance.now() - t0 < 3000) await new Promise((res) => setTimeout(res, 0));
          if (!done()) return { error: `selection ${dir} ${k}: not shown` };
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

test("S4B2-12: the drop highlight, selecting a requirement card and Focus with requirement cards lit, to the screen", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(45 * 60_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  await openReq(page, { x: 0, y: 0, zoom: 1 });
  const pane = await paneSize(page);
  const r102 = (await store().canvasItems.listOfCanvas(LARGE_IDS.workspace, REQ_CANVAS)).find((i) => i.requirement_id === requirementId("REQ-102"))!;
  const atCard: View = centredOn(pane, r102.x + 115, r102.y + 55, 1);
  const results: Record<string, unknown> = {};
  const run = async (name: string, loop: () => Promise<InPage>) => {
    const traced = await tracedSwitches(page, `S4B2-12 ${name}`, loop);
    expect(traced, name).not.toHaveProperty("error");
    results[name] = traced;
  };

  // the drop target while dragging
  for (const zoom of [1, 0.3]) {
    await openReq(page, aroundEnt23(pane, zoom));
    await withRequirementsTab(page);
    const points = await targetPoints(page);
    expect(points.empty, "an empty spot in the view").not.toBeNull();
    for (const kind of ["row", "card", "line"] as const) {
      const at = points[kind];
      if (!at) {
        // no rows below 40 %
        results[`drop target, ${kind}, ${zoom * 100} %`] = { notApplicable: `no ${kind} in the view` };
        continue;
      }
      await run(`drop target, ${kind}, ${zoom * 100} %`, () => dropLoop(page, DRAGGED, at, points.empty!, SETTLED_PAIRS));
    }
  }

  // selecting a requirement card (its colours)
  for (const [name, view] of [["100 % around REQ-102's card", atCard], ["30 % around ent:23", aroundEnt23(pane, 0.3)]] as const) {
    await openReq(page, view);
    await page.waitForTimeout(PAUSE_MS);
    await run(`select REQ-102's card, ${name}`, () => selectLoop(page, SETTLED_PAIRS));
  }

  // Focus with requirement cards lit
  for (const [name, view] of [["30 % around ent:23", aroundEnt23(pane, 0.3)], ["100 % around REQ-102's card", atCard]] as const) {
    for (const [target, focus] of [["ent:4", focusEntity("ent:4")], ["REQ-102", focusRequirement("REQ-102")]] as const) {
      await openReq(page, view);
      await run(`Focus ${target}, ${name}`, () => fadingLoop(page, focus.request, focus.key, SETTLED_PAIRS));
    }
  }
  saveResults("S4B2-12", { measured: MEASURE, browser: browser.version(), pane, cases: results });
});
