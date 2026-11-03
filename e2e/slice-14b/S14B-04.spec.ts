import { expect, test } from "./fixtures";
import { canvasStored, canvasTab, canvasUrl, conflictLine, hydrated, keepMine, openCanvas, otherValue, recordToasts, renameCanvasElsewhere, renameInTab, renamingTab, SEED_IDS, signInAs, STALE, toasts, undoButton, useThis } from "./helpers";

// S14B-04 (items 4–5, O2): a real conflict on a canvas's rename. Anna renames the canvas in another session; the page's
// rename is refused as stale: its field keeps the typed name with slice 13's line inside the tab. "Keep mine" stores it
// as an ordinary undo step; "Use this" and Escape take Anna's name and store nothing.

test("S14B-04: a conflict on a rename: the line inside the tab; Keep mine stores (an undo step), Use this and Escape take the other name", async ({ page }) => {
  const co = SEED_IDS.canvasCustomerOrders;
  const field = page.getByTestId("input-canvas-name");
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await hydrated(page);

  // Keep mine
  await renameCanvasElsewhere(co, "Customers (Anna)");
  await renameInTab(page, "Customer & orders", "Customers (mine)");
  await expect(conflictLine(renamingTab(page))).toBeVisible();
  await expect(otherValue(renamingTab(page))).toHaveText("Customers (Anna)");
  await expect(field).toHaveValue("Customers (mine)");
  await expect.poll(() => toasts(page)).toContain(STALE);
  expect((await canvasStored(co)).name).toBe("Customers (Anna)");
  await keepMine(renamingTab(page)).click();
  await expect.poll(async () => (await canvasStored(co)).name).toBe("Customers (mine)");
  await expect(field).toHaveCount(0);
  await expect(canvasTab(page, "Customers (mine)")).toBeVisible();
  // an ordinary undo step
  await undoButton(page).click();
  await expect.poll(async () => (await canvasStored(co)).name).toBe("Customers (Anna)");
  await expect(canvasTab(page, "Customers (Anna)")).toBeVisible();

  // Use this
  await renameCanvasElsewhere(co, "Customers (Anna again)");
  await renameInTab(page, "Customers (Anna)", "Mine again");
  await expect(otherValue(renamingTab(page))).toHaveText("Customers (Anna again)");
  await useThis(renamingTab(page)).click();
  await expect(field).toHaveCount(0);
  await expect(canvasTab(page, "Customers (Anna again)")).toBeVisible();
  expect((await canvasStored(co)).name).toBe("Customers (Anna again)");

  // Escape is "Use this"
  await renameCanvasElsewhere(co, "Customers, third");
  await renameInTab(page, "Customers (Anna again)", "Mine, third");
  await expect(otherValue(renamingTab(page))).toHaveText("Customers, third");
  await field.click();
  await field.press("Escape");
  await expect(field).toHaveCount(0);
  await expect(canvasTab(page, "Customers, third")).toBeVisible();
  expect((await canvasStored(co)).name).toBe("Customers, third");
});
