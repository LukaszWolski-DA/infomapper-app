// S28-05 (slice 28, item 2, F3, Q-B): a hint under an option that is on while nothing in the document uses it.
// Source-to-target's Note: the demo's only note in "Retail Co – DWH" is on a draft mapping (webusers.email →
// Customer.email), which the S2T document's "Not drafts" leaves out; with "All" the note shows and the hint goes; with no
// note at all the hint says so. Source tables' table note and classifications, the dictionary's concept frames and the
// style's List of figures have the same rule.

import type { DocumentDefinition } from "../../src/modules/infodocumenter/domain/types";
import { expect, test } from "./fixtures";
import { changeDb, DEMO_DOCUMENT_NAMES, openDocument, rowOfType, setSections, signInAs, storedDocument } from "./helpers";

test("S28-05: the Note's hint: on a draft left out, gone with All, none at all; no hint while Note is off", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openDocument(page);
  await rowOfType(page, "s2t").click();
  const note = page.getByTestId("checks-s2t-columns-note");
  const hint = page.getByTestId("hint-s2t-columns");
  await expect(note).not.toBeChecked();
  await expect(hint).toHaveCount(0);
  await note.check();
  await expect(hint).toHaveText("1 note is on a mapping that Mappings included leaves out.");
  await expect(hint).toHaveAttribute("role", "note");

  // with every mapping included the note shows in the pages, and there is no hint
  await page.getByTestId("row-editor-document").click();
  await page.getByTestId("seg-mappings").getByRole("button", { name: "All", exact: true }).click();
  await expect.poll(async () => (await storedDocument(DEMO_DOCUMENT_NAMES.s2t))!.scope.mappings).toBe("all");
  await rowOfType(page, "s2t").click();
  await expect(page.getByTestId("checks-s2t-columns-note")).toBeChecked();
  await expect(page.getByTestId("hint-s2t-columns")).toHaveCount(0);
  await expect(page.getByTestId("document-pages")).toContainText("Second source for e-mail");

  // Note off: no hint
  await page.getByTestId("checks-s2t-columns-note").uncheck();
  await expect(page.getByTestId("hint-s2t-columns")).toHaveCount(0);
});

test("S28-05: no note at all in the document says so", async ({ page }) => {
  await changeDb((db) => {
    for (const m of (db as unknown as { mapping: { note_text: string | null }[] }).mapping) m.note_text = null;
    const doc = (db as unknown as { document_definition: DocumentDefinition[] }).document_definition.find((d) => d.name === DEMO_DOCUMENT_NAMES.s2t)!;
    const s2t = doc.sections.find((s) => s.type === "s2t")!;
    s2t.options = { ...s2t.options, columns: [...(s2t.options.columns as string[]), "note"] };
  });
  await signInAs(page, "Łukasz");
  await openDocument(page);
  await rowOfType(page, "s2t").click();
  await expect(page.getByTestId("hint-s2t-columns")).toHaveText("No mapping in this document has a note.");
});

test("S28-05: Source tables, the dictionary's concept frames and the List of figures say why they show nothing", async ({ page }) => {
  await setSections(DEMO_DOCUMENT_NAMES.s2t, [
    { type: "sources", options: { tableNote: true, tableClassifications: true } },
    { type: "dict", options: { byConcept: true, conceptFigures: true } },
  ]);
  await changeDb((db) => {
    const d = db as unknown as { source_table: { note_text: string | null }[]; classification_link: { source_table_id: string | null }[]; frame: { kind: string }[]; document_definition: DocumentDefinition[] };
    for (const t of d.source_table) t.note_text = null;
    d.classification_link = d.classification_link.filter((l) => !l.source_table_id);
    d.frame = d.frame.filter((f) => f.kind !== "concept");
    const doc = d.document_definition.find((x) => x.name === DEMO_DOCUMENT_NAMES.s2t)!;
    doc.style = { ...doc.style, listOfFigures: true };
  });
  await signInAs(page, "Łukasz");
  await openDocument(page);
  await rowOfType(page, "sources").click();
  await expect(page.getByTestId("hint-sources-tableNote")).toHaveText("No table in this document has a note.");
  await expect(page.getByTestId("hint-sources-tableClassifications")).toHaveText("No table in this document has a classification.");
  await expect(page.getByTestId("label-sources")).toHaveText("For each table");
  await rowOfType(page, "dict").click();
  await expect(page.getByTestId("hint-dict-conceptFigures")).toHaveText("No canvas in this document's scope has a concept's frame.");
  await page.getByTestId("row-editor-document").click();
  await expect(page.getByTestId("hint-style-listOfFigures")).toHaveText("This document has no figures yet.");
  // the hint goes once the option is off
  await page.getByTestId("check-style-listOfFigures").uncheck();
  await expect(page.getByTestId("hint-style-listOfFigures")).toHaveCount(0);
});
