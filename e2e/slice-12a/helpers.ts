// Slice 12a's steps: Undo and Redo on the home pages (step 3). The earlier slices' helpers come through slice 11's.

import { expect, type Page } from "@playwright/test";
import { box, card, loadItems, loadModel, RETAIL, SEED_IDS } from "../slice-11/helpers";

export * from "../slice-11/helpers";
export { archive } from "../slice-07a/helpers";
export { expectAt, WS_HOME } from "../slice-06b/helpers";
export { labelNamed, loadPins } from "../slice-03a/helpers";

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
