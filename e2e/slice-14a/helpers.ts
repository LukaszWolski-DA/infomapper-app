// Slice 14a's e2e helpers (D-66 on the canvas's queue): frames and cards changed by Anna as another session through the
// domain (the page does not know), and a frame's panel opened from its name on the canvas.

import { expect, type Page } from "@playwright/test";
import { updateCanvasItem } from "../../src/domain/commands/canvas-item";
import { updateFrame } from "../../src/domain/commands/frame";
import { CO, loadFrames, namePoint } from "../slice-02b/helpers";
import { asUser, loadItems, loadModel, RETAIL, SEED_IDS } from "../slice-13/helpers";

export * from "../slice-13/helpers";
export { CO, dragBetween, FRAMED, frameEl, frameNamed, loadFrames, makeFrame, namePoint } from "../slice-02b/helpers";

/** A frame changed by Anna, as another session would (the page does not know). */
export async function changeFrameAsAnna(frameId: string, change: { name?: string; color?: string }, canvasId: string = CO) {
  const model = await loadModel();
  const frame = (await loadFrames(canvasId)).find((f) => f.id === frameId)!;
  await asUser(SEED_IDS.userAnna, (ctx, access) =>
    updateFrame(ctx, access, { frame, concepts: model.concepts, sourceSystems: model.sourceSystems }, { frameId, expectedVersion: frame.version, ...change }),
  );
}

/** A card of an entity collapsed or expanded by Anna (its row's version grows; its place does not change). */
export async function toggleCardAsAnna(name: string, canvasId: string = CO) {
  const entity = (await loadModel()).entities.find((e) => e.name === name)!;
  const item = (await loadItems(RETAIL, canvasId)).find((i) => i.entity_id === entity.id)!;
  await asUser(SEED_IDS.userAnna, (ctx, access) => updateCanvasItem(ctx, access, { item }, { canvasItemId: item.id, expectedVersion: item.version, collapsed: !item.collapsed }));
}

/** A frame's stored row by its id. */
export const frameRow = async (frameId: string, canvasId: string = CO) => (await loadFrames(canvasId)).find((f) => f.id === frameId)!;

/** Selects a frame by a click on its name on the canvas; returns its panel. */
export async function openFrame(page: Page, name: string) {
  const at = await namePoint(page, name);
  await page.mouse.click(at.x, at.y);
  const panel = page.getByTestId("panel-frame");
  await expect(panel).toBeVisible();
  return panel;
}
