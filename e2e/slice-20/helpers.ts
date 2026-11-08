// Slice 20's helpers: the demo's objects, the project homes' section, the card marks, the status bar's count, the
// details panel's group and the panels' box.

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { SEED_IDS } from "../../src/data/local/seed";
import { seedId } from "../../src/data/local/seed-model";
import { RETAIL } from "../slice-01a/helpers";
import { card } from "../slice-01a/helpers";
import { rowNamed } from "../slice-01b/helpers";

export * from "../slice-19/helpers";
export { hydrated, projectHome, recordToasts, toasts } from "../slice-09/helpers";
export { WHOLE_CO } from "../slice-03a/helpers";

/** The demo model's ids ("{entity key}.{attribute}", seed-model.ts and seed-checks.ts). */
export const demoAttr = (key: string) => seedId(RETAIL, `attribute:${key}`);
export const demoEntity = (key: string) => seedId(RETAIL, `entity:${key}`);
export const demoRel = (key: string) => seedId(RETAIL, `relationship:${key}`);
export const OM = SEED_IDS.projOrderManagement;
export const C360 = SEED_IDS.projCustomer360;
export const OM_HOME = `/w/${RETAIL}/p/${OM}`;
export const C360_HOME = `/w/${RETAIL}/p/${C360}`;

// ---- the project home ----
export const checksSection = (page: Page) => page.getByTestId("section-checks");
export const checkGroup = (page: Page, id: string) => checksSection(page).locator(`[data-testid="check-group"][data-group="${id}"]`);
export const checkLines = (page: Page, id: string) => checkGroup(page, id).getByTestId("check-line");
/** Each group's id and count, in the order shown. */
export const groupCounts = (page: Page): Promise<[string, number][]> =>
  checksSection(page)
    .getByTestId("check-group")
    .evaluateAll((els) => els.map((e) => [e.getAttribute("data-group")!, Number(e.querySelector('[data-testid="check-title"]')!.nextElementSibling!.textContent)] as [string, number]));

// ---- the canvas ----
/** The header's name line of a card (`.c-l2`), which carries the header's mark. */
export const headLine = (page: Page, name: string): Locator => card(page, name).getByTestId("card-head-line");
/** A row's type span (`.dt`), which carries the row's mark. */
export const rowType = (page: Page, cardName: string, rowName: string): Locator => rowNamed(page, cardName, rowName).locator(".dt");
/** "high", "normal" or null: a mark's severity, read from its classes. */
export async function markOf(l: Locator): Promise<"high" | "normal" | null> {
  const cls = (await l.getAttribute("class")) ?? "";
  const row = await l.evaluate((el) => (el.classList.contains("dt") ? (el.closest(".row")?.className ?? "") : ""));
  const c = row || cls;
  return /\bchk\b/.test(c) ? (/\bhigh\b/.test(c) ? "high" : "normal") : null;
}
export const expectMark = async (l: Locator, mark: "high" | "normal" | null) => expect.poll(() => markOf(l)).toBe(mark);
/** A mark's title, built when the pointer is over it. */
export async function markTitleOf(l: Locator): Promise<string> {
  await l.hover();
  return (await l.getAttribute("title")) ?? "";
}
export const statusChecks = (page: Page) => page.getByTestId("status-checks");
export const canvasChecks = (page: Page) => page.getByTestId("section-canvas-checks");
export const canvasCheckItems = (page: Page) => canvasChecks(page).getByTestId("item-canvas-check");

// ---- the panels ----
export const checksBox = (page: Page) => page.getByTestId("box-model-checks");
export const boxItems = (page: Page) => checksBox(page).getByTestId("item-model-check");
