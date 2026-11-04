import { expect, test } from "./fixtures";
import { canvasUrl, card, emptySpot, openCanvas, signInAs, toolboxAt } from "./helpers";

// S15-01 (O1): with the module registered and no InfoCube data, InfoMapper's pages are as before: three tabs, no role on
// any card, no InfoCube item in the canvas's toolbox, the entity's delete preview without a module's row. The lint rule
// and the empty registry are unit tests (`tests/layer-rules.test.ts`, `tests/table-registry.test.ts`); every earlier
// spec runs on this same plain seed.
test.use({ star: false });

test("S15-01: without InfoCube data the canvas has three tabs, no roles, no InfoCube toolbox items, an unchanged delete preview", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await expect(page.locator('[role="tablist"]').filter({ has: page.getByTestId("tab-model") }).getByRole("tab")).toHaveText(["Model", "Sources", "Requirements"]);
  await expect(page.getByTestId("tab-cube")).toHaveCount(0);
  await expect(page.getByTestId("card-role")).toHaveCount(0);
  await expect(page.locator(".card.dimn")).toHaveCount(0);

  const items = await toolboxAt(page, await emptySpot(page));
  expect(items).toContain("New entity here");
  expect(items.filter((i) => /New (fact|dimension) here/.test(i))).toEqual([]);
  await page.keyboard.press("Escape");

  await card(page, "Sales Order").getByTestId("card-name").click();
  await page.getByTestId("button-delete-entity").click();
  const rows = page.getByTestId("table-entity-impact").locator("tbody tr td:first-child");
  await expect(rows.first()).toBeVisible();
  expect((await rows.allInnerTexts()).filter((w) => /^(Fact|Dimension)$|facts?$|measures?$/.test(w))).toEqual([]);
});
