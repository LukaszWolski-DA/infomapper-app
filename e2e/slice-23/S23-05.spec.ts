// S23-05 (slice 23, items 9–11, F1, D-78): a new workspace with documentation language Polish has "Klucz biznesowy" and
// its Polish definition; German "Fachlicher Schlüssel"; both places a workspace is created have the language (the top
// bar's "New workspace" and creating an organization, a deliberate difference from the prototype); changing the language
// afterwards renames nothing. A workspace from before the slice keeps its names and gets definitions in its language:
// the local file's upgrade, a unit test (`src/data/local/upgrade-15.test.ts`).

import { BUILTIN_TEXTS } from "../../src/domain/model/classifications";
import { expect, test } from "./fixtures";
import { builtinOfWorkspace, conventionsUrl, definitionInput, expectToast, hydrated, openConventions, rowOf, settingsTabUrl, workspaceNamed } from "./helpers";

test("S23-05: a Polish workspace from the top bar; changing its language later renames nothing", async ({ page }) => {
  await openConventions(page);
  await page.getByTestId("switcher-workspace").click();
  await expect(page.getByTestId("select-new-workspace-language")).toHaveValue("en");
  await expect(page.getByTestId("select-new-workspace-language").locator("option")).toHaveText(["English", "Polski", "Deutsch"]);
  await page.getByTestId("select-new-workspace-language").selectOption("pl");
  await page.getByTestId("input-new-workspace").fill("Hurtownia");
  await page.getByTestId("input-new-workspace").press("Enter");
  await expectToast(page, "Created the workspace Hurtownia.");
  await expect.poll(async () => (await workspaceNamed("Hurtownia"))?.doc_language).toBe("pl");
  const ws = (await workspaceNamed("Hurtownia"))!;
  expect(await builtinOfWorkspace(ws.id, "BK")).toMatchObject({ name: "Klucz biznesowy", definition: BUILTIN_TEXTS.pl.BK.definition });

  await page.goto(conventionsUrl(ws.id));
  await hydrated(page);
  await expect(rowOf(page, "BK").getByTestId("input-classification-name")).toHaveValue("Klucz biznesowy");
  await expect(definitionInput(rowOf(page, "BK"))).toHaveValue(BUILTIN_TEXTS.pl.BK.definition);
  await expect(rowOf(page, "T_REF").getByTestId("input-classification-name")).toHaveValue("Słownik / lista kodów");

  // the language changed in the settings: no name or definition changes
  await page.goto(settingsTabUrl(ws.id));
  await hydrated(page);
  await page.getByTestId("select-workspace-language").selectOption("de");
  await expectToast(page, "Settings saved.");
  await expect.poll(async () => (await workspaceNamed("Hurtownia"))?.doc_language).toBe("de");
  expect(await builtinOfWorkspace(ws.id, "BK")).toMatchObject({ name: "Klucz biznesowy", definition: BUILTIN_TEXTS.pl.BK.definition, version: 1 });
});

test("S23-05: a German first workspace from the start page's organization form", async ({ page }) => {
  await page.goto("/sign-in");
  const form = page.getByTestId("panel-create-organization");
  await expect(form.getByTestId("select-create-workspaceLanguage")).toHaveValue("en");
  const values = { organizationName: "Deutsche Org", name: "Jan Test", email: "jan@example.com", password: "correct horse", passwordAgain: "correct horse", workspaceName: "Lager" };
  for (const [key, value] of Object.entries(values)) await page.getByTestId(`input-create-${key}`).fill(value);
  await form.getByTestId("select-create-workspaceLanguage").selectOption("de");
  await form.getByTestId("button-create-continue").click();
  await form.getByTestId("button-create").click();
  await expectToast(page, "Created Deutsche Org with an empty first workspace.");
  await expect.poll(async () => (await workspaceNamed("Lager"))?.doc_language).toBe("de");
  const ws = (await workspaceNamed("Lager"))!;
  expect(await builtinOfWorkspace(ws.id, "BK")).toMatchObject({ name: "Fachlicher Schlüssel", definition: BUILTIN_TEXTS.de.BK.definition });
  expect(await builtinOfWorkspace(ws.id, "PII")).toMatchObject({ name: "Personenbezogene Daten" });
});
