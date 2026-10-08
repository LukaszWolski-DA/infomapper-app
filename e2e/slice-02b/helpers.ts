// Slice 2b's steps build on slice 2a's (lasso, canvas points, group drags, the tab menu, Ctrl+Z outside fields).
// Added here: frames on the page and in the data, frames made through the domain as test data, a point on a frame's
// name or on an empty spot inside it, a real-mouse drag between two screen points, and cards by name in the data.

import { expect, type Page } from "@playwright/test";
import { placeOnCanvas } from "../../src/domain/commands/canvas-item";
import { createFrame, updateFrame } from "../../src/domain/commands/frame";
import type { Frame, WorkspaceModel } from "../../src/domain/types";
import { newCardHeight } from "../../src/canvas/geometry";
import { asLukasz, box, loadItems, loadModel, RETAIL, SEED_IDS, store } from "../slice-02a/helpers";

export * from "../slice-02a/helpers";

export const CO = SEED_IDS.canvasCustomerOrders;

/** Customer & orders whole, as slice 2a's WHOLE, with room above for the name of a frame at the top (y 0). */
export const FRAMED = { x: 10, y: 60, zoom: 0.45 };
export type Pt = { x: number; y: number };

/** A frame on the page by its name. */
export const frameEl = (page: Page, name: string) => page.getByTestId("frame").filter({ has: page.getByTestId("frame-name").getByText(name, { exact: true }) });

/** The live frames of a canvas, from the e2e data file. */
export async function loadFrames(canvasId: string = CO): Promise<Frame[]> {
  return (await store().frames.listOfCanvas(RETAIL, canvasId)).filter((f) => f.deleted_at === null);
}
export const frameNamed = async (name: string, canvasId: string = CO) => (await loadFrames(canvasId)).find((f) => f.name === name);

/** The height a fully shown card of this item has (every row visible), as the canvas computes it. */
export function heightOf(model: WorkspaceModel, item: { entity_id: string | null; source_table_id: string | null }): number {
  const rows = item.entity_id
    ? model.attributes.filter((a) => a.entity_id === item.entity_id).length
    : model.sourceColumns.filter((c) => c.source_table_id === item.source_table_id).length;
  return newCardHeight(rows);
}

/** A card of Customer & orders (or another canvas) in the data, by the name of its entity or table, with its height. */
export async function item(name: string, canvasId: string = CO) {
  const model = await loadModel();
  const entity = model.entities.find((e) => e.name === name);
  const table = model.sourceTables.find((t) => t.name === name);
  const found = (await loadItems(RETAIL, canvasId)).find((i) => (entity && i.entity_id === entity.id) || (table && i.source_table_id === table.id));
  expect(found, `${name} on the canvas`).toBeDefined();
  return { ...found!, height: heightOf(model, found!) };
}

/**
 * Test data: a frame drawn through the domain, as the Frame tool would (it takes the free cards fully inside it), then
 * named and made to stand for a concept or a source system when asked. Returns its id.
 */
export async function makeFrame(
  rect: { x: number; y: number; width: number; height: number },
  options: { name?: string; concept?: string; system?: string; canvasId?: string } = {},
): Promise<string> {
  const canvasId = options.canvasId ?? CO;
  const s = store();
  const model = await loadModel();
  const items = await loadItems(RETAIL, canvasId);
  const state = { canvas: await s.canvases.get(RETAIL, canvasId), frames: await s.frames.listOfCanvas(RETAIL, canvasId), items };
  const cards = items.map((i) => ({ canvasItemId: i.id, expectedVersion: i.version, height: heightOf(model, i) }));
  const { frameId } = await asLukasz((ctx, access) => createFrame(ctx, access, state, { canvasId, ...rect, cards }));
  if (options.name || options.concept || options.system) {
    const frame = (await s.frames.listOfCanvas(RETAIL, canvasId)).find((f) => f.id === frameId)!;
    const conceptId = options.concept ? model.concepts.find((c) => c.name === options.concept)!.id : undefined;
    const sourceSystemId = options.system ? model.sourceSystems.find((x) => x.name === options.system)!.id : undefined;
    await asLukasz((ctx, access) =>
      updateFrame(ctx, access, { frame, concepts: model.concepts, sourceSystems: model.sourceSystems }, {
        frameId,
        expectedVersion: frame.version,
        ...(options.name ? { name: options.name } : {}),
        ...(conceptId ? { kind: "concept", conceptId } : {}),
        ...(sourceSystemId ? { kind: "source_system", sourceSystemId } : {}),
      }),
    );
  }
  return frameId;
}

