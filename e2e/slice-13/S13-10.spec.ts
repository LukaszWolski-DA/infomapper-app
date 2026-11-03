import { addPerson, changeRoleAs, signInWithPassword, signOutViaMenu } from "../slice-08/helpers";
import { expect, test, type Page } from "./fixtures";
import { archive, canvasUrl, entityNamed, expectToast, FULL, hydrated, loadProject, notSaved, openCanvas, openEntityFromTree, projectHome, RETAIL, SEED_IDS, signInAs } from "./helpers";

// S13-10 (item 9, F17): a save refused because the workspace was archived meanwhile, or the person's role became
// reviewer: the refusal's fresh page makes the field read-only, and the typed text stays in it, selectable, marked "Not
// saved. You can still copy it."; nothing is written. The project home keeps its fields (read-only) for the draft. A
// locked organization's refusal brings no fresh page (it would be the password form): the draft stays editable.

const COPY = "Not saved. You can still copy it.";

async function customerPanel(page: Page, who: "Łukasz" | "Anna Nowak") {
  await signInAs(page, who);
  await openCanvas(page, canvasUrl(), FULL);
  await hydrated(page);
  await openEntityFromTree(page, "Customer");
  return page.getByTestId("panel-entity");
}

/** The field's text is selectable: a read-only input whose whole text can be selected. */
async function expectCopyable(field: import("@playwright/test").Locator, text: string) {
  await expect(field).toHaveValue(text);
  await expect(field).toHaveJSProperty("readOnly", true);
  await expect(field).toBeEnabled();
  await field.selectText();
  expect(await field.evaluate((el: HTMLInputElement) => el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0))).toBe(text);
}

test("S13-10: archived meanwhile: the entity's name stays readable and selectable, Not saved, nothing written", async ({ page }) => {
  const panel = await customerPanel(page, "Łukasz");
  await archive();
  const name = panel.getByTestId("input-entity-name");
  await name.fill("Kunde");
  await name.press("Enter");
  await expectToast(page, /archived/i);
  await expect(notSaved(panel)).toHaveText(COPY);
  await expectCopyable(name, "Kunde");
  expect((await entityNamed("Customer")).name).toBe("Customer");
});

test("S13-10: the role became reviewer meanwhile: the alias stays readable and selectable, Not saved, nothing written", async ({ page }) => {
  const panel = await customerPanel(page, "Anna Nowak");
  await changeRoleAs(SEED_IDS.userLukasz, RETAIL, SEED_IDS.userAnna, "reviewer");
  const alias = panel.getByTestId("input-entity-alias");
  await alias.fill("Klient");
  await alias.press("Enter");
  await expectToast(page, /reviewer/i);
  await expect(notSaved(panel)).toHaveText(COPY);
  await expectCopyable(alias, "Klient");
  expect((await entityNamed("Customer")).alias).toBeNull();
});

test("S13-10: archived meanwhile on the project home: the description stays in a read-only field, Not saved", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(projectHome());
  await hydrated(page);
  const before = (await loadProject()).description;
  await archive();
  const description = page.getByTestId("field-project-description");
  await description.fill("Mine, typed before the archive.");
  await description.blur();
  await expectToast(page, /archived/i);
  await expect(page.getByTestId("draft-not-saved")).toHaveText(COPY);
  await expect(description).toHaveValue("Mine, typed before the archive.");
  await expect(description).toHaveJSProperty("readOnly", true);
  expect((await loadProject()).description).toBe(before);
});

test("S13-10: a locked organization: no fresh page, the draft stays editable, Not saved", async ({ page, browser }) => {
  // Anna also works in Retail Co; signing in there with its password leaves InfoMate locked in her session
  await addPerson(SEED_IDS.userMarek, SEED_IDS.wsSales, { name: "Anna", email: "anna.nowak@infomate.pl", role: "modeler" });
  const panel = await customerPanel(page, "Anna Nowak");
  const other = await page.context().newPage();
  await other.goto(`/w/${RETAIL}`);
  await signOutViaMenu(other);
  await signInWithPassword(other, "anna.nowak@infomate.pl", "Retail Co");
  await other.close();
  void browser;

  const alias = panel.getByTestId("input-entity-alias");
  await alias.fill("Klient");
  await alias.press("Enter");
  await expectToast(page, "Unlock InfoMate first: open it and enter its password.");
  await expect(notSaved(panel)).toHaveText("Not saved");
  await expect(alias).toHaveValue("Klient");
  await expect(alias).toHaveJSProperty("readOnly", false);
  expect((await entityNamed("Customer")).alias).toBeNull();
});
