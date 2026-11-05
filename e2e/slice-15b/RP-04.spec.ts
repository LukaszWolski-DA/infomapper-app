import { expect, test } from "./fixtures";
import {
  attrId,
  entityIdOf,
  hintsOk,
  hydrated,
  keyOf,
  model,
  openRelationshipFromFact,
  openEntity,
  openStar,
  recordToasts,
  redoButton,
  relId,
  signInAs,
  thirdDateRelationship,
  toasts,
  undoButton,
} from "./helpers";

// RP-04 (R-1, R-3): the third relationship's role "Payment date", then Add key: payment_date_key (Integer, a foreign
// key, not nullable) after the fact's last key, linked; the hints are gone. One undo removes the attribute and the link,
// the role stays; redo brings both back.

const salesOrder = async () =>
  (await model()).attributes
    .filter((a) => a.entity_id === entityIdOf("sales"))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => a.name);

test("RP-04: role Payment date, Add key → payment_date_key after the last key, linked; one undo removes both, the role stays; redo", async ({ page }) => {
  const third = await thirdDateRelationship();
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await openRelationshipFromFact(page, "Fact Sales", third);
  await expect(page.getByTestId("panel-relationship").locator("label[for=f-rfr]")).toHaveText("Role of Dim Date");
  await page.getByTestId("input-relationship-from-role").fill("Payment date");
  await page.getByTestId("input-relationship-from-role").press("Tab");
  await expect.poll(async () => (await model()).relationships.find((r) => r.id === third)?.from_role).toBe("Payment date");
  await expect(page.getByTestId("relationship-sentences")).toContainText("Each Fact Sales belongs to exactly one Dim Date as Payment date.");

  await page.getByTestId("panel-relationship").getByTestId("button-cube-add-key").click();
  await expect.poll(() => toasts(page)).toContainEqual("Added payment_date_key, the key of Dim Date as Payment date.");
  const added = async () => (await model()).attributes.find((a) => a.entity_id === entityIdOf("sales") && a.name === "payment_date_key");
  await expect.poll(async () => (await added())?.id).toBeTruthy();
  expect(await added()).toMatchObject({ data_type: "integer", is_foreign_key: true, is_primary_key: false, is_nullable: false });
  expect(await salesOrder()).toEqual(["date_key", "ship_date_key", "customer_key", "product_key", "payment_date_key", "order_number", "quantity", "unit_price", "discount_pct", "net_amount"]);
  expect(await keyOf(third)).toBe((await added())!.id);
  await expect(page.getByTestId("select-cube-key")).toHaveValue((await added())!.id);
  await openEntity(page, "Fact Sales");
  await expect(hintsOk(page)).toBeVisible();

  await undoButton(page).click();
  await expect.poll(added).toBeUndefined();
  await expect.poll(() => keyOf(third)).toBeUndefined();
  expect(await salesOrder()).toEqual(["date_key", "ship_date_key", "customer_key", "product_key", "order_number", "quantity", "unit_price", "discount_pct", "net_amount"]);
  expect((await model()).relationships.find((r) => r.id === third)?.from_role).toBe("Payment date");
  await expect(page.getByText("Dim Date as Payment date is related, but no key carries it.")).toBeVisible();

  await redoButton(page).click();
  await expect.poll(async () => (await added())?.id).toBeTruthy();
  await expect.poll(() => keyOf(third)).toBe((await added())!.id);
  await expect(hintsOk(page)).toBeVisible();
  // the other keys are untouched
  expect(await keyOf(relId("date>sales:ship"))).toBe(attrId("sales.ship_date_key"));
});
