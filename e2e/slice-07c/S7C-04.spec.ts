// S7C-04: an own classification added; a built-in and an own one renamed; a taken name refused; the new name shows in the
// panels and the review; an import matches the new name and the built-in's code.

import { expect, test } from "./fixtures";
import { classesOf, columnId, expectPressed, fileOf, groups, listRow, loadModel, openColumn, openList, renameBuiltin, reviewFile, reviewRow, toggle } from "./helpers";

test("S7C-04: add an own classification, rename a built-in and an own one; the panels show the new names", async ({ page }) => {
  await openColumn(page, "customers", "cust_no");
  await openList(page);
  const dialog = page.getByTestId("dialog-classifications");
  await expect(dialog).toContainText("One list for the workspace. Data Vault ones show while Data Vault 2.0 mode is on in the workspace settings.");
  await expect(dialog.getByTestId("section-column-classifications").getByTestId("classification-row")).toHaveCount(10);
  await expect(dialog.getByTestId("section-table-classifications").getByTestId("classification-row")).toHaveCount(9);
  // the Data Vault ones show with their chip whatever the mode (F21); uses and "built in"
  await expect(listRow(page, "Link key").getByTestId("chip-data-vault")).toHaveText("Data Vault 2.0");
  await expect(listRow(page, "Business key").getByTestId("classification-uses")).toHaveText("used 4×");
  await expect(listRow(page, "Personal data").getByTestId("classification-uses")).toHaveText("used 6×");
  await expect(listRow(page, "Load date").getByTestId("classification-uses")).toHaveText("unused");
  await expect(listRow(page, "Load date")).toContainText("built in");

  // add an own one
  await dialog.getByTestId("input-new-column-classification").fill("Hash candidate");
  await dialog.getByTestId("button-add-column-classification").click();
  await expect(listRow(page, "Hash candidate")).toBeVisible();
  await expect(listRow(page, "Hash candidate")).not.toContainText("built in");
  await expect.poll(async () => (await loadModel()).classifications.find((c) => c.name === "Hash candidate")).toMatchObject({ code: null, scope: "column", origin: "own" });

  // a taken name: another's name or a built-in code, in any case and spacing
  for (const taken of ["personal_data", "LK", "hash-candidate"]) {
    await dialog.getByTestId("input-new-column-classification").fill(taken);
    await dialog.getByTestId("button-add-column-classification").click();
    await expect(dialog.getByTestId("classification-name-error")).toHaveText("That name is taken");
  }
  // the same name for a table is fine
  await dialog.getByTestId("input-new-table-classification").fill("Hash candidate");
  await dialog.getByTestId("button-add-table-classification").click();
  await expect(dialog.getByTestId("section-table-classifications").getByTestId("classification-row")).toHaveCount(10);

  // rename a built-in one, and an own one; a taken name refused
  const bk = listRow(page, "Business key").getByTestId("input-classification-name");
  await bk.fill("Klucz biznesowy");
  await bk.press("Enter");
  await expect.poll(async () => (await loadModel()).classifications.find((c) => c.code === "BK")!.name).toBe("Klucz biznesowy");
  const own = listRow(page, "Hash candidate").first().getByTestId("input-classification-name");
  await own.fill("Load-Date");
  await own.press("Enter");
  await expect(listRow(page, "Hash candidate").first().getByTestId("classification-name-error")).toHaveText("That name is taken");
  await own.fill("Hash key candidate");
  await own.press("Enter");
  await expect.poll(async () => (await loadModel()).classifications.filter((c) => c.name === "Hash key candidate")).toHaveLength(1);
  await expect(dialog.getByText("A new name is also the name an import file must use; for built-in ones the code (e.g. BK) keeps working.")).toBeVisible();
  await page.keyboard.press("Escape");

  // the panel: the renamed Business key still pressed (the code), the own one under "This workspace"
  await expect(groups(page)).toHaveText(["General", "This workspace"]);
  await expectPressed(page, "Klucz biznesowy", true);
  await toggle(page, "Hash key candidate").click();
  await expectPressed(page, "Hash key candidate", true);
  await expect.poll(async () => classesOf(await columnId("customers", "cust_no"))).toEqual(["BK", "Hash key candidate"]);
});

test("S7C-04 (the import's part): an import matches a renamed built-in's new name and its code, and an own one's name", async ({ page }) => {
  await renameBuiltin("BK", "Klucz biznesowy");
  await openColumn(page, "customers", "cust_no");
  await openList(page);
  const dialog = page.getByTestId("dialog-classifications");
  await dialog.getByTestId("input-new-column-classification").fill("Hash candidate");
  await dialog.getByTestId("button-add-column-classification").click();
  await expect(listRow(page, "Hash candidate")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("tab-sources").click();
  await page.getByTestId("button-import-sources").click();
  const file = fileOf([
    ["t", "a", "int", { pk: true, cls: "Klucz biznesowy" }],
    ["t", "b", "int", { cls: "bk" }],
    ["t", "c", "int", { cls: "hash candidate" }],
    ["t", "d", "int", { cls: "Business key" }],
  ]);
  await reviewFile(page, { new: "Renamed feed" }, "renamed.csv", file);
  await expect(reviewRow(page, "a").getByTestId("review-classification")).toHaveText(["Klucz biznesowy"]);
  await expect(reviewRow(page, "b").getByTestId("review-classification")).toHaveText(["Klucz biznesowy"]);
  await expect(reviewRow(page, "c").getByTestId("review-classification")).toHaveText(["Hash candidate"]);
  await expect(page.getByTestId("review-warnings")).toContainText("Unknown classification “Business key” on s.t.d (row 5), ignored.");
});
