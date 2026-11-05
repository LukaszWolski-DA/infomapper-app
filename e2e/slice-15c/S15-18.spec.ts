// S15-18 (slice 15c, X7; measurement build only): "Performance test – star" (`scripts/lib/star-canvas.ts`), 40 logical
// cards and 50 facts and dimensions, joined by 300 dimensional lines, against the same cards joined by 300
// relationships. Per variant the drawing layers (CDP LayerTree) and the elements at 50 %, then pan and zoom as presented
// frames (traced, slice 4b-1's method) in balanced rounds (ROUNDS, default 3; the order alternates): the lines' pans are
// within the sitting's run-to-run spread of the relationships'. Then, on the lines' variant, the veil at a drag's start
// (X3): a logical row pressed and moved past the drag's 5 px (on), Escape and the release (off), each from a settled
// screen, traced to the screen: the median under 16 ms. Results in test-results/S15-18.json.
//
//   npm run measure:build
//   MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-15c/S15-18.spec.ts

import { resetDevData, seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { addStarCanvas, STAR_CANVAS_ID } from "../../scripts/lib/star-canvas";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { expect, test, type Page } from "../slice-01a/fixtures";
import { canvasUrl } from "../slice-01a/helpers";
import { MEASURE_USE, saveResults } from "../slice-01b/measure";
import { signInAs } from "../slice-04a/helpers";
import { tracedPan, tracedSwitches, type InPage } from "../measure/switches";
import { PAUSE_MS } from "../measure/trace";

test.use(MEASURE_USE);

const WS = LARGE_IDS.workspace;
const ROUNDS = Number(process.env.ROUNDS ?? 3);
const DRAGS = Number(process.env.DRAGS ?? 20);
/** ONLY=veil: the veil alone (a diagnosis between builds); the layers and the pans are left out. */
const ONLY_VEIL = process.env.ONLY === "veil";
type Variant = "mappings" | "relationships";
/** At 50 %: rows drawn, so the lines end at rows with their dots and diamonds; about 25 cards in view. */
const VIEW = { x: 40, y: 40, zoom: 0.5 };

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
    lineLayerElements: await page.evaluate(() => document.querySelectorAll('[data-testid="layer-lines"] *').length),
    moduleLines: await page.locator('[data-testid="layer-lines"] [data-testid="line-module"]').count(),
    relationshipLines: await page.locator('[data-testid="layer-lines"] [data-testid="line-relationship"]').count(),
  };
}

async function prepare(page: Page, v: Variant) {
  await resetDevData(E2E_DB);
  await seedLargeData(E2E_DB);
  await addStarCanvas(E2E_DB, v);
  await page.goto("/sign-in");
  await page.evaluate(([k, view]) => localStorage.setItem(k, view), [`infomapper:view:${STAR_CANVAS_ID}`, JSON.stringify(VIEW)] as const);
  await page.goto(canvasUrl(STAR_CANVAS_ID, LARGE_IDS.project, WS));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.mouse.move(2, 2);
  await page.waitForTimeout(2000);
}

