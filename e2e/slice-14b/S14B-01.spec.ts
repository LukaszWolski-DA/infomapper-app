import { expect, test } from "./fixtures";
import { canvasStored, canvasUrl, holdUntil, hydrated, openCanvas, openCanvasMenu, recordToasts, renameInTab, SEED_IDS, signInAs, STALE, toasts } from "./helpers";

// S14B-01 (items 2, O1): the look and a rename of the same canvas save on one chain. The layer switch's answer is held,
// so the grid and the rename started meanwhile must wait for it and send the version it answers; before slice 14b the
// rename sent the page's version and was refused as a conflict.

test("S14B-01: a layer and a grid switch, then at once a rename in the tab: all stored, no conflict, no Not saved", async ({ page }) => {
  const co = SEED_IDS.canvasCustomerOrders;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await hydrated(page);

  const hold = await holdUntil(page, '"layer":"mappings"');
  await page.getByTestId("switch-layer").locator('[data-layer="mappings"]').click();
  await expect.poll(() => hold.held()).toBe(true);
  const menu = await openCanvasMenu(page, "Customer & orders");
  await menu.getByTestId("group-canvas-grid").locator('[data-grid="lines"]').click();
  await page.keyboard.press("Escape");
  await renameInTab(page, "Customer & orders", "Customers and their orders");

  hold.release();
  await hold.given;
  await expect(page.getByTestId("tab-canvas-name").getByText("Customers and their orders", { exact: true })).toBeVisible();
  await expect.poll(async () => (await canvasStored(co)).name).toBe("Customers and their orders");
  const row = await canvasStored(co);
  expect(row.look).toMatchObject({ layer: "mappings", grid: "lines" });
  await expect.poll(() => toasts(page)).toContain("Renamed the canvas to Customers and their orders.");
  expect(await toasts(page)).not.toContain(STALE);
  await expect(page.getByTestId("draft-not-saved")).toHaveCount(0);
  await expect(page.getByTestId("draft-conflict")).toHaveCount(0);
});
