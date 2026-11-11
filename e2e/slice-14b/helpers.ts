// Slice 14b's e2e helpers (the canvas's row on the save chain): the canvas tabs' rename, the tab menu, and a canvas's
// stored row. The earlier slices' helpers come through slice 14a's.

import { expect, type Page, type Request } from "@playwright/test";
import { renameCanvas, setCanvasLook } from "../../src/domain/commands/canvas";
import type { CanvasBackground, CanvasGrid } from "../../src/domain/types";
import { canvasTab } from "../slice-02a/helpers";
import { asUser, rawDb, RETAIL, SEED_IDS, store } from "../slice-14a/helpers";

export * from "../slice-14a/helpers";
export { canvasIn, canvasTab, openCanvasMenu, tabNames } from "../slice-02a/helpers";

/** A canvas's stored row by its id, deleted or not. */
export const canvasStored = async (canvasId: string) => (await rawDb()).canvas.find((c) => c.id === canvasId)!;

/** Opens the rename field of a canvas's tab with a double-click; returns the field. */
export async function startRename(page: Page, canvasName: string) {
  await canvasTab(page, canvasName).dblclick();
  const field = page.getByTestId("input-canvas-name");
  await expect(field).toBeFocused();
  return field;
}

/** Renames a canvas in its tab: double-click, the new name, Enter. */
export async function renameInTab(page: Page, canvasName: string, name: string): Promise<void> {
  const field = await startRename(page, canvasName);
  await field.fill(name);
  await field.press("Enter");
}

/** A canvas renamed by Anna, as another session would (the page does not know). */
export async function renameCanvasElsewhere(canvasId: string, name: string): Promise<void> {
  const canvas = (await store().canvases.get(RETAIL, canvasId))!;
  await asUser(SEED_IDS.userAnna, (ctx, access) => renameCanvas(ctx, access, { canvas }, { canvasId, expectedVersion: canvas.version, name }));
}

/** A canvas's look changed by Anna, as another session would: only the row's version and its look change. */
export async function changeCanvasLookElsewhere(canvasId: string, look: { background?: CanvasBackground; grid?: CanvasGrid }): Promise<void> {
  const canvas = (await store().canvases.get(RETAIL, canvasId))!;
  await asUser(SEED_IDS.userAnna, (ctx, access) => setCanvasLook(ctx, access, { canvas }, { canvasId, expectedVersion: canvas.version, ...look }));
}

/** The tab of a canvas whose field is open (it shows no name then): the one holding the rename field. */
export const renamingTab = (page: Page) => page.getByTestId("tab-canvas").filter({ has: page.getByTestId("input-canvas-name") });

// ---- step 4: leaving a page (items 8–9) ----

/**
 * Closes the page as a person closing the tab would (`beforeunload` runs) and expects the browser's warning: the dialog
 * is dismissed, so the page stays and the test goes on.
 */
export async function leaveAsks(page: Page): Promise<void> {
  const dialog = page.waitForEvent("dialog", { timeout: 5000 });
  await page.close({ runBeforeUnload: true });
  const d = await dialog;
  expect(d.type()).toBe("beforeunload");
  await d.dismiss();
  expect(page.isClosed()).toBe(false);
}

/** Closes the page the same way and expects no warning: the page closes (a test's last step). */
export async function leaveAsksNothing(page: Page): Promise<void> {
  const asked: string[] = [];
  page.on("dialog", (d) => {
    asked.push(d.type());
    void d.accept();
  });
  const closed = page.waitForEvent("close", { timeout: 5000 });
  await page.close({ runBeforeUnload: true });
  await closed;
  expect(asked).toEqual([]);
}

const isAction = (r: Request) => r.method() === "POST" && !!r.headers()["next-action"];

/**
 * Resolves once the page has the answer of its next server action: the request over with its response, and the
 * entity's card showing `name` from the fresh page it brings. The data file is written before the answer reaches the
 * page, so a stored row alone does not mean the save is no longer on its way.
 *
 * "Over" is `requestfinished` or `requestfailed` after a response. Now and then (about one action in six on the dev
 * server) the page's reader stops before the response's end once it has the answer, and Chromium reports the rest of
 * the load as `net::ERR_ABORTED`; Playwright's `response.finished()` never resolves then (the S14B-09 flake).
 */
export function answerOf(page: Page, name: string): () => Promise<void> {
  const over = new Promise<Request>((resolve) => {
    const on = (r: Request) => {
      if (!isAction(r)) return;
      page.off("requestfinished", on);
      page.off("requestfailed", on);
      resolve(r);
    };
    page.on("requestfinished", on);
    page.on("requestfailed", on);
  });
  return async () => {
    const request = await over;
    if (request.failure() && !(await request.response())) throw new Error(`The server action failed without an answer: ${request.failure()!.errorText}`);
    await expect(page.getByTestId("card-entity").filter({ hasText: name }).first()).toBeVisible();
  };
}
