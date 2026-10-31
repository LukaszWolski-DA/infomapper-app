// S11-13 (slice 11, PRD section 6; measurement build only, MEASURE=1 MEASURE_BUILD=production after
// `npm run measure:build`): switching “Attribute aliases” measured to the screen, against switching the layer mode in
// the same sitting, on “Performance test” with an alias on every entity and attribute (the e2e data file only, A4).
// Both of S6A-09's views (30 % around ent:23, 100 % dense), ROUNDS balanced rounds (default 3; the order alternates),
// SETTLED_PAIRS settled pairs per run, each switch from its click to the first GPU present after its commit
// (e2e/measure, as S6A-09). First, the drawing layers (CDP LayerTree) of each view with names and with aliases shown.
// Results in test-results/S11-13.json; raw traces in .data/measure/ (git-ignored).
//
//   MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-11/S11-13.spec.ts

import { resetDevData, seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { LARGE_URL, MEASURE_USE, saveResults } from "../slice-01b/measure";
import { tracedSwitches, type InPage } from "../measure/switches";
import { PAUSE_MS, SETTLED_PAIRS } from "../measure/trace";
import { expect, test, type Page } from "./fixtures";
import { signInAs } from "./helpers";
import { ALIAS_PREFIX, aliasEverything, views, type View } from "./measure";

test.use(MEASURE_USE);

const ROUNDS = Number(process.env.ROUNDS ?? 3);
type Kind = "names" | "layer";

async function open(page: Page, view: View) {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
  await page.goto(LARGE_URL);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.mouse.move(2, 400);
  await page.waitForTimeout(1500);
}

/** A switch: what to click, and the selector that matches once it is done. */
const SWITCHES: Record<Kind, Record<"on" | "off", { click: string; done: string }>> = {
  names: {
    on: { click: '[data-testid="check-attribute-aliases"]', done: '[data-testid="check-attribute-aliases"][data-state="alias"]' },
    off: { click: '[data-testid="check-attribute-aliases"]', done: '[data-testid="check-attribute-aliases"][data-state="name"]' },
  },
  layer: {
    on: { click: '[data-testid="switch-layer"] [data-layer="mappings"]', done: '[data-testid="switch-layer"] [data-layer="mappings"][aria-pressed="true"]' },
    off: { click: '[data-testid="switch-layer"] [data-layer="all"]', done: '[data-testid="switch-layer"] [data-layer="all"][aria-pressed="true"]' },
  },
};

/** `n` settled pairs in the page (as S6A-09's loop): a pause, the click, timed until done and the next frame. */
const switchLoop = (page: Page, sw: (typeof SWITCHES)[Kind], n: number, pause = PAUSE_MS) =>
  page.evaluate(
    async ([sw, n, pause]) => {
      const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
      const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      const out: { dir: string; k: number; ms: number }[] = [];
      for (let k = 0; k < n; k++) {
        for (const dir of ["on", "off"] as const) {
          await sleep(pause);
          const t0 = performance.now();
          const el = document.querySelector<HTMLElement>(sw[dir].click);
          if (!el) return { error: `${dir} ${k}: no ${sw[dir].click}` };
          el.click();
          while (!document.querySelector(sw[dir].done)) {
            if (performance.now() - t0 > 5000) return { error: `${dir} ${k}: not switched` };
            await sleep(0);
          }
          await nextFrame();
          const t1 = performance.now();
          performance.measure(`sw:${dir}:${k}`, { start: t0, end: t1 });
          out.push({ dir, k, ms: +(t1 - t0).toFixed(1) });
          // the server's answer and its fresh page arrive before the next switch
          await sleep(pause);
        }
      }
      return out;
    },
    [sw, n, pause] as const,
  ) as Promise<InPage>;

/** Drawing layers and their megapixels (CDP LayerTree), as S6A-09 reads them, with the viewport's elements. */
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
  return {
    drawingLayers: drawing.length,
    drawingMegapixels: +(drawing.reduce((s, l) => s + l.width * l.height, 0) / 1e6).toFixed(1),
    viewportElements: await page.evaluate(() => document.querySelectorAll(".react-flow__viewport *").length),
    rowsShowingAliases: await page.evaluate((p) => document.querySelectorAll(`.row .nm[title^="${p}"]`).length, ALIAS_PREFIX),
    headersShowingAliases: await page.evaluate((p) => document.querySelectorAll(`.c-name[title^="${p}"]`).length, ALIAS_PREFIX),
  };
}

test("S11-13: “Attribute aliases” against the layer switch, to the screen on “Performance test”, at 30 % and at 100 % dense; the drawing layers", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(120 * 60_000);
  await resetDevData(E2E_DB);
  await seedLargeData(E2E_DB);
  const aliased = await aliasEverything();
  await signInAs(page, "Łukasz");
  await open(page, { x: 0, y: 0, zoom: 1 });
  const pane = await page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  const all = views(pane);

  // the drawing layers with names and with aliases shown (entity and attribute names both)
  const reads: Record<string, unknown> = {};
  for (const [name, view] of Object.entries(all)) {
    await open(page, view);
    const names = await layers(page);
    await page.getByTestId("check-entity-aliases").click();
    await page.getByTestId("check-attribute-aliases").click();
    await expect(page.getByTestId("check-attribute-aliases")).toHaveAttribute("data-state", "alias");
    await page.waitForTimeout(2500);
    const aliases = await layers(page);
    await page.getByTestId("check-entity-aliases").click();
    await page.getByTestId("check-attribute-aliases").click();
    await expect(page.getByTestId("check-attribute-aliases")).toHaveAttribute("data-state", "name");
    await page.waitForTimeout(2500);
    reads[name] = { names, aliases };
  }

  const runs: Record<string, unknown[]> = {};
  for (let round = 0; round < ROUNDS; round++) {
    const order: Kind[] = round % 2 === 0 ? ["names", "layer"] : ["layer", "names"];
    for (const [name, view] of Object.entries(all)) {
      for (const kind of order) {
        await open(page, view);
        const r = await tracedSwitches(page, `S11-13 ${name} ${kind} ${round}`, () => switchLoop(page, SWITCHES[kind], SETTLED_PAIRS));
        expect(r, `${name}: ${kind} round ${round}`).not.toHaveProperty("error");
        (runs[`${name} · ${kind}`] ??= []).push({ round, ...r });
        // saved after each run, so a later failure keeps what was measured
        saveResults("S11-13", { browser: browser.version(), pane, aliased, pairs: SETTLED_PAIRS, rounds: ROUNDS, reads, runs });
      }
    }
  }
  saveResults("S11-13", { browser: browser.version(), pane, aliased, pairs: SETTLED_PAIRS, rounds: ROUNDS, reads, runs });
});
