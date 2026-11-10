// S24-02 (slice 24, items 1, 2, 7, 8, 11): the Metadata conventions tab's "Entity stereotypes" box between Classifications
// and Concept colours: the five rows with their codes, English definitions and uses ("4 entities" on Object, logical ones
// only), no Remove on a built-in one; the tab's first and last lines; Settings' sentence; read only for a reviewer, a
// reader and an archived workspace.

import { BUILTIN_STEREOTYPE_CODES, BUILTIN_STEREOTYPE_TEXTS } from "../../src/domain/model/stereotypes";
import { expect, test, type Page } from "./fixtures";
import { archive, box, hydrated, openConventions, settingsTabUrl, stCodes, stDefinition, stName, stRow } from "./helpers";

test("S24-02: the box with the five built-in rows, their codes, definitions and uses", async ({ page }) => {
  await openConventions(page);
  await expect(page.locator('[data-testid="page-conventions"] > section h3')).toHaveText(["Classifications", "Entity stereotypes", "Concept colours", "Naming conventions"]);
  await expect(box(page).locator("h3 + p")).toHaveText(
    "What an entity is in the model. Names and definitions are the workspace's; codes never change, so entities, imports and exports keep them while names change. The five built-in ones stay (Object is a new entity's stereotype and every fact's and dimension's); own ones can be added and removed. Facts and dimensions show their InfoCube role instead.",
  );
  await expect(box(page).locator("th")).toHaveText(["Name", "Code", "Definition", "Used", ""]);
  expect(await stCodes(page)).toEqual([...BUILTIN_STEREOTYPE_CODES]);
  for (const code of BUILTIN_STEREOTYPE_CODES) {
    await expect(stName(stRow(page, code))).toHaveValue(BUILTIN_STEREOTYPE_TEXTS.en[code].name);
    await expect(stRow(page, code).getByTestId("stereotype-code")).toHaveText(code);
    await expect(stDefinition(stRow(page, code))).toHaveValue(BUILTIN_STEREOTYPE_TEXTS.en[code].definition);
    await expect(stRow(page, code).getByTestId("button-remove-stereotype")).toHaveCount(0);
    await expect(stRow(page, code).getByTestId("chip-own")).toHaveCount(0);
  }
  await expect(stRow(page, "object").getByTestId("stereotype-uses")).toHaveText("4 entities");
  await expect(stRow(page, "link").getByTestId("stereotype-uses")).toHaveText("1 entity");
  await expect(stRow(page, "dictionary").getByTestId("stereotype-uses")).toHaveText("1 entity");
  await expect(stRow(page, "context").getByTestId("stereotype-uses")).toHaveText("unused");
  await expect(page.getByTestId("input-new-stereotype")).toHaveAttribute("placeholder", "New stereotype, e.g. Event");
  await expect(page.getByTestId("input-new-stereotype-code")).toHaveAttribute("placeholder", "Code, e.g. event");
  await expect(page.getByTestId("add-stereotype")).toContainText("The code is proposed from the name; letters, digits and _, starting with a letter. It cannot change later.");

  await expect(page.getByTestId("text-conventions-intro")).toHaveText(
    "The workspace's conventions, in one place. The import matches classifications by their name or code; table and column panels set them; entity panels offer the stereotypes; documents and exports print their definitions.",
  );
  await expect(page.getByTestId("text-conventions-later")).toHaveText("Later, in their own slices: the map from physical to logical types, an organization's default conventions.");

  await page.goto(settingsTabUrl());
  await hydrated(page);
  await expect(page.getByTestId("box-model-conventions").locator("p")).toHaveText("Classifications, entity stereotypes, concept colours and naming conventions are edited in Metadata conventions.");
});

async function expectReadOnly(page: Page) {
  await expect(box(page).getByTestId("stereotype-row")).toHaveCount(5);
  await expect(box(page).locator("input, button")).toHaveCount(0);
  await expect(box(page).locator("textarea:not([readonly])")).toHaveCount(0);
  await expect(stRow(page, "link").getByTestId("stereotype-name")).toHaveText("Link");
}

test("S24-02: a reviewer, a reader and an archived workspace see the box read only", async ({ page, browser }) => {
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
