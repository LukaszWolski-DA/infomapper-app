// Slice 16's e2e helpers: the earlier slices' steps it uses (through slice 15a's chain, with the Sales star's ids), the
// stored view of a canvas (step 2), the project's tab order and a canvas's look in the data, a third canvas as test
// data, and the browser's context menu: whether a right click was cancelled (`defaultPrevented`).

import { createCanvas } from "../../src/domain/commands/canvas";
import type { CanvasLook } from "../../src/domain/types";
import { asLukasz, RETAIL, SEED_IDS, store } from "../slice-01b/helpers";
import { expect, type Page } from "./fixtures";

export * from "../slice-15a/helpers";
export { dragBetween, emptyIn, FRAMED, frameNamed, makeFrame, viewOf } from "../slice-02b/helpers";
export { canvasTab, openCanvasMenu, tabNames } from "../slice-02a/helpers";
export { collapse, bundles, lineLayer } from "../slice-02c/helpers";
export { sourceLines } from "../slice-10b/helpers";
export { copyRow, headOf } from "../slice-10c/helpers";
export { menuOn, selfRelationship } from "../slice-10a/helpers";
export { archive } from "../slice-07a/helpers";
export { chip, chipOff, expectChips } from "../slice-06a/helpers";
export { undoButton } from "../slice-12a/helpers";
export { canvasArea, cardAt, expectCardAt, togglePanel, viewportTransform } from "../slice-05a/helpers";
export { contextOn } from "../slice-03b/helpers";

export type StoredView = { x: number; y: number; zoom: number; left?: number };

/** The canvas's remembered view as stored in the browser (D-54), or null. */
export const storedView = (page: Page, canvasId: string) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null") as StoredView | null, `infomapper:view:${canvasId}`);

/**
 * The stored view matches the view shown and the canvas's left edge now (slice 16, item 6), read once: no waiting for
 * React Flow's timer.
 */
export async function expectStoredNow(page: Page, canvasId: string): Promise<void> {
  const v = await storedView(page, canvasId);
  const shown = await page.locator(".react-flow__viewport").evaluate((el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: m.e, y: m.f, zoom: m.a };
  });
  const left = Math.round((await page.getByTestId("area-canvas").boundingBox())!.x);
  expect(v, "a stored view").not.toBeNull();
  expect(v!.left, "the left edge").toBe(left);
  expect(Math.abs(v!.x - shown.x), `x ${v!.x} against ${shown.x}`).toBeLessThan(0.5);
  expect(Math.abs(v!.y - shown.y), `y ${v!.y} against ${shown.y}`).toBeLessThan(0.5);
  expect(Math.abs(v!.zoom - shown.zoom), "zoom").toBeLessThan(1e-3);
}

// ---- step 3 ----

export const OM_PROJECT = SEED_IDS.projOrderManagement;
export const C360_PROJECT = SEED_IDS.projCustomer360;
export const OM_URL = (canvasId: string = SEED_IDS.canvasCustomerOrders) => `/w/${RETAIL}/p/${OM_PROJECT}/c/${canvasId}`;
export const THIRD = "Third canvas";

/** Test data: a third canvas in Order management, as its last tab (Customer & orders, Order lines & products, it). */
export async function thirdCanvas(): Promise<string> {
  const s = store();
  const project = await s.projects.get(RETAIL, OM_PROJECT);
  const projectLinks = await s.canvases.listLinksOfProject(RETAIL, OM_PROJECT);
  return (await asLukasz((ctx, access) => createCanvas(ctx, access, { project, projectLinks }, { projectId: OM_PROJECT, name: THIRD }))).canvasId;
}

/** A project's canvas names in its tab order, from the data. */
export async function orderOf(projectId: string): Promise<string[]> {
  const s = store();
  const links = await s.canvases.listLinksOfProject(RETAIL, projectId);
  const canvases = await s.canvases.list(RETAIL);
  return links.map((l) => canvases.find((c) => c.id === l.canvas_id)!.name);
}

/** A canvas's stored look. */
export const lookOf = async (canvasId: string): Promise<CanvasLook> => (await store().canvases.get(RETAIL, canvasId))!.look;

/** Records every `contextmenu` the page sees, after the document's own listeners (on window, bubbling). */
export async function recordContextMenus(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __imMenus: boolean[] };
    w.__imMenus = [];
    window.addEventListener("contextmenu", (e) => w.__imMenus.push(e.defaultPrevented));
  });
}

/** Right-clicks a point and returns whether the browser's menu was cancelled there. */
export async function cancelledAt(page: Page, at: { x: number; y: number }): Promise<boolean> {
  const before = await page.evaluate(() => (window as unknown as { __imMenus: boolean[] }).__imMenus.length);
  await page.mouse.click(at.x, at.y, { button: "right" });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __imMenus: boolean[] }).__imMenus.length)).toBe(before + 1);
  return page.evaluate(() => (window as unknown as { __imMenus: boolean[] }).__imMenus.at(-1)!);
}
