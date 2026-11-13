// S25-03 (slice 25, D1, D13, D-59): each preset makes a document with its sections; a change in the form is saved with
// a version (a stale save refused, D-59; the field keeps the draft with the conflict line, D-66) and is a change event;
// Duplicate makes a private copy; Undo does not touch documents.

import { expect, test, type Page } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, docRow, docsUrl, documentEvents, expectToast, formUrl, sectionOf, SEED_IDS, signInAs, storedDocument, storedDocuments, updateDocumentAs } from "./helpers";

async function fromPreset(page: Page, preset: "dictionary" | "s2t" | "blank") {
  await page.goto(docsUrl());
  await page.getByTestId("button-new-document").click();
  await expect(page.getByTestId("dialog-new-document")).toContainText("Start from a preset; everything can be changed afterwards. A new document is private until you share it.");
  await page.getByTestId(`button-preset-${preset}`).click();
  // slice 26: the editor in place of the form
  await expect(page.getByTestId("page-document-editor")).toBeVisible();
  return (await storedDocuments()).find((d) => d.id === page.url().split("/d/")[1])!;
}

test("S25-03: each preset makes a private document with its sections, and opens its form", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const dictionary = await fromPreset(page, "dictionary");
  expect(dictionary).toMatchObject({ name: "Data dictionary for the business", shared: false, author_id: SEED_IDS.userLukasz, audience: "Business", preset: "dictionary", source_kind: "live" });
  expect(dictionary.scope.mappings).toBe("approved");
  // slice 26 (D2): the prototype's preset without Diagrams
  expect(dictionary.sections.map((s) => [s.type, s.on])).toEqual([
    ["text", true],
    ["overview", true],
    ["conv", true],
    ["dict", true],
    ["reqs", true],
    ["dq", true],
    ["classreg", true],
  ]);
  await expect(page.getByTestId("editor-section")).toHaveCount(7);
  await expect(page.getByTestId("text-model-state")).toHaveText("Live model (changes as people work)");

  const s2t = await fromPreset(page, "s2t");
  // InfoCube is off in this seed: no Dimensional model (D1)
  expect(s2t).toMatchObject({ name: "Source-to-target specification for ETL", audience: "ETL developers" });
  expect(s2t.scope.mappings).toBe("notdraft");
  expect(s2t.sections.map((s) => s.type)).toEqual(["conv", "s2t", "sources", "dq"]);
  expect(sectionOf(s2t, "s2t").options).toMatchObject({ unmapped: true, group: "entity" });

  const blank = await fromPreset(page, "blank");
  expect(blank).toMatchObject({ name: "Blank document", audience: null });
  // slice 26: the heading is the entry's (F10)
  expect(blank.sections.map((s) => [s.type, s.heading, s.options])).toEqual([["text", null, { body: "" }]]);
});

test("S25-03: a change is saved with a version and a change event; a stale save is refused and the field keeps the draft", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  await page.goto(formUrl(doc.id));
  // step 4b: the breadcrumbs name the document under Documentation
  await expect(page.getByTestId("breadcrumb")).toHaveText(["InfoMate", "Retail Co – DWH", "Documentation", DEMO_DOCUMENT_NAMES.shared]);
  const before = (await documentEvents(doc.id)).length;
  await page.getByTestId("input-cover-status").fill("Agreed");
  await page.getByTestId("input-cover-status").press("Enter");
  await expect.poll(async () => (await storedDocument(DEMO_DOCUMENT_NAMES.shared))?.cover.status).toBe("Agreed");
  const saved = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  expect(saved.version).toBe(doc.version + 1);
  expect(await documentEvents(doc.id)).toHaveLength(before + 1);
  // a section's switch and its options too (slice 26: in the editor's right panel once the section is selected)
  await page.locator('[data-testid="editor-section"][data-section="dict"]').click();
  await page.locator('[data-testid="panel-section"][data-section="dict"]').getByTestId("checks-dict-columns-keys").check();
  await expect.poll(async () => sectionOf((await storedDocument(DEMO_DOCUMENT_NAMES.shared))!, "dict").options.columns).toEqual(["attribute", "type", "keys", "pii", "definition"]);

  await page.getByTestId("row-editor-document").click();
  // Anna changes the subtitle meanwhile; Łukasz's save of the same field is refused as stale and keeps his text
  await expect(page.getByTestId("input-cover-subtitle")).toHaveValue("For the business");
  await updateDocumentAs(SEED_IDS.userAnna, DEMO_DOCUMENT_NAMES.shared, { cover: { subtitle: "For the data office" } });
  await page.getByTestId("input-cover-subtitle").fill("For everyone");
  await page.getByTestId("input-cover-subtitle").press("Enter");
  await expect(page.getByTestId("draft-conflict")).toBeVisible();
  await expect(page.getByTestId("draft-other")).toHaveText("For the data office");
  await expect(page.getByTestId("input-cover-subtitle")).toHaveValue("For everyone");
  expect((await storedDocument(DEMO_DOCUMENT_NAMES.shared))!.cover.subtitle).toBe("For the data office");
});

test("S25-03: Duplicate makes the person's private copy; Undo does not touch documents", async ({ page }) => {
  await signInAs(page, "Anna Nowak");
  await page.goto(docsUrl());
  await expect(page.getByTestId("button-undo")).toBeDisabled();
  await docRow(page, DEMO_DOCUMENT_NAMES.shared).getByTestId("button-document-duplicate").click();
  await expectToast(page, `Duplicated as your private document “${DEMO_DOCUMENT_NAMES.shared} (copy)”.`);
  const copy = (await storedDocument(`${DEMO_DOCUMENT_NAMES.shared} (copy)`))!;
  const original = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  expect(copy).toMatchObject({ shared: false, author_id: SEED_IDS.userAnna, sections: original.sections, scope: original.scope, cover: original.cover });
  await expect(page.getByTestId("list-private-documents").getByTestId("row-document")).toHaveCount(2);
  // a document's write is no undo step: the home's Undo stays off
  await page.reload();
  await expect(page.getByTestId("button-undo")).toBeDisabled();
});
