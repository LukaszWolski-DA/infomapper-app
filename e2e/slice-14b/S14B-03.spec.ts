import { expect, test } from "./fixtures";
import { canvasIn, canvasStored, expectToast, holdUntil, hydrated, openCanvas, openCanvasMenu, recordToasts, SEED_IDS, signInAs, STALE, tabNames, toasts } from "./helpers";

// S14B-03 (item 3): a delete from the tab menu waits for the canvas's look on its way and sends the version it answers.
// The project's last canvas cannot be deleted, as before.

test("S14B-03: a background change, then at once the canvas's delete: deleted, no refusal; the last canvas's item stays disabled", async ({ page }) => {
  const om = SEED_IDS.projOrderManagement, lines = SEED_IDS.canvasOrderLines, both = SEED_IDS.canvasCustomerOrders;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasIn(om, lines));
  await hydrated(page);

  const hold = await holdUntil(page, '"background":"blue"');
  let menu = await openCanvasMenu(page, "Order lines & products");
  await menu.getByTestId("group-canvas-background").locator('[data-background="blue"]').click();
  await expect.poll(() => hold.held()).toBe(true);
  await menu.getByTestId("menu-item-delete-canvas").click();

  hold.release();
  await hold.given;
  await expectToast(page, "Deleted the canvas Order lines & products. The model and its mappings are untouched.");
  await expect(page).toHaveURL(new RegExp(`/p/${om}/c/${both}$`));
  expect((await canvasStored(lines)).deleted_at).not.toBeNull();
  expect((await canvasStored(lines)).look.background).toBe("blue");
  expect(await toasts(page)).not.toContain(STALE);

  // the project's last canvas (shared with Customer 360): its item is disabled, as before
  expect(await tabNames(page)).toEqual(["Customer & orders"]);
  menu = await openCanvasMenu(page, "Customer & orders");
  await expect(menu.getByTestId("menu-item-delete-canvas")).toHaveAttribute("aria-disabled", "true");
  await expect(menu.getByTestId("menu-item-delete-canvas")).toHaveAttribute("title", "A project keeps at least one canvas.");
});
