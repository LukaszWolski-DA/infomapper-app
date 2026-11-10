// S23-01 (slice 23, items 1–3, D-78): the workspace home's "Metadata conventions" tab between People and Settings, for
// every member: both tables with every built-in row of the seed, their codes, their definitions in English and their
// uses; Data Vault rows dimmed with the mode off and not with it on; read only for a reviewer, a reader and in an archived
// workspace. Slice 24 (item 8): the intro names the entity panels' stereotypes and the last line no longer lists them.

import { BUILTIN_TEXTS } from "../../src/domain/model/classifications";
import { expect, test, type Page } from "./fixtures";
import { archive, definitionInput, openConventions, rowOf, setDataVault } from "./helpers";

const COLUMN_CODES = ["BK", "PII", "TECH", "LDTS", "RSRC", "EFF", "LK", "DCK", "DK", "MAK"];
const TABLE_CODES = ["T_MASTER", "T_TXN", "T_REF", "T_STG", "T_LOG", "T_HIST", "T_HUB", "T_LNK", "T_SAT"];

const codesIn = (page: Page, scope: "column" | "table") =>
  page.getByTestId(`section-${scope}-classifications`).getByTestId("classification-row").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-code")));

test("S23-01: the tab between People and Settings with every built-in row, codes, English definitions and uses", async ({ page }) => {
  await openConventions(page);
  await expect(page.locator('[role="tablist"] [role="tab"]')).toHaveText(["Overview", /^People \(\d+\)$/, "Metadata conventions", "Settings"]);
  await expect(page.getByTestId("tab-conventions")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("text-conventions-intro")).toHaveText(
    "The workspace's conventions, in one place. The import matches classifications by their name or code; table and column panels set them; entity panels offer the stereotypes; documents and exports print their definitions.",
  );
  await expect(page.getByTestId("box-classifications").locator("h4")).toHaveText(["For source columns", "For source tables"]);
  await expect(page.getByTestId("section-column-classifications").locator("th")).toHaveText(["Name", "Code", "Definition", "Used", ""]);
  expect(await codesIn(page, "column")).toEqual(COLUMN_CODES);
  expect(await codesIn(page, "table")).toEqual(TABLE_CODES);
  for (const code of [...COLUMN_CODES, ...TABLE_CODES] as (keyof typeof BUILTIN_TEXTS.en)[]) {
    await expect(rowOf(page, code).getByTestId("classification-code")).toHaveText(code);
    await expect(definitionInput(rowOf(page, code))).toHaveValue(BUILTIN_TEXTS.en[code].definition);
  }
  await expect(rowOf(page, "BK").getByTestId("input-classification-name")).toHaveValue("Business key");
  await expect(rowOf(page, "BK").getByTestId("classification-uses")).toHaveText("used 4×");
  await expect(rowOf(page, "LDTS").getByTestId("classification-uses")).toHaveText("unused");
  await expect(page.getByTestId("text-conventions-later")).toHaveText(
    "Later, in their own slices: the map from physical to logical types, an organization's default conventions.",
  );
});

test("S23-01: Data Vault rows are dimmed while the mode is off and not dimmed with it on", async ({ page }) => {
  await openConventions(page);
  for (const code of ["LK", "DCK", "DK", "MAK", "T_HUB", "T_LNK", "T_SAT"]) {
    await expect(rowOf(page, code)).toHaveAttribute("data-dimmed", "true");
    await expect(rowOf(page, code).getByTestId("chip-data-vault")).toHaveText("Data Vault 2.0 · hidden while the mode is off");
  }
  await expect(rowOf(page, "BK")).not.toHaveAttribute("data-dimmed", "true");
  await expect(rowOf(page, "BK").getByTestId("chip-data-vault")).toHaveCount(0);
  // still editable while hidden in the panels (D-57)
  await expect(rowOf(page, "LK").getByTestId("input-classification-name")).toBeEditable();

  await setDataVault(true);
  await page.reload();
  await expect(rowOf(page, "LK")).not.toHaveAttribute("data-dimmed", "true");
  await expect(rowOf(page, "LK").getByTestId("chip-data-vault")).toHaveText("Data Vault 2.0");
});

async function expectReadOnly(page: Page) {
  const box = page.getByTestId("box-classifications");
  await expect(box.getByTestId("classification-row")).toHaveCount(19);
  await expect(box.locator("input, button")).toHaveCount(0);
  await expect(box.locator("textarea:not([readonly])")).toHaveCount(0);
  await expect(rowOf(page, "BK").getByTestId("classification-name")).toHaveText("Business key");
  await expect(page.getByTestId("box-concept-colours").locator("button:enabled")).toHaveCount(0);
  await expect(page.getByTestId("input-naming-conventions")).toHaveAttribute("readonly", "");
}

test("S23-01: a reviewer, a reader and an archived workspace see the tab read only", async ({ page, browser }) => {
  for (const who of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
    const context = await browser.newContext();
    const p = await context.newPage();
    await openConventions(p, who);
    await expectReadOnly(p);
    await context.close();
  }
  await archive();
  await openConventions(page);
  await expectReadOnly(page);
});
