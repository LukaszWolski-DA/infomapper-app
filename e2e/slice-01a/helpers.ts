// Shared steps for slice 1a: open a canvas at a given view, read the model from the e2e data file, find cards, rows
// and lines, and measure where a line's ends are on the screen.

import { expect, type Locator, type Page } from "@playwright/test";
import { SEED_IDS } from "../../src/data/local/seed";
import { createLocalDataStore } from "../../src/data/local/store";
import type { WorkspaceModel } from "../../src/domain/types";
import { E2E_DB } from "../config";

export { SEED_IDS };
export { callActionDirectly, captureActionId, expectToast, newSession, signInAs } from "../slice-00/helpers";

export const RETAIL = SEED_IDS.wsRetailDwh;
export const canvasUrl = (canvasId: string = SEED_IDS.canvasCustomerOrders, projectId: string = SEED_IDS.projCustomer360, ws: string = RETAIL) =>
  `/w/${ws}/p/${projectId}/c/${canvasId}`;

/** The live model and cards in the e2e data file, as the server sees them. */
export async function loadModel(ws: string = RETAIL): Promise<WorkspaceModel> {
  return createLocalDataStore(E2E_DB).model.load(ws);
}
export async function loadItems(ws: string = RETAIL, canvasId: string = SEED_IDS.canvasCustomerOrders) {
  return createLocalDataStore(E2E_DB).canvasItems.listOfCanvas(ws, canvasId);
}
export const store = () => createLocalDataStore(E2E_DB);

/**
 * Opens a canvas. With a view, it is stored as the canvas's remembered view first (data model section 12), so the
 * canvas opens exactly there.
 */
