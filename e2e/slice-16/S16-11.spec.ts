// S16-11 (slice 16, PRD section 6 as answered; measurement build only, MEASURE=1 MEASURE_BUILD=production after
// `npm run measure:build`): switching "Between entities" and "Between source tables" measured to the screen, against
// switching the layer mode in the same sitting (S11-13's method: from its click to the first GPU present after its
// commit, e2e/measure), on "Performance test" with 20 source relationships (e2e data file only), at 30 % around ent:23
// and at 100 % dense, ROUNDS balanced rounds (default 3; the order alternates), SETTLED_PAIRS settled pairs per run.
// First the drawing layers (CDP LayerTree) and the viewport's elements with both kinds shown and with each hidden: equal
// layers, and fewer elements by exactly the hidden lines'. Results in test-results/S16-11.json; raw traces in
// .data/measure/ (git-ignored).
//
//   MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-16/S16-11.spec.ts

import { resetDevData, seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { LARGE_URL, MEASURE_USE, saveResults } from "../slice-01b/measure";
import { tracedSwitches, type InPage } from "../measure/switches";
import { PAUSE_MS, SETTLED_PAIRS } from "../measure/trace";
import { expect, test, type Page } from "./fixtures";
import { signInAs } from "./helpers";
import { drawn, openTabMenu, SWITCHES, twentySourceKeys, views, type Kind, type View } from "./measure";

test.use(MEASURE_USE);

const ROUNDS = Number(process.env.ROUNDS ?? 3);

async function open(page: Page, view: View) {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
  await page.goto(LARGE_URL);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.mouse.move(2, 400);
  await openTabMenu(page);
  await page.waitForTimeout(1500);
}

/** `n` settled pairs in the page (S11-13's loop): a pause, the click, timed until done and the next frame. */
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
          await sleep(pause);
        }
      }
      return out;
    },
    [sw, n, pause] as const,
  ) as Promise<InPage>;

/** Drawing layers and their megapixels (CDP LayerTree), as S11-13 reads them, with what the view draws. */
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
  return { drawingLayers: drawing.length, drawingMegapixels: +(drawing.reduce((s, l) => s + l.width * l.height, 0) / 1e6).toFixed(1), ...(await drawn(page)) };
}

test("S16-11: the relationship kinds against the layer switch, to the screen on “Performance test” with 20 source lines, at 30 % and at 100 % dense; the drawing layers and elements", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(120 * 60_000);
  await resetDevData(E2E_DB);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  await page.goto(LARGE_URL);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  const pane = await page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  const keys = await twentySourceKeys(pane);
  const all = views(pane);

  // the drawing layers and elements: both shown, entities hidden, sources hidden
  const reads: Record<string, unknown> = {};
  for (const [name, view] of Object.entries(all)) {
    await open(page, view);
    const shown = await layers(page);
    await page.locator(SWITCHES.entities.on.click).click();
    await page.locator(SWITCHES.entities.on.done).waitFor();
    await page.waitForTimeout(2500);
    const noEntities = await layers(page);
    await page.locator(SWITCHES.entities.off.click).click();
    await page.locator(SWITCHES.sources.on.click).click();
    await page.locator(SWITCHES.sources.on.done).waitFor();
    await page.waitForTimeout(2500);
    const noSources = await layers(page);
    await page.locator(SWITCHES.sources.off.click).click();
    await page.locator(SWITCHES.sources.off.done).waitFor();
    await page.waitForTimeout(2500);
    reads[name] = { shown, noEntities, noSources };
  }

  const runs: Record<string, unknown[]> = {};
  for (let round = 0; round < ROUNDS; round++) {
    const order: Kind[] = round % 2 === 0 ? ["entities", "sources", "layer"] : ["layer", "sources", "entities"];
    for (const [name, view] of Object.entries(all)) {
      for (const kind of order) {
        await open(page, view);
        const r = await tracedSwitches(page, `S16-11 ${name} ${kind} ${round}`, () => switchLoop(page, SWITCHES[kind], SETTLED_PAIRS));
        expect(r, `${name}: ${kind} round ${round}`).not.toHaveProperty("error");
        (runs[`${name} · ${kind}`] ??= []).push({ round, ...r });
        saveResults("S16-11", { browser: browser.version(), pane, keys, pairs: SETTLED_PAIRS, rounds: ROUNDS, reads, runs });
      }
    }
  }
  saveResults("S16-11", { browser: browser.version(), pane, keys, pairs: SETTLED_PAIRS, rounds: ROUNDS, reads, runs });
});
