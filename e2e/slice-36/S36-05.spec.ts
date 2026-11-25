// S36-05 (slice 36, criterion 5): when a baseline is deleted the documents made from it stay. The delete dialog says how
// many, other people's private ones counted as a number only. Such a document, in the editor and on its page, says
// "This document points to a baseline that no longer exists." instead of its content; Model state says "Baseline no
// longer exists: choose another source"; Print / PDF and Markdown are disabled with that reason; it never falls back to
// the live model. Another source makes it work again. A changes section whose chosen baseline is gone says so; with
// "Previous baseline" it takes the next older one.
import { test, expect } from "./fixtures";
import {
  exactPages,
  ANNA,
  changeDocument,
  changesSection,
  chosenText,
  DEMO_BASELINE,
  deleteBaselineAs,
  deleteDialog,
  documentFromBaseline,
  formUrl,
  laidOut,
  modelState,
  openBaselines,
  rowNamed,
  sectionText,
  signInAs,
  STAGE_1,
  storedDocuments,
  takeBaseline,
  viewUrl,
} from "./helpers";
import { DEMO_DOCUMENT_NAMES } from "../slice-25/helpers";

test.use({ seed: "full" });

const MISSING = "This document points to a baseline that no longer exists.";
const DISABLED = "This document points to a baseline that no longer exists. Choose another source under Model state.";

test("S36-05: the delete dialog counts the documents; such a document says its baseline is gone until another is chosen", async ({ page }) => {
  // Łukasz's own document and Anna's private one, both from Stage 1 sign-off
  const mine = await documentFromBaseline(DEMO_BASELINE.id);
  await documentFromBaseline(DEMO_BASELINE.id, ANNA);
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  await rowNamed(page, STAGE_1).getByTestId("button-baseline-delete").click();
  const dialog = deleteDialog(page);
  await expect(dialog.getByTestId("text-delete-baseline")).toHaveText("It cannot be brought back here.");
  await expect(dialog.getByTestId("text-delete-baseline-documents")).toHaveText(
    "2 documents are made from it. They stay and say that the baseline no longer exists; their authors can choose another source.",
  );
  // Anna's private document is counted, never named
  await expect(dialog).not.toContainText("Documentation of");
  await dialog.getByTestId("button-confirm-delete-baseline").click();
  await expect(rowNamed(page, STAGE_1)).toHaveCount(0);
  expect((await storedDocuments()).filter((d) => d.baseline_id === DEMO_BASELINE.id && d.deleted_at === null)).toHaveLength(2);

  // the editor: the message, Model state's gone option, Print / PDF and Markdown disabled with the reason
  await page.goto(formUrl(mine));
  await laidOut(page);
  await expect(page.getByTestId("document-host")).toContainText(MISSING);
  await expect(page.getByTestId("document-host")).not.toContainText("Data dictionary");
  await expect.poll(() => chosenText(modelState(page))).toBe("Baseline no longer exists: choose another source");
  for (const id of ["button-print", "button-markdown"]) {
    await expect(page.getByTestId(id)).toBeDisabled();
    await expect(page.getByTestId(id)).toHaveAttribute("title", DISABLED);
  }
  await expect(page.getByTestId("note-baseline")).toHaveCount(0);

  // the document's page: the message, Print disabled
  await page.goto(viewUrl(mine));
  await expect(page.getByTestId("document-pages")).toHaveAttribute("data-state", "done", { timeout: 30_000 });
  await expect(page.getByTestId("document-host")).toContainText(MISSING);
  await expect(page.getByTestId("button-print")).toBeDisabled();
  await expect(page.getByTestId("button-print")).toHaveAttribute("title", DISABLED);

  // another source: it works as before
  await page.goto(formUrl(mine));
  await laidOut(page);
  await modelState(page).selectOption("live");
  await expect(page.getByTestId("document-host")).toContainText("Data dictionary", { timeout: 30_000 });
  await expect(page.getByTestId("button-print")).toBeEnabled();
  await expect(page.getByTestId("button-markdown")).toBeEnabled();
  await expect.poll(() => chosenText(modelState(page))).toBe("Live model (changes as people work)");
});

test("S36-05: a changes section whose chosen baseline is gone says so; the previous one takes the next older", async ({ page }) => {
  const second = await takeBaseline("Stage 2 sign-off");
  const doc = (await storedDocuments()).find((d) => d.name === DEMO_DOCUMENT_NAMES.shared)!;
  await changeDocument(doc.id, (d) => {
    d.sections = [
      { ...changesSection(second), heading: "Against Stage 2" },
      { ...changesSection(), heading: "Against the previous" },
      { id: "01a0f9e9-2036-7b1a-8c35-5e1f0a7e3699", type: "text", on: true, heading: "Still printed", newPage: true, options: { body: "The rest of the document." } },
    ];
  });
  await signInAs(page, "Łukasz");
  await page.goto(formUrl(doc.id));
  await exactPages(page);
  expect(await sectionText(page, "Against the previous")).not.toContain("REQ-105");

  await deleteBaselineAs(second);
  await page.reload();
  await exactPages(page);
  expect(await sectionText(page, "Against Stage 2")).toContain("The baseline this section compared with no longer exists.");
  // "Previous baseline" now takes Stage 1 sign-off
  expect(await sectionText(page, "Against the previous")).toContain("REQ-105");
  expect(await sectionText(page, "Still printed")).toContain("The rest of the document.");
  await expect(page.getByTestId("button-print")).toBeEnabled();
  // its option names the gone baseline
  await page.locator('[data-testid="editor-section"][data-section="changes"]').first().click();
  await expect.poll(() => chosenText(page.getByTestId("select-changes-against"))).toBe("Baseline no longer exists");
});
