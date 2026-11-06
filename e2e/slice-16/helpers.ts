// Slice 16's e2e helpers: the earlier slices' steps it uses, and the stored view of a canvas.

import { expect, type Page } from "./fixtures";

export { dragBetween, emptyIn, FRAMED, frameNamed, makeFrame, viewOf } from "../slice-02b/helpers";
export {
  box,
  canvasArea,
  canvasUrl,
  cardAt,
  CO,
  contextOn,
  expectCardAt,
  openCanvas,
  signInAs,
  togglePanel,
  viewportTransform,
  WHOLE_CO,
} from "../slice-06a/helpers";

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
