// Slice 14b's e2e helpers (the canvas's row on the save chain): the canvas tabs' rename, the tab menu, and a canvas's
// stored row. The earlier slices' helpers come through slice 14a's.

import { expect, type Page } from "@playwright/test";
import { renameCanvas, setCanvasLook } from "../../src/domain/commands/canvas";
import type { CanvasBackground, CanvasGrid } from "../../src/domain/types";
import { canvasTab } from "../slice-02a/helpers";
import { asUser, rawDb, RETAIL, SEED_IDS, store } from "../slice-14a/helpers";

export * from "../slice-14a/helpers";
export { canvasIn, canvasTab, openCanvasMenu, tabNames } from "../slice-02a/helpers";

/** A canvas's stored row by its id, deleted or not. */
export const canvasStored = async (canvasId: string) => (await rawDb()).canvas.find((c) => c.id === canvasId)!;

/** Opens the rename field of a canvas's tab with a double-click; returns the field. */
export async function startRename(page: Page, canvasName: string) {
  await canvasTab(page, canvasName).dblclick();
  const field = page.getByTestId("input-canvas-name");
  await expect(field).toBeFocused();
  return field;
}

/** Renames a canvas in its tab: double-click, the new name, Enter. */
export async function renameInTab(page: Page, canvasName: string, name: string): Promise<void> {
  const field = await startRename(page, canvasName);
  await field.fill(name);
  await field.press("Enter");
}

/** A canvas renamed by Anna, as another session would (the page does not know). */
export async function renameCanvasElsewhere(canvasId: string, name: string): Promise<void> {
  const canvas = (await store().canvases.get(RETAIL, canvasId))!;
  await asUser(SEED_IDS.userAnna, (ctx, access) => renameCanvas(ctx, access, { canvas }, { canvasId, expectedVersion: canvas.version, name }));
}

/** A canvas's look changed by Anna, as another session would: only the row's version and its look change. */
export async function changeCanvasLookElsewhere(canvasId: string, look: { background?: CanvasBackground; grid?: CanvasGrid }): Promise<void> {
  const canvas = (await store().canvases.get(RETAIL, canvasId))!;
  await asUser(SEED_IDS.userAnna, (ctx, access) => setCanvasLook(ctx, access, { canvas }, { canvasId, expectedVersion: canvas.version, ...look }));
}

/** The tab of a canvas whose field is open (it shows no name then): the one holding the rename field. */
export const renamingTab = (page: Page) => page.getByTestId("tab-canvas").filter({ has: page.getByTestId("input-canvas-name") });
