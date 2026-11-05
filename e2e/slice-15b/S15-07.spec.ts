import { expect, test } from "./fixtures";
import { card, hints, openStar, signInAs } from "./helpers";

// S15-07 (IC-03, 15b's part: B-5's hints): a new fact's panel shows "No grain yet" and "No dimension keys"; the grain
// hint puts the cursor in Grain, the keys hint opens the fact.

test("S15-07 (hints): a new fact shows No grain yet and No dimension keys; the grain hint goes to Grain", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await page.getByTestId("tab-cube").click();
  await page.getByTestId("button-new-fact").click();
  await expect(card(page, "New fact")).toHaveCount(1);
  await page.getByTestId("input-entity-name").press("Escape");
  await expect(hints(page)).toHaveText([
    "No grain yet. Write what one row of this fact stands for.",
    "No dimension keys. Relate this fact to a dimension and add its key.",
  ]);
  await expect(page.getByText("None yet. Open a numeric attribute and turn on Measure.")).toBeVisible();
  await expect(page.getByText("None yet. Draw a relationship to a dimension.")).toBeVisible();
  await hints(page).first().click();
  await expect(page.getByTestId("input-cube-grain")).toBeFocused();
});
