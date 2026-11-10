// S24-05 (slice 24, item 6, F16, F17): an unused own stereotype is removed at once, with Undo in its toast; a used one
// opens the dialog, its entities move to the chosen stereotype, and one undo step brings back both; a built-in one has no
// Remove.

import { expect, test } from "./fixtures";
import { addStereotype, expectToast, hydrated, openConventions, setStereotypeAs, storedEntity, storedStereotype, stRow, undoButton } from "./helpers";

test("S24-05: an unused own one goes at once, and Undo in the toast brings it back", async ({ page }) => {
  await openConventions(page);
  await addStereotype(page, "Event", "event");
  await expectToast(page, "Stereotype “Event” added (event).");
  await stRow(page, "event").getByTestId("button-remove-stereotype").click();
  await expectToast(page, "Event removed.");
  await expect(page.getByTestId("dialog-remove-stereotype")).toHaveCount(0);
  await expect.poll(async () => (await storedStereotype("event"))?.deleted_at).not.toBeNull();
  await expect(stRow(page, "event")).toHaveCount(0);
  await page.getByTestId("toast-action").click();
  await expect.poll(async () => (await storedStereotype("event"))?.deleted_at).toBeNull();
  await expect(stRow(page, "event")).toBeVisible();
});

test("S24-05: a used one asks where its entities go; one undo step brings back the stereotype and every entity's", async ({ page }) => {
  await openConventions(page);
  await addStereotype(page, "Event", "event");
  await expectToast(page, "Stereotype “Event” added (event).");
  await setStereotypeAs("Customer", "event");
  await setStereotypeAs("Sales Order", "event");
  await page.reload();
  await hydrated(page);
  await expect(stRow(page, "event").getByTestId("stereotype-uses")).toHaveText("2 entities");

  await stRow(page, "event").getByTestId("button-remove-stereotype").click();
  const dialog = page.getByTestId("dialog-remove-stereotype");
  await expect(dialog.getByRole("heading")).toHaveText("Remove Event?");
  await expect(dialog.getByTestId("remove-stereotype-question")).toHaveText("2 entities have this stereotype. Choose the one they get instead:");
  await expect(dialog.getByTestId("select-stereotype-move-to").locator("option")).toHaveText(["Object", "Link", "Dictionary", "Context", "Informative"]);
  await expect(dialog).toContainText("One undo step brings back the stereotype and every entity's.");
  // Cancel leaves everything
  await dialog.getByTestId("button-cancel-remove-stereotype").click();
  await expect(dialog).toHaveCount(0);
  expect((await storedStereotype("event"))?.deleted_at).toBeNull();

  await stRow(page, "event").getByTestId("button-remove-stereotype").click();
  await dialog.getByTestId("select-stereotype-move-to").selectOption({ label: "Context" });
  await expect(dialog.getByTestId("button-confirm-remove-stereotype")).toHaveText("Remove and move 2 entities");
  await dialog.getByTestId("button-confirm-remove-stereotype").click();
  await expectToast(page, "Event removed; 2 entities are now Context.");
  await expect.poll(async () => (await storedEntity("Customer")).stereotype).toBe("context");
  expect((await storedEntity("Sales Order")).stereotype).toBe("context");
  expect((await storedStereotype("event"))?.deleted_at).not.toBeNull();
  await expect(stRow(page, "context").getByTestId("stereotype-uses")).toHaveText("2 entities");

  await undoButton(page).click();
  await expect.poll(async () => (await storedStereotype("event"))?.deleted_at).toBeNull();
  expect((await storedEntity("Customer")).stereotype).toBe("event");
  expect((await storedEntity("Sales Order")).stereotype).toBe("event");
  await expect(stRow(page, "event").getByTestId("stereotype-uses")).toHaveText("2 entities");
});

test("S24-05: one entity: the dialog's singular forms", async ({ page }) => {
  await openConventions(page);
  await addStereotype(page, "Event", "event");
  await expectToast(page, "Stereotype “Event” added (event).");
  await setStereotypeAs("Customer", "event");
  await page.reload();
  await hydrated(page);
  await stRow(page, "event").getByTestId("button-remove-stereotype").click();
  const dialog = page.getByTestId("dialog-remove-stereotype");
  await expect(dialog.getByTestId("remove-stereotype-question")).toHaveText("1 entity has this stereotype. Choose the one it gets instead:");
  await expect(dialog.getByTestId("button-confirm-remove-stereotype")).toHaveText("Remove and move 1 entity");
  await dialog.getByTestId("button-confirm-remove-stereotype").click();
  await expectToast(page, "Event removed; 1 entity is now Object.");
  await expect.poll(async () => (await storedEntity("Customer")).stereotype).toBe("object");
});
