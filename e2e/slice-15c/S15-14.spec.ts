import { expect, test } from "./fixtures";
import { card, entityIdOf, hydrated, liveCubeMappings, openEntity, openStar, signInAs, undoButton } from "./helpers";

// S15-14 (X-4), the mappings' rows (15a's spec, e2e/slice-15a/S15-14.spec.ts, keeps the role's rows): Dim Customer's
// delete preview adds "4 dimensional mappings – deleted, 3 of them approved" (city is Draft) and no feed row (nothing
// is fed by a dimension); Dim Date, which nothing feeds, has no dimensional mapping row. The delete takes Dim Customer's
// mappings with it and one undo brings them back.

test("S15-14: Dim Customer's preview lists its 4 dimensional mappings; Dim Date's none; the delete and its undo", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  const dialog = page.getByTestId("dialog-delete-entity");
  const rows = dialog.getByTestId("table-entity-impact").locator("tbody tr");

  await openEntity(page, "Dim Date");
  await page.getByTestId("button-delete-entity").click();
  await expect(rows.filter({ hasText: "SCD type" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "dimensional mapping" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await openEntity(page, "Dim Customer");
  await page.getByTestId("button-delete-entity").click();
  await expect(rows.filter({ hasText: "dimensional mapping" })).toHaveText([/^4 dimensional mappings\s*deleted, 3 of them approved$/]);
  await expect(rows.filter({ hasText: "feed from the logical model" })).toHaveCount(0);
  await dialog.getByTestId("button-confirm-delete-entity").click();
  await expect(card(page, "Dim Customer")).toHaveCount(0);
  await expect.poll(async () => (await liveCubeMappings()).length).toBe(16);

  await undoButton(page).click();
  await expect(card(page, "Dim Customer")).toHaveCount(1);
  await expect.poll(async () => (await liveCubeMappings()).length).toBe(20);
  expect(entityIdOf("cust")).toBeTruthy();
});
