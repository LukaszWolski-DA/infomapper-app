// S6A-09 (slice 6a, PRD section 6): the diagnosis to the screen, measurement build only (MEASURE=1
// MEASURE_BUILD=production, after `npm run measure:build`; no laptop preparation, the figures are diagnostic). On
// “Performance test” at 30 % around ent:23 and in S1A-14's 100 % dense view, frames expanded, SETTLED_PAIRS settled
// pairs each, every switch timed from its click to the first GPU present after its commit (e2e/measure):
// - Focus on with the toolbar button, off with the button or with its chip's × (bar: medians within 10 ms);
// - “Show all” (on) against the same changes through the existing controls one after another (off): with Focus and a
//   row filter on (the Focus button, then the card's filter button), and with five frames collapsed (“Expand all”);
// - the Hand tool switched on and off, with the bar and with `?diag=noviewbar` (no bar): its chip appearing costs
//   ≤ 16 ms median beyond the switch itself.
// A LayerTree read with no chips and with four chips on, each with and without the bar, counts the drawing layers. Results in
// test-results/S6A-09.json; raw traces in .data/measure/ (git-ignored).

import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { LARGE_URL, MEASURE, MEASURE_USE, saveResults } from "../slice-01b/measure";
import { tracedSwitches, type InPage } from "../measure/switches";
import { PAUSE_MS, SETTLED_PAIRS } from "../measure/trace";
import { expect, test, type Page } from "./fixtures";
import { signInAs } from "./helpers";

test.use(MEASURE_USE);

type View = { x: number; y: number; zoom: number };
/** A condition the page must meet before a step counts as done: how many elements match, or an attribute's value. */
type Cond = { sel: string; count?: number; attr?: [string, string | null] };
/** A click, then wait until every condition holds. */
type Step = { click: string; until: Cond[] };
interface Scenario {
  /** Untimed, before each switch of that direction. */
  setup?: { on?: Step[]; off?: Step[] };
  on: Step[];
  off: Step[];
}

async function open(page: Page, view: View, diag = "") {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
  await page.goto(diag ? `${LARGE_URL}?diag=${diag}` : LARGE_URL);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.mouse.move(2, 400);
  await page.waitForTimeout(MEASURE ? 1500 : 300);
}

/**
 * The scenario's switches in the page, `n` pairs, each from a settled screen: the setup (untimed), a pause, then the
 * switch's clicks back to back, timed until its last step's conditions hold and the next frame.
 */
const scenarioLoop = (page: Page, scenario: Scenario, n: number, pause = PAUSE_MS) =>
  page.evaluate(
    async ([scenario, n, pause]) => {
      const holds = (c: Cond) => {
        const els = document.querySelectorAll<HTMLElement>(c.sel);
        if (c.count !== undefined && els.length !== c.count) return false;
        if (c.attr) return els.length > 0 && els[0]!.getAttribute(c.attr[0]) === c.attr[1];
        return true;
      };
      const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
      const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      const wait = async (conds: Cond[], t0: number) => {
        while (!conds.every(holds)) {
          if (performance.now() - t0 > 5000) return false;
          await sleep(0);
        }
        return true;
      };
      const click = (sel: string) => {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el) return false;
        el.click();
        return true;
      };
      const out: { dir: string; k: number; ms: number }[] = [];
      for (let k = 0; k < n; k++) {
        for (const dir of ["on", "off"] as const) {
          for (const step of scenario.setup?.[dir] ?? []) {
            if (!click(step.click)) return { error: `setup ${dir} ${k}: no ${step.click}` };
            if (!(await wait(step.until, performance.now()))) return { error: `setup ${dir} ${k}: ${step.click} did not finish` };
            await sleep(150);
          }
          await sleep(pause);
          const steps = scenario[dir];
          const t0 = performance.now();
          for (const step of steps) if (!click(step.click)) return { error: `${dir} ${k}: no ${step.click}` };
          if (!(await wait(steps[steps.length - 1]!.until, t0))) return { error: `${dir} ${k}: not switched` };
          await nextFrame();
          const t1 = performance.now();
          performance.measure(`sw:${dir}:${k}`, { start: t0, end: t1 });
          out.push({ dir, k, ms: +(t1 - t0).toFixed(1) });
          await sleep(pause);
        }
      }
      return out;
    },
    [scenario, n, pause] as const,
  ) as Promise<InPage>;

