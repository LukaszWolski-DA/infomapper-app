// S23-03 (slice 23, item 6, decision 3, F4, D-78): "Hash candidate" with the code `hash` is added as `HASH`; the code is
// read only afterwards; a bad code and a taken code (a built-in code, an earlier own code, a removed one's, the import's
// comparison) are refused with their texts; one without a code shows "—". An import file naming `HASH` sets it: the
// import's reading is a unit test (`src/domain/import/classifications.test.ts`, "an own classification's code"), and the
// review shows it here.

import { expect, test } from "./fixtures";
import { addOwn, expectToast, fileOf, openConventions, reviewFile, reviewRow, rowNamed, rowOf, stored } from "./helpers";
import { canvasUrl, openCanvas } from "../slice-07a/helpers";

test("S23-03: an own classification with a code; the code read only; bad and taken codes refused; one without a code", async ({ page }) => {
  await openConventions(page, "Anna Nowak");
  await addOwn(page, "column", "Hash candidate", " hash ");
  await expect(rowOf(page, "HASH")).toBeVisible();
  await expect.poll(async () => stored({ name: "Hash candidate" })).toMatchObject({ code: "HASH", origin: "own", scope: "column", definition: null });
  const hash = rowOf(page, "HASH");
  await expect(hash.getByTestId("classification-code")).toHaveText("HASH");
  await expect(hash.getByTestId("chip-own")).toHaveText("own");
  // read only afterwards: the code is text, not a field
  await expect(hash.getByTestId("classification-code").locator("input")).toHaveCount(0);
  await expect(page.getByTestId("input-new-column-classification")).toHaveValue("");
  await expect(page.getByTestId("input-new-column-code")).toHaveValue("");

  // a bad code
  await addOwn(page, "column", "Something", "9x");
  await expect(page.getByTestId("section-column-classifications").getByTestId("classification-code-error")).toHaveText("Letters, digits and _; starting with a letter");
  // taken: a built-in code, the earlier own code, the import's comparison, a table code
  for (const code of ["BK", "hash", "HA_SH", "T_HUB", "thub"]) {
    await addOwn(page, "column", "Something", code);
    await expect(page.getByTestId("section-column-classifications").getByTestId("classification-code-error")).toHaveText("That code is taken");
  }
  // a removed own one's code stays taken (F16)
  await addOwn(page, "table", "Old source", "OLD");
  await expect(rowOf(page, "OLD")).toBeVisible();
  await rowOf(page, "OLD").getByTestId("button-remove-classification").click();
  await expectToast(page, "Removed Old source from the list.");
  await expect(rowOf(page, "OLD")).toHaveCount(0);
  await addOwn(page, "table", "New source", "old");
  await expect(page.getByTestId("section-table-classifications").getByTestId("classification-code-error")).toHaveText("That code is taken");
  // a name equal to an own code is taken too
  await addOwn(page, "column", "hash", "");
  await expect(page.getByTestId("section-column-classifications").getByTestId("classification-name-error")).toHaveText("That name is taken");

  // without a code: "—" with its title
  await addOwn(page, "column", "Golden copy", "");
  const golden = rowNamed(page, "Golden copy");
  await expect(golden.getByTestId("classification-code")).toHaveText("—");
  await expect(golden.getByTestId("classification-code").locator("span")).toHaveAttribute("title", "No code: an import file names it by its name");
  expect((await stored({ name: "Golden copy" }))?.code).toBeNull();
  expect((await stored({ name: "Something" }))).toBeUndefined();
});

test("S23-03 (the import's part): a file naming the own code HASH matches Hash candidate in the review", async ({ page }) => {
  await openConventions(page);
  await addOwn(page, "column", "Hash candidate", "HASH");
  await expect(rowOf(page, "HASH")).toBeVisible();
  await openCanvas(page, canvasUrl());
  await page.getByTestId("tab-sources").click();
  await page.getByTestId("button-import-sources").click();
  const file = fileOf([
    ["t", "a", "int", { cls: "HASH" }],
    ["t", "b", "int", { cls: "hash candidate" }],
  ]);
  await reviewFile(page, { new: "Hashed feed" }, "hashed.csv", file);
  await expect(reviewRow(page, "a").getByTestId("review-classification")).toHaveText(["Hash candidate"]);
  await expect(reviewRow(page, "b").getByTestId("review-classification")).toHaveText(["Hash candidate"]);
});
