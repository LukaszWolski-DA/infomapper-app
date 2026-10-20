// Slice 5a's e2e helpers: the side panels' buttons and state, the canvas's box, a card's place on the screen and the
// cookie that keeps the layout (`im-panels.<userId>`, `src/ui/side-panels-cookie.ts`).

import { expect, type Page } from "./fixtures";
import { SEED_IDS, box, card } from "../slice-04b2/helpers";

export * from "../slice-04b2/helpers";

export type Side = "left" | "right";

export const toggle = (page: Page, side: Side) => page.getByTestId(side === "left" ? "button-toggle-left" : "button-toggle-right");
export const panel = (page: Page, side: Side) => page.getByTestId(side === "left" ? "panel-left" : "panel-inspector");
export const canvasArea = (page: Page) => page.getByTestId("area-canvas");

/** Clicks a panel's toolbar button and waits for its pressed state to flip. */
export async function togglePanel(page: Page, side: Side): Promise<void> {
  const button = toggle(page, side);
  const was = await button.getAttribute("aria-pressed");
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", was === "true" ? "false" : "true");
}

/** A panel shown (wide screens): pressed button, visible, not inert, at its width. */
export async function expectShown(page: Page, side: Side, width = side === "left" ? 264 : 340): Promise<void> {
  await expect(toggle(page, side)).toHaveAttribute("aria-pressed", "true");
  await expect(panel(page, side)).toBeVisible();
  await expect(panel(page, side)).not.toHaveAttribute("inert");
  await expect.poll(async () => Math.round((await box(panel(page, side))).width)).toBe(width);
}

/** A panel hidden: unpressed button, invisible and inert (in the page, out of reach of Tab and screen readers). */
export async function expectHidden(page: Page, side: Side): Promise<void> {
  await expect(toggle(page, side)).toHaveAttribute("aria-pressed", "false");
  await expect(panel(page, side)).toBeHidden();
  await expect(panel(page, side)).toHaveAttribute("inert", "");
}

/** The width of the canvas's area, once it has settled on `expected` (±1 px). */
export async function expectCanvasWidth(page: Page, expected: number): Promise<void> {
  await expect.poll(async () => Math.abs((await box(canvasArea(page))).width - expected)).toBeLessThanOrEqual(1);
}

/** Where a card's header is on the screen. */
export async function cardAt(page: Page, name: string): Promise<{ x: number; y: number }> {
  const b = await box(card(page, name).locator(".c-head"));
  return { x: b.x, y: b.y };
}

/** Waits until a card is drawn at `at` on the screen (±1 px). */
export async function expectCardAt(page: Page, name: string, at: { x: number; y: number }): Promise<void> {
  await expect
    .poll(async () => {
      const now = await cardAt(page, name);
      return Math.max(Math.abs(now.x - at.x), Math.abs(now.y - at.y));
    })
    .toBeLessThanOrEqual(1);
}

/** The layout cookie of a person in this browser, as the browser wrote it. */
export async function panelsCookie(page: Page, userId: string = SEED_IDS.userLukasz): Promise<string | undefined> {
  return (await page.context().cookies()).find((c) => c.name === `im-panels.${userId}`)?.value;
}

/** The view React Flow draws: the viewport element's transform. */
export const viewportTransform = (page: Page) =>
  page.locator(".react-flow__viewport").evaluate((el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: m.e, y: m.f, zoom: m.a };
  });

export const projectHome = (projectId: string = SEED_IDS.projCustomer360) => `/w/${SEED_IDS.wsRetailDwh}/p/${projectId}`;
