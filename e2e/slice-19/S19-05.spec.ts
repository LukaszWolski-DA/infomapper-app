// S19-05 (item 6): Dim Product (demo) is a snapshot, "Month-end": its History and period; the Cube tab and the bus matrix
// show "Snapshot · Month-end"; Fact Sales' Dimensions list marks it; 2 · history hides the period, Snapshot shows it again
// with its value; the delete preview names its history.

import { expect, test } from "./fixtures";
import { card, cubeItem, cubeRow, historySeg, openBusMatrix, openEntity, openStar, periodField, relId, segment, signInAs, typeEntity } from "./helpers";

test("S19-05: Dim Product's snapshot in its panel, the Cube tab, the bus matrix, Fact Sales' Dimensions and its preview", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);

  await openEntity(page, "Dim Product");
  await expect(segment(historySeg(page), "Snapshot")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("text-cube-scd")).toHaveText(
    "Snapshot: each snapshot keeps the whole dimension as it was on that date (in Data Vault, usually from a PIT table); a row is the business key and the snapshot date. Facts join it by the snapshot date. Technical columns (valid from, valid to, current, snapshot date) are a physical matter and are not modelled here.",
  );
  await expect(periodField(page)).toHaveValue("Month-end");

  await page.getByTestId("tab-cube").click();
  await expect(cubeItem(page, "Dim Product")).toContainText("Snapshot · Month-end");
  const dialog = await openBusMatrix(page);
  await expect(dialog.getByTestId("bus-dimension").filter({ hasText: "Dim Product" })).toHaveText(/^Dim Product\s*Snapshot · Month-end$/);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await openEntity(page, "Fact Sales");
  const product = page.locator(`[data-testid="item-cube-dimension"][data-relationship="${relId("prod>sales")}"]`);
  await expect(product.getByTestId("mark-cube-snapshot")).toHaveAttribute("title", "Dim Product is a snapshot dimension: the fact joins it by the snapshot date");
  await expect(product).toContainText("key product_key · snapshot");
  // slice 22: the unknown member's key value on the row's second line
  await expect(product).toHaveText(/key product_key · snapshot\s*no match → -1$/);
  await expect(page.getByTestId("mark-cube-snapshot")).toHaveCount(1);

  // 2 · history hides the period, Snapshot shows it again, kept
  await openEntity(page, "Dim Product");
  await segment(historySeg(page), "2 · history").click();
  await expect(periodField(page)).toHaveCount(0);
  await expect.poll(async () => (await cubeRow(typeEntity("prod")))?.history).toBe("history");
  expect((await cubeRow(typeEntity("prod")))?.snapshot_period).toBe("Month-end");
  await segment(historySeg(page), "Snapshot").click();
  await expect(periodField(page)).toHaveValue("Month-end");
  await expect.poll(async () => (await cubeRow(typeEntity("prod")))?.history).toBe("snapshot");

  // the delete preview, cancelled
  await card(page, "Dim Product").getByTestId("card-name").click();
  await page.getByTestId("button-delete-entity").click();
  const del = page.getByTestId("dialog-delete-entity");
  await expect(del.getByTestId("table-entity-impact").locator("tbody tr").filter({ hasText: "history" })).toHaveText([/^Dimension\s*its history \(Snapshot · Month-end\) deleted$/]);
  await page.keyboard.press("Escape");
  await expect(del).toBeHidden();
});
