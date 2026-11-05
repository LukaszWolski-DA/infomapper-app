import { expect, test } from "./fixtures";
import { attrId, keyOf, openRelationshipFromFact, openStar, relId, signInAs, undoButton, hydrated } from "./helpers";

// RP-05 (R-1): the Ship date relationship's "Key in Fact Sales" has ship_date_key selected and offers only the fact's
// foreign keys that carry nothing else (date_key carries Order date: not offered). None unlinks it; one undo links it
// again.

test("RP-05: Key in Fact Sales: ship_date_key selected, date_key not offered; None unlinks, undo links again", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  const ship = relId("date>sales:ship");
  await openRelationshipFromFact(page, "Fact Sales", ship);
  const select = page.getByTestId("select-cube-key");
  await expect(page.locator("label[for=f-rkey]")).toHaveText("Key in Fact Sales");
  await expect(select).toHaveValue(attrId("sales.ship_date_key"));
  await expect(select.locator("option")).toHaveText(["None", "ship_date_key"]);
  await expect(page.getByTestId("panel-relationship").getByTestId("button-cube-add-key")).toHaveCount(0);

  await select.selectOption("");
  await expect.poll(() => keyOf(ship)).toBeUndefined();
  await expect(page.getByTestId("panel-relationship").getByTestId("button-cube-add-key")).toBeVisible();
  await expect(select.locator("option")).toHaveText(["None", "ship_date_key"]);
  await undoButton(page).click();
  await expect.poll(() => keyOf(ship)).toBe(attrId("sales.ship_date_key"));
  await expect(select).toHaveValue(attrId("sales.ship_date_key"));
});
