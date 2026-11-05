import { expect, test } from "./fixtures";
import { dimensionRow, hints, openEntity, openStar, signInAs, thirdDateRelationship } from "./helpers";

// RP-03 (R-4): a third Dim Date → Fact Sales relationship without a role: "Dim Date is related 3 times. Name each role."
// and "Dim Date is related, but no key carries it."; both open that relationship.

test("RP-03: a third Dim Date relationship asks for its role and its key", async ({ page }) => {
  const third = await thirdDateRelationship();
  await signInAs(page, "Łukasz");
  await openStar(page);
  await openEntity(page, "Fact Sales");
  await expect(dimensionRow(page, third)).toHaveText(/^Dim Date\s*no key\s*Add key$/);
  await expect(hints(page)).toHaveText(["Dim Date is related 3 times. Name each role.", "Dim Date is related, but no key carries it."]);
  await hints(page).first().click();
  await expect(page.getByTestId("panel-relationship")).toBeVisible();
  await expect(page.getByTestId("panel-relationship").getByTestId("select-cube-key")).toHaveValue("");
});
