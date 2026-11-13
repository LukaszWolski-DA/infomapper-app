// S26-09 (slice 26, PRD item 9, Q8): a document in German in a Polish workspace; a recipe from slice 25 (no style)
// opens in the workspace's language, and the language select shows the language in effect.

import { expect, test } from "./fixtures";
import { changeDb, DEMO_DOCUMENT_NAMES, formUrl, keepOnly, laidOut, openEditor, RETAIL, setWorkspace, signInAs, storedDocument, viewUrl } from "./helpers";

const SHARED = DEMO_DOCUMENT_NAMES.shared;

const headings = (page: import("@playwright/test").Page) => page.locator('[data-testid="document-host"] h2[id]').allTextContents();

test("S26-09: a document in German in a Polish workspace", async ({ page }) => {
  await keepOnly(SHARED, ["text", "dict"]);
  await setWorkspace(RETAIL, { doc_language: "pl" });
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(SHARED))!;
  await openEditor(page, formUrl(doc.id));
  // the seeded document follows the workspace: Polish, shown as the language in effect
  await expect(page.getByTestId("select-style-language")).toHaveValue("pl");
  await expect(page.locator('[data-testid="document-host"] h2[id]').first()).toHaveText(/Wprowadzenie$/);
  await page.getByTestId("select-style-language").selectOption("de");
  await expect.poll(async () => (await storedDocument(SHARED))!.style.language).toBe("de");

  await page.goto(viewUrl(doc.id));
  await laidOut(page);
  expect(await headings(page)).toEqual(["1Einleitung", "2Datenkatalog"]);
  await expect(page.locator('[data-testid="document-host"] .dtoc h2')).toHaveText("Inhalt");
  // names and definitions stay as the model has them
  await expect(page.getByTestId("document-host")).toContainText("A person or organisation that buys from us.");
});

test("S26-09: a recipe stored before slice 26 opens in the workspace's language", async ({ page }) => {
  await keepOnly(SHARED, ["text", "dict"]);
  await setWorkspace(RETAIL, { doc_language: "pl" });
  // the row as slice 25 stored it: no style, Text's heading in its options
  await changeDb((db) => {
    const row = (db as unknown as { document_definition: Record<string, unknown>[] }).document_definition.find((d) => d.name === SHARED)!;
    delete row.style;
    row.sections = (row.sections as Record<string, unknown>[]).map((s) => ({ id: s.id, type: s.type, on: s.on, options: s.type === "text" ? { heading: null, ...(s.options as object) } : s.options }));
  });
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(SHARED))!;
  await openEditor(page, formUrl(doc.id));
  await expect(page.getByTestId("select-style-language")).toHaveValue("pl");
  await page.goto(viewUrl(doc.id));
  await laidOut(page);
  expect(await headings(page)).toEqual(["1Wprowadzenie", "2Słownik danych"]);
});
