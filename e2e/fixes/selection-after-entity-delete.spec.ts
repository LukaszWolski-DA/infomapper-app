import { expect, test } from "../slice-15b/fixtures";
import { card, entityIdOf, hydrated, openAttribute, openStar, signInAs } from "../slice-15b/helpers";
import { menuOn } from "../slice-10a/helpers";
import { holdUntil } from "../slice-13/helpers";

// fix/selection-after-delete: after a delete's answer the selection is cleared when it points at anything the delete
// removed, its cascades included. Dim Product's delete is held; meanwhile the dialog is closed and one of its attributes
// selected; the answer takes the attribute along with the entity, so the selection goes.

test("a selected attribute of a deleted entity is cleared when the delete's answer arrives", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await menuOn(page, card(page, "Dim Product").locator(".c-head"), "Delete from model…");
  const dialog = page.getByTestId("dialog-delete-entity");
  await page.getByTestId("table-entity-impact").waitFor();

  const hold = await holdUntil(page, entityIdOf("prod"));
  await dialog.getByTestId("button-confirm-delete-entity").click();
  await expect.poll(() => hold.held()).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await openAttribute(page, "Dim Product", "sku");
  await expect(page.getByTestId("input-attribute-name")).toHaveValue("sku");

  hold.release();
  await hold.given;
  await expect(card(page, "Dim Product")).toHaveCount(0);
  await expect(page.getByTestId("panel-attribute")).toHaveCount(0);
});
