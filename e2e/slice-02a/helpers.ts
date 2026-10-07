// Slice 2a's steps build on slice 1b's (real-mouse drags, the toolbox, an empty spot, data made through the domain).
// Added here: Customer & orders seen whole, canvas points on the screen, a lasso with the real mouse, the selection, a
// card's header, and the canvas tab menu.

import { expect, type Page } from "@playwright/test";
import { box, card, SEED_IDS } from "../slice-01b/helpers";

export * from "../slice-01b/helpers";

/** Customer & orders whole on the default 1280 × 720 window, above the 40 % detail limit. */
export const WHOLE = { x: 10, y: 10, zoom: 0.45 };

/** URL of a canvas in a project of Retail Co – DWH. */
export const canvasIn = (projectId: string, canvasId: string) => `/w/${SEED_IDS.wsRetailDwh}/p/${projectId}/c/${canvasId}`;

/** A point of the canvas (canvas coordinates) on the screen, from React Flow's viewport transform. */
export async function screenPoint(page: Page, p: { x: number; y: number }): Promise<{ x: number; y: number }> {
  const pane = await box(page.locator(".react-flow__pane"));
  const t = await page.locator(".react-flow__viewport").evaluate((el) => (el as HTMLElement).style.transform);
  const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/.exec(t)!;
  const [tx, ty, z] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return { x: pane.x + tx + p.x * z, y: pane.y + ty + p.y * z };
}

/** A left drag with the real mouse between two canvas points (a lasso when it starts on the empty canvas). */
export async function lasso(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, options?: { shift?: boolean }) {
  const a = await screenPoint(page, from), b = await screenPoint(page, to);
  if (options?.shift) await page.keyboard.down("Shift");
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
  await page.mouse.up();
  if (options?.shift) await page.keyboard.up("Shift");
}

/** The names of the selected cards, from the selection panel (two or more selected). */
export const selectedNames = (page: Page) => page.getByTestId("selection-item").allInnerTexts().then((xs) => xs.map((x) => x.split("\n")[0]!.trim()).sort());

/** A point on a card's header, left of its tools. */
export async function headPoint(page: Page, name: string): Promise<{ x: number; y: number }> {
  const head = await box(card(page, name).locator(".c-head .c-l2"));
  return { x: head.x + Math.min(40, head.width / 3), y: head.y + head.height / 2 };
}

/** Drags a card by its header with the real mouse by (dx, dy) screen pixels. */
export async function dragCardBy(page: Page, name: string, dx: number, dy: number) {
  const at = await headPoint(page, name);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(at.x + (dx * i) / 10, at.y + (dy * i) / 10);
  await page.mouse.up();
}

/** A canvas tab by its exact name. */
export const canvasTab = (page: Page, canvasName: string) =>
  page.getByTestId("tab-canvas").filter({ has: page.getByTestId("tab-canvas-name").getByText(canvasName, { exact: true }) });

/** Opens a canvas tab's ⋯ menu. */
export async function openCanvasMenu(page: Page, canvasName: string) {
  const tab = canvasTab(page, canvasName);
  await tab.hover();
  await tab.getByTestId("button-canvas-menu").click();
  await expect(page.getByTestId("menu-canvas")).toBeVisible();
  return page.getByTestId("menu-canvas");
}

/** The tab names of the open project, in order. */
export const tabNames = (page: Page) => page.getByTestId("tab-canvas-name").allInnerTexts();

/** Ctrl+Z and friends act outside text fields: leave the field first, as a person would. */
export async function key(page: Page, keys: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(keys);
}

/** Waits until a card is drawn at a canvas position (after a write or an undo, the page follows the data). */
export async function expectDrawnAt(page: Page, name: string, at: { x: number; y: number }) {
  await expect
    .poll(async () => {
      const drawn = await box(card(page, name).locator("[data-card]"));
      const want = await screenPoint(page, at);
      return Math.abs(drawn.x - want.x) < 2 && Math.abs(drawn.y - want.y) < 2;
    }, `${name} drawn at ${at.x}, ${at.y}`)
    .toBe(true);
}
