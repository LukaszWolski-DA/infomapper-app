// Slice 6b's e2e helpers: Back and Forward (the row's buttons, Alt+←/→), the pages they walk, and the Navigation API's
// view of the tab's history.

import { expect, type Page } from "./fixtures";
import { RETAIL, SEED_IDS } from "../slice-06a/helpers";

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
