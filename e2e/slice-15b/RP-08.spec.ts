import { expect, test } from "./fixtures";
import { attrId, hints, hintsOk, hydrated, keyOf, openRelationshipFromFact, openEntity, openStar, relId, relationshipLine, signInAs, undoButton } from "./helpers";

// RP-08 (R-4): deleting the Ship date relationship takes its link; ship_date_key stays, "a foreign key but carries no
// dimension"; one undo brings the relationship, its line and its link back.

test("RP-08: deleting the Ship date relationship: the line goes, ship_date_key carries nothing; undo restores both", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  const ship = relId("date>sales:ship");
  await openRelationshipFromFact(page, "Fact Sales", ship);
  await page.getByTestId("button-delete-relationship").click();
  await expect(relationshipLine(page, ship)).toHaveCount(0);
  await expect.poll(() => keyOf(ship)).toBeUndefined();
  await openEntity(page, "Fact Sales");
  await expect(hints(page)).toHaveText(["ship_date_key is a foreign key but carries no dimension."]);
  await hints(page).first().click();
  await expect(page.getByTestId("text-cube-carries-none")).toHaveText("No dimension. Pick this key in a relationship to a dimension.");

  await undoButton(page).click();
  await expect(relationshipLine(page, ship)).toHaveCount(1);
  await expect.poll(() => keyOf(ship)).toBe(attrId("sales.ship_date_key"));
  await expect(page.getByTestId("item-cube-carries")).toHaveText(/^Dim Date as Ship date\s*relationship$/);
  await openEntity(page, "Fact Sales");
  await expect(hintsOk(page)).toBeVisible();
});
