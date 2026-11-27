// Slice 38's e2e helpers: the canvas toolbar (its controls in order, its room), the side panels' widths as the cookie
// the server reads (slice 5a), and the canvas's top as the toolbar leaves it.

import type { Locator } from "@playwright/test";
import { E2E_BASE } from "../config";
import { SEED_IDS } from "../slice-01b/helpers";
import { expect, type Page } from "./fixtures";

export * from "../slice-16/helpers";
export { makeFrame, frameEl } from "../slice-02b/helpers";
export { AROUND } from "../slice-02c/helpers";
export { WS_HOME, projectPath } from "../slice-06b/helpers";
export { clickBox, entityBox, attributeBox, expectBox } from "../slice-11/helpers";

/** The canvas toolbar and the top bar. */
export const toolbar = (page: Page): Locator => page.getByTestId("bar-canvas");
export const topBar = (page: Page): Locator => page.getByTestId("bar-top");

/** The toolbar's controls in the order they are drawn, shown ones only (a group in “More” is hidden). */
export const toolbarIds = (page: Page): Promise<string[]> =>
  toolbar(page).evaluate((bar) =>
    [...bar.querySelectorAll<HTMLElement>("[data-testid]")]
      .filter((e) => e.getClientRects().length > 0 && !e.parentElement?.closest("[data-testid^='group-'],[data-testid^='switch-']"))
      .map((e) => e.getAttribute("data-testid")!),
  );

/** The side panels' layout for Łukasz before the page loads (the cookie the server reads, slice 5a): both shown. */
export async function setPanels(page: Page, leftWidth: number, rightWidth: number): Promise<void> {
  await page.context().addCookies([{ name: `im-panels.${SEED_IDS.userLukasz}`, value: `l1.r1.${leftWidth}.${rightWidth}`, url: `${E2E_BASE}/` }]);
}

/** Where things stand below the canvas's top, in px: the toolbar's bottom and the highest of `selector`'s boxes. */
export const canvasTop = (page: Page, selector = ".react-flow__node") =>
  page.evaluate((sel) => {
    const pane = document.querySelector(".react-flow__pane")!.getBoundingClientRect();
    const bar = document.querySelector('[data-testid="bar-canvas"]')!.getBoundingClientRect();
    const tops = [...document.querySelectorAll(sel)].map((n) => n.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => r.top);
    return { toolbarBottom: Math.round(bar.bottom - pane.top), first: Math.round(Math.min(...tops) - pane.top) };
  }, selector);

/** The toolbar does not scroll sideways (every control shown fits). */
export async function expectToolbarFits(page: Page): Promise<void> {
  expect(await toolbar(page).evaluate((b) => b.scrollWidth - b.clientWidth)).toBeLessThanOrEqual(0);
}
