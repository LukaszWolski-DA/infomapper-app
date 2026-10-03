import { expect, test } from "./fixtures";
import { expectLineEndsOnRows, loadItems, signInAs } from "./helpers";

test("S1A-03: below 40% zoom cards show header and a plain block, lines keep their ends at the right rows", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const items = await loadItems();

  await expectLineEndsOnRows(page, 0.3); // opens the canvas at 30% after reading the rows at 100%
  await expect(page.getByTestId("value-zoom")).toHaveText("30%");
  await expect(page.getByTestId("card-name")).toHaveCount(items.length);
  await expect(page.getByTestId("card-block")).toHaveCount(items.length);
  await expect(page.locator(".react-flow__node [data-row]")).toHaveCount(0);

  // at 40% and above the rows are back
  await expectLineEndsOnRows(page, 0.4);
  await expect(page.getByTestId("card-block")).toHaveCount(0);
  await expect(page.locator(".react-flow__node [data-row]").first()).toBeVisible();
});
