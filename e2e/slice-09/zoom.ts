// Slice 9, step 4: the zoom field in the top bar (D-60). The field, typing a zoom, the view's transform and the canvas
// point at the view's centre (which a zoom around the centre keeps where it is).

import { expect, type Page } from "@playwright/test";

export { viewportTransform } from "../slice-05a/helpers";
export { canvasCommits } from "../slice-03b/helpers";
export { clickCard, selected } from "../slice-06b/helpers";

export const zoomField = (page: Page) => page.getByTestId("value-zoom");

/** Clicks into the zoom field (its value is selected), types `text` and presses `key` (Enter, Tab, Escape or none). */
export async function typeZoom(page: Page, text: string, key: "Enter" | "Tab" | "Escape" | null = "Enter") {
  await zoomField(page).click();
  await page.keyboard.type(text);
  if (key) await page.keyboard.press(key);
}

/** The canvas point at the middle of the canvas's pane. */
export async function centrePoint(page: Page): Promise<{ x: number; y: number }> {
  return page.locator(".react-flow").evaluate((el) => {
    const r = el.getBoundingClientRect();
    const m = new DOMMatrixReadOnly(getComputedStyle(el.querySelector(".react-flow__viewport")!).transform);
    return { x: (r.width / 2 - m.e) / m.a, y: (r.height / 2 - m.f) / m.a };
  });
}

/** Waits until the field shows `pct` and the view's zoom rounds to `pct` % (− from 45 % gives 37.5 %, shown as 38 %). */
export async function expectZoom(page: Page, pct: number) {
  await expect(zoomField(page)).toHaveValue(`${pct}%`);
  await expect
    .poll(async () => Math.round(100 * (await page.locator(".react-flow__viewport").evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a))))
    .toBe(pct);
}