/** Selects the card at a point of the pane (a click on its header) and returns its node's selector. */
async function selectCardAt(page: Page, at: { x: number; y: number }): Promise<string> {
  const head = await page.evaluate(([x, y]) => {
    const pane = document.querySelector(".react-flow__pane")!.getBoundingClientRect();
    const node = document.elementFromPoint(pane.x + x, pane.y + y)?.closest<HTMLElement>(".react-flow__node-card");
    const h = node?.querySelector(".c-head .c-l2")?.getBoundingClientRect();
    return node && h ? { id: node.dataset.id!, x: h.x + 12, y: h.y + h.height / 2 } : null;
  }, [at.x, at.y] as const);
  expect(head, "a card at the pane's point").not.toBeNull();
  await page.mouse.click(head!.x, head!.y);
  await page.mouse.move(2, 400);
  return `.react-flow__node[data-id="${head!.id}"]`;
}

/** Drawing layers and their megapixels (CDP LayerTree), as S4B2-15 and S5A-08 read them. */
async function layers(page: Page) {
  // CDP's replies, loosely typed (a diagnosis)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Reply = any;
  type L = { width: number; height: number; drawsContent: boolean };
  const cdp = (await page.context().newCDPSession(page)) as unknown as { send: (m: string, x?: unknown) => Promise<Reply>; on: (e: string, f: (x: Reply) => void) => void; detach: () => Promise<void> };
  let list: L[] = [];
  cdp.on("LayerTree.layerTreeDidChange", (e: { layers?: L[] }) => {
    if (e.layers) list = e.layers;
  });
  await cdp.send("LayerTree.enable");
  await page.evaluate(() => document.body.style.setProperty("--im-diag", String(Math.random())));
  await page.waitForTimeout(1500);
  const drawing = list.filter((l) => l.drawsContent);
  await cdp.send("LayerTree.disable");
  await cdp.detach();
  return { drawingLayers: drawing.length, drawingMegapixels: +(drawing.reduce((s, l) => s + l.width * l.height, 0) / 1e6).toFixed(1) };
}

/** `HAND_ONLY=1`: only the Hand tool pair (with and without the bar), saved as S6A-09-hand-pair. */
const HAND_ONLY = process.env.HAND_ONLY === "1";
const FADE = '[data-testid="layer-fade"]';
const BLOCK = '[data-testid="block"]';
const focusOn: Step = { click: '[data-testid="button-focus"]', until: [{ sel: FADE, count: 1 }] };

