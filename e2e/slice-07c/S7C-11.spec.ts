// S7C-11: suggestions: Business key and, in Data Vault 2.0 mode, Link key offered by their rules; an unticked one is not
// written; ticked ones become links and go with the import's undo; changing the list or a tick between the review and
// the import refreshes the review.

import { expect, test } from "./fixtures";
import { classesOf, expectToast, fileOf, importNow, loadModel, openWizard, renameBuiltin, reviewFile, reviewRow, setDataVault, undo } from "./helpers";

const FILE = fileOf([
  ["parent", "id", "int", { pk: true }],
  ["parent", "name", "varchar(40)"],
  ["child", "id", "int", { pk: true }],
  ["child", "parent_id", "int", { fk: ["parent", "id"] }],
  ["keyed", "id", "int", { pk: true }],
  ["keyed", "code", "varchar(10)", { cls: "BK" }],
]);

const columnOf = async (table: string, column: string) => {
  const m = await loadModel();
  const sys = m.sourceSystems.find((s) => s.name === "Orders feed")!;
  const t = m.sourceTables.find((x) => x.source_system_id === sys.id && x.name === table)!;
  return m.sourceColumns.find((c) => c.source_table_id === t.id && c.name === column)!.id;
};

test("S7C-11: Business key and Link key suggested by their rules; an unticked one not written; the ticked ones go with the import's undo", async ({ page }) => {
  await setDataVault(true);
  await openWizard(page);
  await reviewFile(page, { new: "Orders feed" }, "orders.csv", FILE);
  await expect(page.getByText("Suggestions only. Untick what does not fit; you can change classifications on the column later.")).toBeVisible();
  const suggestions = page.getByTestId("review-suggestion");
  await expect(suggestions).toHaveText([
    "s.parent.idBusiness keythe only primary key column, and the table has no business key",
    "s.child.idBusiness keythe only primary key column, and the table has no business key",
    "s.child.parent_idLink keyData Vault 2.0a foreign key: a candidate for a link between hubs",
  ]);
  for (const box of await page.getByTestId("checkbox-suggestion").all()) await expect(box).toBeChecked();
  // a tick changes the plan at once: the import still matches the review
  await suggestions.filter({ hasText: "s.child.parent_id" }).getByTestId("checkbox-suggestion").uncheck();
  await importNow(page, /^Imported into Orders feed: /);
  expect(await classesOf(await columnOf("parent", "id"))).toEqual(["BK"]);
  expect(await classesOf(await columnOf("child", "id"))).toEqual(["BK"]);
  expect(await classesOf(await columnOf("child", "parent_id"))).toEqual([]);
  expect(await classesOf(await columnOf("keyed", "code"))).toEqual(["BK"]);
  expect(await classesOf(await columnOf("keyed", "id"))).toEqual([]);

  // the import's undo takes the links with it
  const links = (await loadModel()).classificationLinks.length;
  await undo(page);
  await expectToast(page, /^Undone: Import orders\.csv/);
  await expect.poll(async () => (await loadModel()).classificationLinks.length).toBe(links - 3);
});

test("S7C-11: without Data Vault 2.0 mode no Link key is suggested", async ({ page }) => {
  await openWizard(page);
  await reviewFile(page, { new: "Orders feed" }, "orders.csv", FILE);
  await expect(page.getByTestId("review-suggestion")).toHaveCount(2);
  await expect(page.getByTestId("review-suggestion").filter({ hasText: "Link key" })).toHaveCount(0);
});

test("S7C-11: the list changed between the review and the import refreshes the review", async ({ page }) => {
  const file = fileOf([["t", "id", "int", { pk: true, cls: "BK" }], ["t", "loaded", "datetime2", { cls: "Load date" }]]);
  await openWizard(page);
  await reviewFile(page, { new: "Loads" }, "loads.csv", file);
  await expect(reviewRow(page, "loaded").getByTestId("review-classification")).toHaveText(["Load date"]);
  // meanwhile Load date is renamed: the file's "Load date" is unknown now
  await renameBuiltin("LDTS", "Loaded at");
  await page.getByTestId("button-wizard-import").click();
  await expect(page.getByTestId("callout-stale")).toHaveText("Loads changed since you opened this review. The review now shows the current state; check it and import again.");
  await expect(page.getByTestId("review-warnings")).toContainText("Unknown classification “Load date” on s.t.loaded (row 3), ignored.");
  await expect(reviewRow(page, "loaded").getByTestId("review-classification")).toHaveCount(0);
});
