// Slice 30's helpers: the top bar's save pair (the indicator and the server badge), on top of slice 13's (held answers,
// another session's change, the panels).
import { expect, type Page } from "@playwright/test";

export * from "../slice-13/helpers";

export const indicator = (page: Page) => page.getByTestId("indicator-save");
export const badge = (page: Page) => page.getByTestId("badge-server");

/** The indicator in `state` (saving, saved, fading, failed, idle). */
export const expectSaveState = (page: Page, state: string, timeout?: number) => expect(indicator(page)).toHaveAttribute("data-state", state, timeout ? { timeout } : undefined);
