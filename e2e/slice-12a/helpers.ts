// Slice 12a's steps: Undo and Redo on the home pages (step 3). The earlier slices' helpers come through slice 11's.

import { expect, type Page } from "@playwright/test";
import { createNote } from "../../src/domain/commands/note";
import { setLabelPinned } from "../../src/domain/commands/label";
import { makeFrame } from "../slice-02b/helpers";
import { labelNamed, rawDb } from "../slice-03a/helpers";
import { asLukasz, box, card, loadItems, loadModel, placeReqCards, RETAIL, SEED_IDS, store } from "../slice-11/helpers";

export * from "../slice-11/helpers";
export { archive } from "../slice-07a/helpers";
export { backButton, expectAt, WS_HOME } from "../slice-06b/helpers";
export { labelNamed, loadPins, rawDb } from "../slice-03a/helpers";

/** The top bar's Undo and Redo. */
export const undoButton = (page: Page) => page.getByTestId("button-undo");
export const redoButton = (page: Page) => page.getByTestId("button-redo");

/** Ctrl+Z and Ctrl+Shift+Z act outside text fields: leave the field first, as a person would. */
export async function key(page: Page, keys: string): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(keys);
}

/** Order management's home, besides Customer 360's (`projectHome`). */
export const OM_HOME = `/w/${RETAIL}/p/${SEED_IDS.projOrderManagement}`;

/** Drags a card on the open canvas by its header, up by 80 px; resolves once the move is stored. Returns the card's y before. */
export async function moveCardUp(page: Page, name: string, canvasId: string = SEED_IDS.canvasCustomerOrders): Promise<{ id: string; y: number }> {
  const before = await cardRow(name, canvasId);
  const head = await box(card(page, name).locator(".c-head .c-l2"));
  await page.mouse.move(head.x + head.width / 3, head.y + head.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(head.x + head.width / 3, head.y + head.height / 2 - i * 10);
  await page.mouse.up();
  await expect.poll(async () => (await loadItems(RETAIL, canvasId)).find((i) => i.id === before.id)!.y).not.toBe(before.y);
  return { id: before.id, y: before.y };
}

/** A card's stored row on a canvas, by the name of its entity. */
async function cardRow(name: string, canvasId: string) {
  const entity = (await loadModel()).entities.find((e) => e.name === name)!;
  return (await loadItems(RETAIL, canvasId)).find((i) => i.entity_id === entity.id)!;
}

/** The stored y of a card. */
export const yOf = async (itemId: string, canvasId: string = SEED_IDS.canvasCustomerOrders) => (await loadItems(RETAIL, canvasId)).find((i) => i.id === itemId)!.y;

// ---- deleting a project (step 4) ----

/** Order management: "Order lines & products" is only its own, "Customer & orders" is shared with Customer 360. */
export const OM = SEED_IDS.projOrderManagement;
export const OWN = SEED_IDS.canvasOrderLines;
export const SHARED = SEED_IDS.canvasCustomerOrders;

/** Gives Order management's own canvas a frame, a note and a requirement card, and pins CR-23 to the project. */
export async function furnishOrderManagement(): Promise<void> {
  await makeFrame({ x: 40, y: 1200, width: 400, height: 200 }, { name: "Spare", canvasId: OWN });
  await placeReqCards([{ key: "REQ-104", x: 40, y: 900 }], OWN);
  const s = store();
  const [canvas, items, frames, notes] = await Promise.all([s.canvases.get(RETAIL, OWN), s.canvasItems.listOfCanvas(RETAIL, OWN), s.frames.listOfCanvas(RETAIL, OWN), s.notes.listOfCanvas(RETAIL, OWN)]);
  await asLukasz((ctx, access) => createNote(ctx, access, { canvas, items, frames, notes }, { canvasId: OWN, text: "Check the ERP export", x: 900, y: 1200 }));
  const [project, label, pins] = await Promise.all([s.projects.get(RETAIL, OM), labelNamed("CR-23"), s.labels.listPins(RETAIL)]);
  await asLukasz((ctx, access) => setLabelPinned(ctx, access, { project, label: label ?? null, pins: pins.filter((p) => p.project_id === OM) }, { projectId: OM, labelId: label!.id, pinned: true }));
}

/** Every row of the e2e data file that is on a canvas, deleted or not, per table. */
export async function rowsOn(canvasId: string) {
  const db = await rawDb();
  return {
    items: db.canvas_item.filter((i) => i.canvas_id === canvasId),
    frames: db.frame.filter((f) => f.canvas_id === canvasId),
    notes: db.note.filter((n) => n.canvas_id === canvasId),
  };
}

/** The delete section on a project home, its button and its text. */
export const deleteSection = (page: Page) => page.getByTestId("section-project-delete");
export const deleteButton = (page: Page) => page.getByTestId("button-delete-project");
export const deleteText = (page: Page) => page.getByTestId("text-project-delete");
