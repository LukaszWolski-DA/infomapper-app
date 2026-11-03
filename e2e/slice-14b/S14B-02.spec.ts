import { expect, test } from "./fixtures";
import { canvasStored, canvasUrl, entityBox, holdUntil, hydrated, openCanvas, recordToasts, renameInTab, SEED_IDS, signInAs, STALE, toasts } from "./helpers";

// S14B-02 (items 2, O1, F2): the names switch sends no version of the canvas row, so it holds that row on the chain while
// it is on its way; a rename started meanwhile waits for it and sends the version it answers.

test("S14B-02: entity aliases switched on, then at once a rename in the tab: both stored, no conflict", async ({ page }) => {
  const co = SEED_IDS.canvasCustomerOrders;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await hydrated(page);

  const hold = await holdUntil(page, '"dimension":"entity"');
  await entityBox(page).click();
  await expect.poll(() => hold.held()).toBe(true);
  await renameInTab(page, "Customer & orders", "Customers by alias");

  hold.release();
  await hold.given;
  await expect.poll(async () => (await canvasStored(co)).name).toBe("Customers by alias");
  expect((await canvasStored(co)).entity_names).toBe("alias");
  await expect.poll(() => toasts(page)).toContain("Renamed the canvas to Customers by alias.");
  expect(await toasts(page)).not.toContain(STALE);
});
