import { expect, test } from "./fixtures";
import { canvasUrl, card, expectToast, loadModel, openCanvas, signInAs, treeItem } from "./helpers";

test("S1A-13: “New source table” with columns typed as lines creates the table and its columns with types and lengths", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await page.getByTestId("tab-sources").click();
  await page.getByTestId("button-new-source-table").click();

  const dialog = page.getByTestId("dialog-new-source-table");
  await dialog.getByTestId("input-new-table-systemName").fill("CRM");
  await dialog.getByTestId("input-new-table-databaseName").fill("crmprod");
  await dialog.getByTestId("input-new-table-schemaName").fill("dbo");
  await dialog.getByTestId("input-new-table-name").fill("loyalty_cards");
  // lines as typed, or pasted from a CREATE TABLE statement (trailing commas)
  await dialog.getByTestId("input-new-table-columns").fill("card_id int,\nemail varchar(255),\nbalance decimal(18,2),\nnotes nvarchar(max),\nissued_at datetime2");
  await dialog.getByTestId("button-create-table").click();
  await expectToast(page, "Created CRM / crmprod.dbo.loyalty_cards with 5 columns.");
  await expect(dialog).toHaveCount(0);

  // placed on the canvas, listed under CRM › crmprod.dbo, with the types on the card
  await expect(card(page, "loyalty_cards").locator("[data-row]")).toHaveText([
    /card_id\s*int/,
    /email\s*varchar\(255\)/,
    /balance\s*decimal\(18,2\)/,
    /notes\s*nvarchar/,
    /issued_at\s*datetime2/,
  ]);
  await expect(treeItem(page, "loyalty_cards")).toHaveAttribute("data-presence", "here");
  await expect(treeItem(page, "loyalty_cards")).toContainText("5 cols");

  const model = await loadModel();
  const table = model.sourceTables.find((t) => t.name === "loyalty_cards")!;
  expect(model.sourceSystems.filter((s) => s.name === "CRM")).toHaveLength(1); // the existing system is reused
  expect(table).toMatchObject({ database_name: "crmprod", schema_name: "dbo", source_system_id: model.sourceSystems.find((s) => s.name === "CRM")!.id });
  const columns = model.sourceColumns.filter((c) => c.source_table_id === table.id);
  expect(columns.map((c) => [c.ordinal, c.name, c.data_type, c.type_length, c.type_precision, c.type_scale])).toEqual([
    [1, "card_id", "int", null, null, null],
    [2, "email", "varchar", 255, null, null],
    [3, "balance", "decimal", null, 18, 2],
    [4, "notes", "nvarchar", null, null, null],
    [5, "issued_at", "datetime2", null, null, null],
  ]);

  // a line that is not a column is refused with the line number
  await page.getByTestId("button-new-source-table").click();
  await dialog.getByTestId("input-new-table-systemName").fill("CRM");
  await dialog.getByTestId("input-new-table-databaseName").fill("crmprod");
  await dialog.getByTestId("input-new-table-schemaName").fill("dbo");
  await dialog.getByTestId("input-new-table-name").fill("broken");
  await dialog.getByTestId("input-new-table-columns").fill("id int\nthis is not a column (");
  await dialog.getByTestId("button-create-table").click();
  await expectToast(page, "Line 2: write the column as a name and a type, e.g. email varchar(255).");
  await expect(dialog).toBeVisible();
});