/** S1A-14's in-page wheel driver: one wheel event per frame for `ms`, 1-s segments of pan, zoom in, pan, zoom out. */
const panZoom = (page: Page, ms: number) =>
  page.evaluate(
    (ms) =>
      new Promise<void>((done) => {
        const pane = document.querySelector(".react-flow__pane")!;
        const r = pane.getBoundingClientRect();
        const t0 = performance.now();
        const step = (now: number) => {
          const t = now - t0;
          if (t > ms) return done();
          const seg = Math.floor(t / 1000) % 4;
          const ev: WheelEventInit = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
          if (seg === 0 || seg === 2) Object.assign(ev, { deltaX: 25 * Math.cos(t / 400), deltaY: 25 * Math.sin(t / 400) });
          else Object.assign(ev, { ctrlKey: true, deltaY: seg === 1 ? -3 : 3 });
          pane.dispatchEvent(new WheelEvent("wheel", ev));
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    ms,
  );

/**
 * The veil at a drag's start (X3), `n` times from a settled screen: a logical row in view pressed, then moved past the
 * drag's 5 px (on, to the frame with the veil's key); Escape and the release (off, to the frame without it).
 */
const dragLoop = (page: Page, n: number, pause = PAUSE_MS) =>
  page.evaluate(
    async ([n, pause]) => {
      const pane = document.querySelector(".react-flow__pane")!.getBoundingClientRect();
      const rows = [...document.querySelectorAll<HTMLElement>(".card.ent:not(.dimn) .row[data-row]")].filter((r) => {
        const b = r.getBoundingClientRect();
        return b.top > pane.top + 10 && b.bottom < pane.bottom - 10 && b.left > pane.left && b.right < pane.right;
      });
      if (!rows.length) return { error: "no logical rows in view" };
      const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      const veil = () => document.querySelector('[data-testid="layer-fade"]')?.getAttribute("data-fade") ?? "";
      const out: { dir: string; k: number; ms: number }[] = [];
      for (let k = 0; k < n; k++) {
        const row = rows[k % rows.length]!;
        const b = row.getBoundingClientRect();
        const p = { clientX: b.left + b.width * 0.4, clientY: b.top + b.height / 2, button: 0, buttons: 1, bubbles: true, pointerType: "mouse", isPrimary: true, pointerId: 1 };
        row.querySelector(".dt")!.dispatchEvent(new PointerEvent("pointerdown", p));
        for (const dir of ["on", "off"] as const) {
          const t0 = performance.now();
          if (dir === "on") window.dispatchEvent(new PointerEvent("pointermove", { ...p, clientX: p.clientX + 12, clientY: p.clientY + 6 }));
          else {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
            window.dispatchEvent(new PointerEvent("pointerup", { ...p, buttons: 0 }));
          }
          const done = () => (dir === "on" ? veil().startsWith("lit:drag:") : veil() === "");
          while (!done() && performance.now() - t0 < 2000) await new Promise((res) => setTimeout(res, 0));
          if (!done()) return { error: `veil ${dir} ${k}: not shown` };
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

test("S15-18: 300 dimensional lines against 300 relationships between the same cards; the veil at a drag's start", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(60 * 60_000);
  await signInAs(page, "Łukasz");

  const reads: Partial<Record<Variant, Awaited<ReturnType<typeof layers>>>> = {};
  for (const v of ONLY_VEIL ? [] : (["mappings", "relationships"] as const)) {
    await prepare(page, v);
    reads[v] = await layers(page);
  }
  if (!ONLY_VEIL) {
    expect(reads.mappings!.moduleLines, "dimensional lines in view").toBeGreaterThan(0);
    expect(reads.relationships!.moduleLines).toBe(0);
  }

  // one warm-up pan per variant, not counted (CLAUDE.md: the first side measured after the builds ran slow)
  for (const v of ONLY_VEIL ? [] : (["mappings", "relationships"] as const)) {
    await prepare(page, v);
    await page.waitForTimeout(1500);
    await tracedPan(page, `S15-18 warm-up ${v}`, () => panZoom(page, 10_000));
  }
  const pans: Record<Variant, unknown[]> = { mappings: [], relationships: [] };
  for (let round = 0; round < (ONLY_VEIL ? 0 : ROUNDS); round++) {
    const order: Variant[] = round % 2 === 0 ? ["mappings", "relationships"] : ["relationships", "mappings"];
    for (const v of order) {
      await prepare(page, v);
      await page.waitForTimeout(1500);
      const traced = await tracedPan(page, `S15-18 ${v} ${round}`, () => panZoom(page, 10_000));
      pans[v].push({ round, presented: traced.presented, trace: traced.trace });
    }
  }

  await prepare(page, "mappings");
  const veil = await tracedSwitches(page, "S15-18 veil", () => dragLoop(page, DRAGS));
  saveResults(ONLY_VEIL ? "S15-18-veil" : "S15-18", { browser: browser.version(), view: VIEW, reads, pans, veil });
  expect("error" in veil ? veil.error : null).toBeNull();
});
