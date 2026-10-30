// S10B-10's branch-only reads (slice 10b, PRD section 6; measurement build only): on "Performance test" ("100 cards"),
// a view around ent:23 (30 %, or lower until 20 entity cards and 20 table cards are in view), with 20 relationships
// between source tables (each of 20 table cards to the next), against 20 ordinary relationships (each of 20 entity cards
// to the next), against neither. The rows go into the e2e data file through the local adapter before the page opens (A4,
// step 1 answer 6: never .data/dev-db.json, no seed:large option). Per variant: the drawing layers (CDP LayerTree, as
// S10A-12) and the elements; then pan and zoom as presented frames (traced, as S1A-14 with TO_SCREEN=1), in balanced
// rounds (ROUNDS, default 3; the order alternates). Results in test-results/S10B-10-lines.json.
//
//   MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-10b/S10B-10-lines.spec.ts

import { buildWriteSet } from "../../src/domain/changes";
import { uuidv7 } from "../../src/domain/ids";
import { createRelationship } from "../../src/domain/commands/relationship";
import type { Write } from "../../src/domain/changes";
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
type Variant = "none" | "ordinary" | "sources";

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

/**
 * Test data in the e2e file: foreign keys between source tables of "Performance test", one change group written through
 * the local adapter (no command writes them: only an import does). Each key pairs the from table's second column with
 * the to table's first.
 */
async function sourceKeys(pairs: [string, string][]) {
  const columns = (await loadModel(WS)).sourceColumns;
  const columnOf = (table: string, ordinal: number) => columns.find((c) => c.source_table_id === table && c.ordinal === ordinal)!.id;
  const ctx = { actorId: SEED_IDS.userLukasz, now: new Date().toISOString(), newId: () => uuidv7() };
  const std = () => ({ id: ctx.newId(), workspace_id: WS, version: 1, created_at: ctx.now, created_by: ctx.actorId, updated_at: ctx.now, updated_by: ctx.actorId, deleted_at: null });
  const writes: Write[] = [];
  pairs.forEach(([from, to], n) => {
    const rel = { ...std(), source_table_id: from, to_source_table_id: to, name: `FK_measure_${n}`, kind: "declared" as const, missing_since: null };
    writes.push({ kind: "insert", table: "source_relationship", row: rel });
    writes.push({ kind: "insert", table: "source_relationship_column", row: { ...std(), source_relationship_id: rel.id, from_column_id: columnOf(from, 2), to_column_id: columnOf(to, 1), sort_order: 0 } });
  });
  const applied = await store().apply(buildWriteSet(ctx, WS, writes));
  if (!applied.ok) throw new Error(applied.error.message);
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
    sourceLines: await page.locator('[data-testid="layer-lines"] [data-testid="line-source"]').count(),
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

test("S10B-10: 20 source relationships in view against 20 ordinary relationships and none: drawing layers, elements, pan and zoom as presented frames", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(40 * 60_000);
  await resetDevData(E2E_DB);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  await open(page, { x: 0, y: 0, zoom: 1 });
  const pane = await page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  const ent23 = generate().cards.find((c) => c.id === "ent:23")!;
  const items = (await store().canvasItems.listOfCanvas(WS, LARGE_IDS.canvas)).filter((i) => i.deleted_at === null);
  // around ent:23, from 30 % down in steps of 5 % until 20 entity and 20 table cards have their header in view
  const viewAt = (zoom: number) => ({ x: pane.w / 2 - (ent23.x + ent23.w / 2) * zoom, y: pane.h / 2 - (ent23.y + 200) * zoom, zoom });
  const pick = (view: { x: number; y: number; zoom: number }, kind: "entity" | "table") => {
    const r = { x0: -view.x / view.zoom, y0: -view.y / view.zoom, x1: (pane.w - view.x) / view.zoom, y1: (pane.h - view.y) / view.zoom };
    const c = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
    return items
      .filter((i) => (kind === "entity" ? i.entity_id : i.source_table_id))
      .filter((i) => i.x >= r.x0 && i.x + (i.width ?? 280) + 60 <= r.x1 && i.y - 60 >= r.y0 && i.y + 54 <= r.y1)
      .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))
      .slice(0, 20)
      .map((i) => (kind === "entity" ? i.entity_id! : i.source_table_id!));
  };
  let zoom = 0.3;
  while ((pick(viewAt(zoom), "entity").length < 20 || pick(viewAt(zoom), "table").length < 20) && zoom > 0.1) zoom = +(zoom - 0.05).toFixed(2);
  const view = viewAt(zoom);
  const entities = pick(view, "entity"), tables = pick(view, "table");
  expect(entities, "20 entity cards in view").toHaveLength(20);
  expect(tables, "20 table cards in view").toHaveLength(20);
  const ring = (ids: string[]) => ids.map((e, i) => [e, ids[(i + 1) % ids.length]!] as [string, string]);

  const prepare = async (v: Variant) => {
    // a fresh file each time: seedLargeData alone keeps an existing "Performance test", rows added before included
    await resetDevData(E2E_DB);
    await seedLargeData(E2E_DB);
    if (v === "ordinary") await relate(ring(entities));
    if (v === "sources") await sourceKeys(ring(tables));
    await open(page, view);
  };

  const reads: Record<string, Awaited<ReturnType<typeof layers>>> = {};
  for (const v of ["none", "ordinary", "sources"] as const) {
    await prepare(v);
    reads[v] = await layers(page);
  }
  expect(reads.sources!.sourceLines).toBe(20);
  expect(reads.none!.sourceLines).toBe(0);
  expect(reads.ordinary!.relationshipLines).toBe(reads.none!.relationshipLines + 20);

  const pans: Record<Variant, unknown[]> = { none: [], ordinary: [], sources: [] };
  for (let round = 0; round < ROUNDS; round++) {
    const order: Variant[] = round % 2 === 0 ? ["ordinary", "sources", "none"] : ["sources", "ordinary", "none"];
    for (const v of order) {
      await prepare(v);
      await page.waitForTimeout(1500);
      const traced = await tracedPan(page, `S10B-10 ${v} ${round}`, () => panZoom(page, 10_000));
      pans[v].push({ round, presented: traced.presented, trace: traced.trace });
    }
  }
  saveResults("S10B-10-lines", { browser: browser.version(), pane, view, entities: entities.length, tables: tables.length, reads, pans });
});
