// S10A-12's branch-only reads (slice 10a, PRD section 6; measurement build only): on "Performance test" ("100 cards"),
// a view around ent:23 (30 %, or lower until 20 entity cards are in view), with 20 self-relationships on 20 entity cards in view, against 20 ordinary relationships
// between the same cards, against neither. The rows go into the e2e data file before the page opens (A4: never
// .data/dev-db.json, no seed:large option). Per variant: the drawing layers (CDP LayerTree, as S4B2-15-layers) and the
// line layer's elements; then pan and zoom as presented frames (traced, as S1A-14 with TO_SCREEN=1), in balanced rounds
// (ROUNDS, default 3; the order alternates). Results in test-results/S10A-12-loops.json.
//
//   MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-10a/S10A-12-loops.spec.ts

import { uuidv7 } from "../../src/domain/ids";
import { createRelationship } from "../../src/domain/commands/relationship";
import { resetDevData, seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { generate } from "../../src/data/local/large-generator";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { expect, test, type Page } from "../slice-01a/fixtures";
import { canvasUrl, loadModel, SEED_IDS, store } from "../slice-01a/helpers";
import { MEASURE_USE, saveResults } from "../slice-01b/measure";
import { signInAs } from "../slice-04a/helpers";
import { tracedPan } from "../measure/switches";

test.use(MEASURE_USE);

const WS = LARGE_IDS.workspace;
const ROUNDS = Number(process.env.ROUNDS ?? 3);
type Variant = "none" | "ordinary" | "loops";

/** Test data in the e2e file: relationships between entities of "Performance test", as Łukasz through the domain. */
async function relate(pairs: [string, string][]) {
  const s = store();
  const workspace = (await s.workspaces.get(WS))!;
  const access = { workspace, member: await s.workspaces.getMember(WS, SEED_IDS.userLukasz) };
  const entities = new Map((await loadModel(WS)).entities.map((e) => [e.id, e]));
  for (const [from, to] of pairs) {
    const ctx = { actorId: SEED_IDS.userLukasz, now: new Date().toISOString(), newId: () => uuidv7() };
    const r = createRelationship(ctx, access, { from: entities.get(from)!, to: entities.get(to)! }, { fromEntityId: from, toEntityId: to });
    if (!r.ok) throw new Error(r.error.message);
    const applied = await s.apply(r.writeSet);
    if (!applied.ok) throw new Error(applied.error.message);
  }
}

type L = { layerId: string; width: number; height: number; drawsContent: boolean };

async function layers(page: Page) {
  // CDP's replies, loosely typed (a diagnosis)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Reply = any;
  const cdp = (await page.context().newCDPSession(page)) as unknown as { send: (m: string, x?: unknown) => Promise<Reply>; on: (e: string, f: (x: Reply) => void) => void; detach: () => Promise<void> };
  let list: L[] = [];
  cdp.on("LayerTree.layerTreeDidChange", (e: { layers?: L[] }) => {
    if (e.layers) list = e.layers;
  });
  await cdp.send("DOM.enable");
  await cdp.send("DOM.getDocument", { depth: 0 });
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
    relationshipLines: await page.locator('[data-testid="layer-lines"] [data-testid="line-relationship"]').count(),
  };
}

async function open(page: Page, view: { x: number; y: number; zoom: number }) {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
  await page.goto(canvasUrl(LARGE_IDS.canvas, LARGE_IDS.project, WS));
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

test("S10A-12: 20 loops in view against 20 ordinary relationships and none: drawing layers, elements, pan and zoom as presented frames", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(40 * 60_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  await open(page, { x: 0, y: 0, zoom: 1 });
  const pane = await page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  const ent23 = generate().cards.find((c) => c.id === "ent:23")!;
  const items = (await store().canvasItems.listOfCanvas(WS, LARGE_IDS.canvas)).filter((i) => i.entity_id && i.deleted_at === null);
  // around ent:23, from 30 % down in steps of 5 % until 20 entity cards have their header and the loop's room in view
  const viewAt = (zoom: number) => ({ x: pane.w / 2 - (ent23.x + ent23.w / 2) * zoom, y: pane.h / 2 - (ent23.y + 200) * zoom, zoom });
  const pick = (view: { x: number; y: number; zoom: number }) => {
    const r = { x0: -view.x / view.zoom, y0: -view.y / view.zoom, x1: (pane.w - view.x) / view.zoom, y1: (pane.h - view.y) / view.zoom };
    const c = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
    return items
      .filter((i) => i.x >= r.x0 && i.x + (i.width ?? 280) + 60 <= r.x1 && i.y - 60 >= r.y0 && i.y + 54 <= r.y1)
      .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))
      .slice(0, 20)
      .map((i) => i.entity_id!);
  };
  let zoom = 0.3;
  while (pick(viewAt(zoom)).length < 20 && zoom > 0.1) zoom = +(zoom - 0.05).toFixed(2);
  const view = viewAt(zoom);
  const chosen = pick(view);
  expect(chosen, "20 entity cards in view").toHaveLength(20);

  const prepare = async (v: Variant) => {
    // a fresh file each time: seedLargeData alone keeps an existing "Performance test", rows added before included
    await resetDevData(E2E_DB);
    await seedLargeData(E2E_DB);
    if (v === "loops") await relate(chosen.map((e) => [e, e]));
    if (v === "ordinary") await relate(chosen.map((e, i) => [e, chosen[(i + 1) % chosen.length]!]));
    await open(page, view);
  };

  const reads: Record<string, unknown> = {};
  for (const v of ["none", "ordinary", "loops"] as const) {
    await prepare(v);
    reads[v] = await layers(page);
  }

  const pans: Record<Variant, unknown[]> = { none: [], ordinary: [], loops: [] };
  for (let round = 0; round < ROUNDS; round++) {
    const order: Variant[] = round % 2 === 0 ? ["ordinary", "loops", "none"] : ["loops", "ordinary", "none"];
    for (const v of order) {
      await prepare(v);
      await page.waitForTimeout(1500);
      const traced = await tracedPan(page, `S10A-12 ${v} ${round}`, () => panZoom(page, 10_000));
      pans[v].push({ round, presented: traced.presented, trace: traced.trace });
    }
  }
  expect((reads.none as { relationshipLines: number }).relationshipLines + 20).toBe((reads.loops as { relationshipLines: number }).relationshipLines);
  expect((reads.ordinary as { relationshipLines: number }).relationshipLines).toBe((reads.loops as { relationshipLines: number }).relationshipLines);
  saveResults("S10A-12-loops", { browser: browser.version(), pane, view, entities: chosen.length, reads, pans });
});