test("S6A-09: chips, “Show all” and a chip appearing, to the screen on “Performance test”, at 30 % and at 100 % dense", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(120 * 60_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  await open(page, { x: 0, y: 0, zoom: 1 });
  const pane = await page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  const data = generate();
  const ent23 = data.cards.find((c) => c.id === "ent:23")!, src57 = data.cards.find((c) => c.id === "src:57")!;
  const views = {
    "30 % around ent:23": { view: { x: pane.w / 2 - (ent23.x + ent23.w / 2) * 0.3, y: pane.h / 2 - (ent23.y + 200) * 0.3, zoom: 0.3 }, card: { x: pane.w / 2, y: pane.h / 2 - 200 * 0.3 + 6 } },
    "100 % dense": { view: { x: 768 - src57.x, y: 300 - src57.y, zoom: 1 }, card: { x: 768 + 40, y: 300 + 12 } },
  };
  const results: Record<string, Record<string, unknown>> = {};
  const run = async (name: string, label: string, scenario: Scenario) => {
    const r = await tracedSwitches(page, `S6A-09 ${name} ${label}`, () => scenarioLoop(page, scenario, SETTLED_PAIRS));
    expect(r, `${name}: ${label}`).not.toHaveProperty("error");
    results[name]![label] = r;
  };

  for (const [name, { view, card }] of Object.entries(views)) {
    results[name] = {};
    const r = results[name]!;
    if (HAND_ONLY) {
      const hand: Step = { click: '[data-testid="button-tool-hand"]', until: [{ sel: '[data-testid="area-canvas"]', attr: ["data-mode", "hand"] }] };
      const handOnOff: Scenario = { on: [hand], off: [{ click: '[data-testid="button-tool-hand"]', until: [{ sel: '[data-testid="area-canvas"]', attr: ["data-mode", null] }] }] };
      await open(page, view);
      await run(name, "Hand tool on and off, with the bar", handOnOff);
      await open(page, view, "noviewbar");
      await run(name, "Hand tool on and off, without the bar", handOnOff);
      saveResults("S6A-09-hand-pair", { measured: MEASURE, browser: browser.version(), pane, views: results });
      continue;
    }

    // the drawing layers: no chips; Focus, the layer, a filter and the Hand tool on (four chips and “Show all”); the same
    // without the bar, so the bar's own share shows
    const fourOn = async (node: string) => {
      await page.getByTestId("button-focus").click();
      await page.locator('[data-testid="switch-layer"] [data-layer="mappings"]').click();
      // a direct click: in the dense view the card's neighbours cover its filter button
      await page.locator(`${node} [data-testid="button-card-filter"]`).evaluate((b) => (b as HTMLElement).click());
      await expect(page.locator(`${node} [data-card]`)).toHaveAttribute("data-filter", "mapped");
      await page.getByTestId("button-tool-hand").click();
    };
    const L: Record<string, unknown> = {};
    r.layers = L;
    await open(page, view);
    let node = await selectCardAt(page, card);
    L.noChips = await layers(page);
    await fourOn(node);
    L.fourChips = await layers(page);
    await page.getByTestId("button-view-show-all").click();
    await expect(page.getByTestId("button-view-show-all")).toHaveCount(0);
    await open(page, view, "noviewbar");
    node = await selectCardAt(page, card);
    L.noBar = await layers(page);
    await fourOn(node);
    L.fourOnNoBar = await layers(page);
    // back as it was, through the existing controls (no bar here)
    await page.getByTestId("button-tool-hand").click();
    await page.getByTestId("button-focus").click();
    await page.locator('[data-testid="switch-layer"] [data-layer="all"]').click();
    for (const next of ["unmapped", "keys", "all"]) {
      await page.locator(`${node} [data-testid="button-card-filter"]`).evaluate((b) => (b as HTMLElement).click());
      await expect(page.locator(`${node} [data-card]`)).toHaveAttribute("data-filter", next);
    }

    // Focus off: its button against its chip's ×
    await open(page, view);
    node = await selectCardAt(page, card);
    await run(name, "Focus: on and off with the button", { on: [focusOn], off: [{ click: '[data-testid="button-focus"]', until: [{ sel: FADE, count: 0 }] }] });
    await run(name, "Focus: on with the button, off with its chip's ×", { on: [focusOn], off: [{ click: '[data-testid="chip-focus-off"]', until: [{ sel: FADE, count: 0 }] }] });

    // “Show all” (on) against the Focus button and the card's filter button (off), from Focus on and the filter at Keys
    const filterButton = `${node} [data-testid="button-card-filter"]`;
    const filterIs = (v: string): Cond => ({ sel: `${node} [data-card]`, attr: ["data-filter", v] });
    const toKeys: Step[] = [
      focusOn,
      { click: filterButton, until: [filterIs("mapped")] },
      { click: filterButton, until: [filterIs("unmapped")] },
      { click: filterButton, until: [filterIs("keys")] },
    ];
    const cleared = [{ sel: FADE, count: 0 }, filterIs("all")];
    await run(name, "Show all (on) / Focus button + filter button (off): Focus and a filter", {
      setup: { on: toKeys, off: toKeys },
      on: [{ click: '[data-testid="button-view-show-all"]', until: cleared }],
      off: [{ click: '[data-testid="button-focus"]', until: [] }, { click: filterButton, until: cleared }],
    });

    // “Show all” (on) against “Expand all” (off), from five frames collapsed; nothing selected, so the overview shows
    await open(page, view);
    const collapseFive: Step[] = [1, 2, 3, 4, 5].map((i) => ({ click: '[data-testid="button-frame-collapse"]', until: [{ sel: BLOCK, count: i }] }));
    // with frames only, “Show all” needs a second chip: the Hand tool, turned off by both sides
    const hand: Step = { click: '[data-testid="button-tool-hand"]', until: [{ sel: '[data-testid="area-canvas"]', attr: ["data-mode", "hand"] }] };
    await run(name, "Show all (on) / Expand all + Hand tool off (off): five frames collapsed", {
      setup: { on: [...collapseFive, hand], off: [...collapseFive, hand] },
      on: [{ click: '[data-testid="button-view-show-all"]', until: [{ sel: BLOCK, count: 0 }, { sel: '[data-testid="area-canvas"]', attr: ["data-mode", null] }] }],
      off: [
        { click: '[data-testid="button-frames-expand-all"]', until: [] },
        { click: '[data-testid="button-tool-hand"]', until: [{ sel: BLOCK, count: 0 }, { sel: '[data-testid="area-canvas"]', attr: ["data-mode", null] }] },
      ],
    });

    // a chip appearing alone: the Hand tool on and off, with the bar and without it
    const handOnOff: Scenario = { on: [hand], off: [{ click: '[data-testid="button-tool-hand"]', until: [{ sel: '[data-testid="area-canvas"]', attr: ["data-mode", null] }] }] };
    await open(page, view);
    await run(name, "Hand tool on and off, with the bar", handOnOff);
    await open(page, view, "noviewbar");
    await run(name, "Hand tool on and off, without the bar", handOnOff);
    // saved after each view, so a later failure keeps what was measured
    saveResults("S6A-09", { measured: MEASURE, browser: browser.version(), pane, views: results });
  }
  saveResults("S6A-09", { measured: MEASURE, browser: browser.version(), pane, views: results });
});
