// Slice 6b's e2e helpers: Back and Forward (the row's buttons, Alt+←/→), the pages they walk, and the Navigation API's
// view of the tab's history.

import { expect, type Page } from "./fixtures";
import { card, RETAIL, SEED_IDS } from "../slice-06a/helpers";

export * from "../slice-06a/helpers";

export const backButton = (page: Page) => page.getByTestId("button-back");
export const forwardButton = (page: Page) => page.getByTestId("button-forward");

/** The workspace home (Retail Co – DWH), a project home and the second project's home, as paths. */
export const WS_HOME = `/w/${RETAIL}`;
export const projectPath = (projectId: string = SEED_IDS.projCustomer360) => `/w/${RETAIL}/p/${projectId}`;

/** The path and query of the page shown, once it is `expected` (a regular expression or an exact path). */
export async function expectAt(page: Page, expected: string | RegExp): Promise<void> {
  await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toMatch(typeof expected === "string" ? new RegExp(`^${expected.replace(/[?]/g, "\\?")}$`) : expected);
}

/** Alt+← or Alt+→ with nothing focused (not in a text field). */
export async function altArrow(page: Page, key: "ArrowLeft" | "ArrowRight"): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(`Alt+${key}`);
}

/** Whether the buttons are enabled: [Back, Forward]. */
export const buttonsEnabled = async (page: Page) => [await backButton(page).isEnabled(), await forwardButton(page).isEnabled()];

/**
 * What the details panel shows: `entity:<name>`, `table`, `mapping`, `relationship`, `frame:<name>`, `note`,
 * `req:<key>`, `label:<name>`, `system:<name>` (slice 7a), or `none` (the canvas overview). It reads the panel even
 * when the panel is hidden (a hidden panel stays in the page, inert).
 */
export const selected = (page: Page) =>
  page.getByTestId("panel-inspector").evaluate((p) => {
    const v = (id: string) => (p.querySelector(`[data-testid="${id}"]`) as HTMLInputElement | null)?.value;
    if (p.querySelector("[data-testid='panel-entity']")) return `entity:${v("input-entity-name")}`;
    if (p.querySelector("[data-testid='panel-source-table']")) return "table";
    if (p.querySelector("[data-testid='panel-mapping']")) return "mapping";
    if (p.querySelector("[data-testid='panel-relationship']")) return "relationship";
    if (p.querySelector("[data-testid='panel-frame']")) return `frame:${v("input-frame-name")}`;
    if (p.querySelector("[data-testid='panel-note']")) return "note";
    if (p.querySelector("[data-testid='panel-requirement']")) return `req:${v("input-req-key")}`;
    if (p.querySelector("[data-testid='panel-label']")) return `label:${v("input-label-name")}`;
    // slice 7a: a source system's panel
    if (p.querySelector("[data-testid='panel-source-system']")) return `system:${p.querySelector("[data-testid='panel-source-system'] h2")?.textContent}`;
    return "none";
  });

/** Waits until the details panel shows `expected` (see `selected`). */
export const expectSelected = (page: Page, expected: string) => expect.poll(() => selected(page)).toBe(expected);

/** Clicks a card's header (selects it). */
export const clickCard = (page: Page, name: string) => card(page, name).locator(".c-head .c-l2").click();