export async function openCanvas(page: Page, url = canvasUrl(), view?: { x: number; y: number; zoom: number }) {
  if (view) {
    const canvasId = url.split("/c/")[1]!;
    await page.goto("/sign-in"); // any page of the app, to reach its localStorage
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${canvasId}`, JSON.stringify(view)] as const);
  }
  await page.goto(url);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
}

export const card = (page: Page, name: string) => page.locator(".react-flow__node").filter({ has: page.getByTestId("card-name").getByText(name, { exact: true }) });
export const cardEl = (page: Page, name: string) => card(page, name).locator("[data-card]");
export const row = (page: Page, cardName: string, rowId: string) => card(page, cardName).locator(`[data-row="${rowId}"]`);
export const mappingLine = (page: Page, mappingId: string) => page.locator(`[data-testid="line-mapping"][data-mapping="${mappingId}"]`);
export const treeItem = (page: Page, name: string) => page.getByTestId("tree-item").filter({ has: page.getByText(name, { exact: true }) });

/** The canvas's zoom, from React Flow's viewport transform. */
export async function zoomOf(page: Page): Promise<number> {
  const t = await page.locator(".react-flow__viewport").evaluate((el) => (el as HTMLElement).style.transform);
  return Number(/scale\(([\d.]+)\)/.exec(t)![1]);
}

/** Screen points where the drawn paths of a line start and end (each `s` path: first and last point). */
export async function lineEnds(line: Locator): Promise<{ start: { x: number; y: number }; end: { x: number; y: number } }[]> {
  return line.locator("path.s").evaluateAll((paths) =>
    (paths as SVGPathElement[]).map((p) => {
      const m = p.getScreenCTM()!;
      const at = (len: number) => {
        const q = p.getPointAtLength(len);
        return { x: q.x * m.a + q.y * m.c + m.e, y: q.x * m.b + q.y * m.d + m.f };
      };
      return { start: at(0), end: at(p.getTotalLength()) };
    }),
  );
}

export type Box = { x: number; y: number; width: number; height: number };
export const box = async (l: Locator): Promise<Box> => (await l.boundingBox())!;

/** A row's middle relative to its card's top, in canvas units (the same at every zoom level). */
export const rowMiddle = (cardBox: Box, rowBox: Box, zoom: number) => (rowBox.y + rowBox.height / 2 - cardBox.y) / zoom;

/** The header's middle, where the line of a hidden row ends (prototype: 27 px below the card's top). */
export const HEADER_MIDDLE = 27;

/** Drag the header of a card by (dx, dy) screen pixels with the real mouse. */
export async function dragCard(page: Page, name: string, dx: number, dy: number) {
  const head = card(page, name).locator(".c-head .c-l2");
  const b = await box(head);
  const from = { x: b.x + b.width / 3, y: b.y + b.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + (dx * i) / 10, from.y + (dy * i) / 10);
  await page.mouse.up();
}

/** Picks an option of a native select by the start of its text. */
export async function pickOption(select: Locator, startsWith: string) {
  const value = await select.evaluate(
    (el, s) => [...(el as HTMLSelectElement).options].find((o) => o.text.startsWith(s))?.value ?? "",
    startsWith,
  );
  expect(value, `option starting with "${startsWith}"`).not.toBe("");
  await select.selectOption(value);
}

/**
 * Every mapping line on Customer & orders has an end on each of its rows (its input columns and its attribute), on the
 * card's left or right edge; a direct line uses the sides that face each other. Row positions are read from the rows
 * at 100%, then checked at the given zoom (below 40% the rows are not drawn, the ends must still be there).
 */
export async function expectLineEndsOnRows(page: Page, zoom: number) {
  const model = await loadModel();
  const items = await loadItems();
  const cardOf = new Map(items.map((i) => [(i.entity_id ?? i.source_table_id)!, i.id]));
  const tableOf = new Map(model.sourceColumns.map((c) => [c.id, c.source_table_id]));
  const entityOf = new Map(model.attributes.map((a) => [a.id, a.entity_id]));

  // the anchors of each drawn mapping: its input columns' rows and its attribute's row
  type Anchor = { cardId: string; rowId: string };
  const lines = model.mappings
    .map((m) => ({
      id: m.id,
      attribute: { cardId: cardOf.get(entityOf.get(m.attribute_id)!)!, rowId: m.attribute_id },
      inputs: model.mappingInputs
        .filter((i) => i.mapping_id === m.id)
        .map((i) => ({ cardId: cardOf.get(tableOf.get(i.source_column_id)!)!, rowId: i.source_column_id })),
    }))
    .filter((l) => l.attribute.cardId && l.inputs.some((i) => i.cardId))
    .map((l) => ({ ...l, inputs: l.inputs.filter((i) => i.cardId) }));
  expect(lines.length).toBeGreaterThan(5);

  // where each row's middle is on its card, in canvas units, read at 100% from the rows themselves
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 1 });
  const middle = new Map<string, number>();
  for (const l of lines) {
    for (const a of [l.attribute, ...l.inputs]) {
      const c = await box(page.locator(`[data-card="${a.cardId}"]`));
      middle.set(`${a.cardId}/${a.rowId}`, rowMiddle(c, await box(page.locator(`[data-card="${a.cardId}"] [data-row="${a.rowId}"]`)), 1));
    }
  }

  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom });
  const cards = new Map<string, Box>();
  for (const i of items) cards.set(i.id, await box(page.locator(`[data-card="${i.id}"]`)));
  const tol = 1.5;

  for (const l of lines) {
    const ends = (await lineEnds(mappingLine(page, l.id))).flatMap((e) => [e.start, e.end]);
    const hits = (a: Anchor) => {
      const c = cards.get(a.cardId)!;
      const y = c.y + middle.get(`${a.cardId}/${a.rowId}`)! * zoom;
      return ends.find((p) => Math.abs(p.y - y) < tol && (Math.abs(p.x - c.x) < tol || Math.abs(p.x - (c.x + c.width)) < tol));
    };
    for (const a of [l.attribute, ...l.inputs]) {
      expect(hits(a), `mapping ${l.id} at ${zoom * 100}%: an end on row ${a.rowId}`).toBeTruthy();
    }
    // a direct line leaves and enters on the sides that face each other
    if (l.inputs.length === 1) {
      const from = cards.get(l.inputs[0]!.cardId)!, to = cards.get(l.attribute.cardId)!;
      const start = hits(l.inputs[0]!)!, end = hits(l.attribute)!;
      if (from.x + from.width <= to.x) {
        expect(Math.abs(start.x - (from.x + from.width))).toBeLessThan(tol);
        expect(Math.abs(end.x - to.x)).toBeLessThan(tol);
      } else if (to.x + to.width <= from.x) {
        expect(Math.abs(start.x - from.x)).toBeLessThan(tol);
        expect(Math.abs(end.x - (to.x + to.width))).toBeLessThan(tol);
      }
    }
  }
}