/** Test data: an entity or a table placed on a canvas through the domain (in no frame). */
export async function place(name: string, at: Pt, canvasId: string = CO): Promise<string> {
  const s = store();
  const model = await loadModel();
  const entity = model.entities.find((e) => e.name === name) ?? null;
  const sourceTable = model.sourceTables.find((t) => t.name === name) ?? null;
  const state = { canvas: await s.canvases.get(RETAIL, canvasId), entity, sourceTable, items: await loadItems(RETAIL, canvasId) };
  const target = entity ? { entityId: entity.id } : { sourceTableId: sourceTable!.id };
  return (await asLukasz((ctx, access) => placeOnCanvas(ctx, access, state, { canvasId, ...target, ...at, frames: [] }))).canvasItemId;
}

/** The middle of a frame's name in its label. */
export async function namePoint(page: Page, name: string): Promise<Pt> {
  const b = await box(frameEl(page, name).getByTestId("frame-name"));
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** A point on an empty spot inside a frame: the frame itself is under it (no card, line or label), searched on a grid. */
export async function emptyIn(page: Page, name: string): Promise<Pt> {
  const spot = await frameEl(page, name).evaluate((frame) => {
    const r = frame.getBoundingClientRect();
    for (let y = r.top + 12; y < r.bottom - 12; y += 6) {
      for (let x = r.left + 6; x < r.right - 20; x += 6) {
        if (document.elementFromPoint(x, y) === frame) return { x, y };
      }
    }
    return null;
  });
  expect(spot, `an empty spot inside the frame ${name}`).not.toBeNull();
  return spot!;
}

/** A drag with the real mouse between two screen points, in small steps (left button unless told otherwise). */
export async function dragBetween(page: Page, a: Pt, b: Pt, options: { button?: "left" | "right" | "middle"; shift?: boolean } = {}) {
  if (options.shift) await page.keyboard.down("Shift");
  await page.mouse.move(a.x, a.y);
  await page.mouse.down({ button: options.button ?? "left" });
  for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
  await page.mouse.up({ button: options.button ?? "left" });
  if (options.shift) await page.keyboard.up("Shift");
}

/** Opens the toolbox with a right-click and returns its actions' labels (a frame's actions have their own test ids). */
export async function toolboxLabels(page: Page, point: Pt): Promise<string[]> {
  await page.mouse.click(point.x, point.y, { button: "right" });
  const menu = page.getByTestId("menu-toolbox");
  await expect(menu).toBeVisible();
  return menu.locator("[role^=menuitem] span.min-w-0").allInnerTexts();
}

/** A Shift+click with the real mouse. */
export async function shiftClick(page: Page, at: Pt) {
  await page.keyboard.down("Shift");
  await page.mouse.click(at.x, at.y);
  await page.keyboard.up("Shift");
}

/** React Flow's viewport transform (pan and zoom), as drawn. */
export const viewOf = (page: Page) => page.locator(".react-flow__viewport").evaluate((e) => (e as HTMLElement).style.transform);

/** The selection marks: frames and cards. */
export const frameMarks = (page: Page) => page.getByTestId("mark-selected-frame");
export const cardMarks = (page: Page) => page.getByTestId("mark-selected");
