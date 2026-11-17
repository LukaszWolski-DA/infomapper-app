import { expect, test } from "../slice-22/fixtures";
import { hydrated, openEntity, openStar, signInAs, undoButton, unknownFlag, unknownOnOf } from "../slice-22/helpers";
import { holdUntil } from "../slice-13/helpers";
import { canvasUrl, openCanvas } from "../slice-01a/helpers";
import { openEntityFromTree } from "../slice-04a/helpers";
import { storedEntity } from "../slice-24/helpers";

// fix/choice-after-undo (S22-02 failed once in PR 67's full run, known-limitations.md): a choice field forgot its choice
// only in a render whose stored value equalled it. Undo pressed while the choice's save was on its way drew the save's
// page and the undo's in one commit: the field never saw its choice stored, the stored value was back to the one the
// choice was made on, and the field showed the choice until the next change. The save's answer is held until Undo has
// been pressed, so Undo always runs right behind it (no timing luck).

test("the unknown member's flag shows the undo's value when Undo is pressed while its save is on its way", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await openEntity(page, "Dim Customer");
  await unknownFlag(page).click();
  await expect.poll(() => unknownOnOf("cust")).toBe(false);
  await expect(unknownFlag(page)).toHaveAttribute("aria-pressed", "false");
  await expect(undoButton(page)).toBeEnabled(); // the page knows the step "Turn off"

  const hold = await holdUntil(page, "hasUnknownMember");
  await unknownFlag(page).click();
  await expect.poll(() => hold.held()).toBe(true);
  await expect(unknownFlag(page)).toHaveAttribute("aria-pressed", "true"); // the choice, from the click
  await expect.poll(() => unknownOnOf("cust")).toBe(true);
  await undoButton(page).click(); // waits behind the held save (rowSaves.exclusive)
  hold.release();
  await hold.given;
  await expect.poll(() => unknownOnOf("cust")).toBe(false);
  await expect(page.getByTestId("toast")).toContainText("Undone: Turn on unknown member of Dim Customer");
  await expect(unknownFlag(page)).toHaveAttribute("aria-pressed", "false");
});

test("the entity's stereotype shows the undo's value when Undo is pressed while its save is on its way", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 0.5 });
  await hydrated(page);
  await openEntityFromTree(page, "Order Line");
  const select = page.getByTestId("select-entity-stereotype");
  await expect(select).toHaveValue("link");
  await select.selectOption("context");
  await expect.poll(async () => (await storedEntity("Order Line")).stereotype).toBe("context");
  await expect(undoButton(page)).toBeEnabled(); // the page knows the first step

  const hold = await holdUntil(page, '"stereotype"');
  await select.selectOption("dictionary");
  await expect.poll(() => hold.held()).toBe(true);
  await expect(select).toHaveValue("dictionary"); // the choice, from the click
  await expect.poll(async () => (await storedEntity("Order Line")).stereotype).toBe("dictionary");
  await undoButton(page).click(); // waits behind the held save (rowSaves.exclusive)
  hold.release();
  await hold.given;
  await expect.poll(async () => (await storedEntity("Order Line")).stereotype).toBe("context");
  await expect(page.getByTestId("toast")).toContainText("Undone:");
  await expect(select).toHaveValue("context");
});
