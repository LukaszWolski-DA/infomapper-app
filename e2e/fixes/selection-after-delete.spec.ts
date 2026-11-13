import { expect, test } from "../slice-15b/fixtures";
import { attrId, hydrated, openAttribute, openEntity, openStar, rowNamed, signInAs } from "../slice-15b/helpers";
import { holdUntil } from "../slice-13/helpers";

// fix/selection-after-delete (RP-07 failed once in slice 26's first full run, known-limitations.md): a delete cleared
// the selection when its answer arrived, whatever the person had selected meanwhile. The delete's answer is held until
// another card has been clicked, so the click always comes before the answer (no timing luck): the card stays selected,
// as it does not point at anything the delete removed.

test("a card clicked while an attribute's delete is on its way stays selected", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await openAttribute(page, "Fact Sales", "ship_date_key");
  const del = page.getByTestId("button-delete-attribute");
  await del.click();
  await expect(del).toHaveText(/^Click again to delete/);

  const hold = await holdUntil(page, attrId("sales.ship_date_key"));
  await del.click();
  await expect.poll(() => hold.held()).toBe(true);
  // the attribute's own card and then another one, both selected while the answer is held
  await openEntity(page, "Fact Sales");
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Fact Sales");
  await openEntity(page, "Dim Date");
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Dim Date");

  hold.release();
  await hold.given;
  // the answer has been applied: the row is gone from its card, and Dim Date is still the selection
  await expect(rowNamed(page, "Fact Sales", "ship_date_key")).toHaveCount(0);
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Dim Date");
});
