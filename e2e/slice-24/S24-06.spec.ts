// S24-06 (slice 24, decision 7): a new workspace in Polish has "Obiekt" … with the Polish definitions, one in German
// "Objekt" …; changing the language later renames nothing.

import { BUILTIN_STEREOTYPE_TEXTS } from "../../src/domain/model/stereotypes";
import { expect, test } from "./fixtures";
import { conventionsUrl, expectToast, hydrated, openConventions, settingsTabUrl, stCodes, stDefinition, stName, stRow, storedStereotypes, workspaceNamed } from "./helpers";

test("S24-06: a Polish workspace gets the Polish names and definitions; a later language change renames nothing", async ({ page }) => {
  await openConventions(page);
  await page.getByTestId("switcher-workspace").click();
  await page.getByTestId("select-new-workspace-language").selectOption("pl");
  await page.getByTestId("input-new-workspace").fill("Hurtownia");
  await page.getByTestId("input-new-workspace").press("Enter");
  await expectToast(page, "Created the workspace Hurtownia.");
  await expect.poll(async () => (await workspaceNamed("Hurtownia"))?.doc_language).toBe("pl");
  const ws = (await workspaceNamed("Hurtownia"))!;
  expect((await storedStereotypes(ws.id)).map((s) => s.name)).toEqual(["Obiekt", "Powiązanie", "Słownik", "Kontekst", "Informacyjna"]);

  await page.goto(conventionsUrl(ws.id));
  await hydrated(page);
  expect(await stCodes(page)).toEqual(["object", "link", "dictionary", "context", "informative"]);
  await expect(stName(stRow(page, "object"))).toHaveValue("Obiekt");
  await expect(stDefinition(stRow(page, "link"))).toHaveValue(BUILTIN_STEREOTYPE_TEXTS.pl.link.definition);
  await expect(stRow(page, "object").getByTestId("stereotype-uses")).toHaveText("unused");

  await page.goto(settingsTabUrl(ws.id));
  await hydrated(page);
  await page.getByTestId("select-workspace-language").selectOption("de");
  await expectToast(page, "Settings saved.");
  await expect.poll(async () => (await workspaceNamed("Hurtownia"))?.doc_language).toBe("de");
  expect((await storedStereotypes(ws.id)).map((s) => [s.name, s.definition, s.version])).toEqual(
    (["object", "link", "dictionary", "context", "informative"] as const).map((code) => [BUILTIN_STEREOTYPE_TEXTS.pl[code].name, BUILTIN_STEREOTYPE_TEXTS.pl[code].definition, 1]),
  );
});

test("S24-06: a German first workspace from the start page's organization form", async ({ page }) => {
  await page.goto("/sign-in");
  const form = page.getByTestId("panel-create-organization");
  const values = { organizationName: "Deutsche Org", name: "Jan Test", email: "jan@example.com", password: "correct horse", passwordAgain: "correct horse", workspaceName: "Lager" };
  for (const [key, value] of Object.entries(values)) await page.getByTestId(`input-create-${key}`).fill(value);
  await form.getByTestId("select-create-workspaceLanguage").selectOption("de");
  await form.getByTestId("button-create-continue").click();
  await form.getByTestId("button-create").click();
  await expectToast(page, "Created Deutsche Org with an empty first workspace.");
  await expect.poll(async () => (await workspaceNamed("Lager"))?.doc_language).toBe("de");
  const ws = (await workspaceNamed("Lager"))!;
  expect((await storedStereotypes(ws.id)).map((s) => [s.name, s.definition])).toEqual(
    (["object", "link", "dictionary", "context", "informative"] as const).map((code) => [BUILTIN_STEREOTYPE_TEXTS.de[code].name, BUILTIN_STEREOTYPE_TEXTS.de[code].definition]),
  );
  expect((await storedStereotypes(ws.id))[0]!.name).toBe("Objekt");
});
