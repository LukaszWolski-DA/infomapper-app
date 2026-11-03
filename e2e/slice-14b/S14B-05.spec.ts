import { expect, test } from "./fixtures";
import { canvasStored, canvasTab, canvasUrl, changeCanvasLookElsewhere, conflictLine, hydrated, notSaved, openCanvas, renameInTab, renamingTab, SEED_IDS, signInAs } from "./helpers";

// S14B-05 (item 4): another session changes only the canvas's look (through the domain: within one session the chain
// makes this impossible, step 1, F15); the rename sent with the older version is refused as stale while the name did not
// change meanwhile: "Not saved", and leaving the field again stores it.

test("S14B-05: a rename refused as stale while the name did not change: Not saved; leaving the field again stores it", async ({ page }) => {
  const co = SEED_IDS.canvasCustomerOrders;
  const field = page.getByTestId("input-canvas-name");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await hydrated(page);

  await changeCanvasLookElsewhere(co, { grid: "lines" });
  await renameInTab(page, "Customer & orders", "Customers renamed");
  await expect(notSaved(renamingTab(page))).toHaveText("Not saved");
  await expect(conflictLine(renamingTab(page))).toHaveCount(0);
  await expect(field).toHaveValue("Customers renamed");
  expect((await canvasStored(co)).name).toBe("Customer & orders");

  await field.click();
  await field.press("Enter");
  await expect.poll(async () => (await canvasStored(co)).name).toBe("Customers renamed");
  await expect(field).toHaveCount(0);
  await expect(canvasTab(page, "Customers renamed")).toBeVisible();
});
