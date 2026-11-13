// S26-01 (slice 26, PRD section 2, F12, Q9): the editor's three panels; a section added, renamed, moved, turned off and
// removed, each saved with a version and a change event, none an undo step; a module's section type disabled while its
// module is off; read only for a member who may not change the document, with "Duplicate as my document".

import { expect, test, type Page } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, docsUrl, documentEvents, formUrl, openEditor, rowOfType, sectionRow, signInAs, storedDocument } from "./helpers";

const SHARED = DEMO_DOCUMENT_NAMES.shared;

/** Waits until the stored document has one more version and one more change event than `before`. */
async function savedOnce(before: { version: number; events: number }, id: string) {
  await expect.poll(async () => (await storedDocument(SHARED))!.version).toBe(before.version + 1);
  expect(await documentEvents(id)).toHaveLength(before.events + 1);
  return { version: before.version + 1, events: before.events + 1 };
}

async function now(id: string) {
  return { version: (await storedDocument(SHARED))!.version, events: (await documentEvents(id)).length };
}

const typesOf = async () => (await storedDocument(SHARED))!.sections.map((s) => s.type);

async function addSection(page: Page, type: string) {
  await page.getByTestId("button-add-section").click();
  await page.locator(`[data-testid="button-add-section-type"][data-type="${type}"]`).click();
}

test("S26-01: the three panels; a section added, renamed, moved, turned off and removed, each a save with a version and a change event, none an undo step", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(SHARED))!;
  await openEditor(page, formUrl(doc.id));
  await expect(page.getByTestId("editor-left")).toBeVisible();
  await expect(page.getByTestId("document-pages")).toBeVisible();
  await expect(page.getByTestId("editor-right")).toBeVisible();
  await expect(page.getByTestId("row-editor-document")).toContainText("Model state, scope, style, cover");
  await expect(page.getByTestId("editor-section")).toHaveCount(2);
  let at = await now(doc.id);

  // added at the end, with its kind's defaults, and selected
  await addSection(page, "s2t");
  at = await savedOnce(at, doc.id);
  expect(await typesOf()).toEqual(["text", "dict", "s2t"]);
  const added = (await storedDocument(SHARED))!.sections[2]!;
  expect(added).toMatchObject({ on: true, heading: null, newPage: true });
  await expect(sectionRow(page, added.id)).toHaveAttribute("aria-current", "true");
  await expect(page.locator('[data-testid="panel-section"][data-section="s2t"]')).toBeVisible();

  // renamed: its heading, in the right panel
  await page.getByTestId("input-section-heading").fill("Mappings for review");
  await page.getByTestId("input-section-heading").press("Enter");
  at = await savedOnce(at, doc.id);
  expect((await storedDocument(SHARED))!.sections[2]!.heading).toBe("Mappings for review");
  await expect(sectionRow(page, added.id).getByTestId("text-section-name")).toHaveText("Mappings for review");

  // moved up
  await sectionRow(page, added.id).getByTestId("button-section-up").click();
  at = await savedOnce(at, doc.id);
  expect(await typesOf()).toEqual(["text", "s2t", "dict"]);
  await expect(page.getByTestId("editor-section").nth(1)).toHaveAttribute("data-section-id", added.id);

  // turned off
  await sectionRow(page, added.id).getByTestId("check-section-on").uncheck();
  at = await savedOnce(at, doc.id);
  expect((await storedDocument(SHARED))!.sections[1]!.on).toBe(false);

  // removed, without a question
  await sectionRow(page, added.id).getByTestId("button-section-remove").click();
  await savedOnce(at, doc.id);
  expect(await typesOf()).toEqual(["text", "dict"]);
  await expect(page.getByTestId("editor-section")).toHaveCount(2);
  // the selection goes back to Document
  await expect(page.getByTestId("panel-document")).toBeVisible();

  // documents are outside undo: the home's Undo stays off
  await page.goto(docsUrl());
  await expect(page.getByTestId("button-undo")).toBeDisabled();
});

test("S26-01: a module's section type is disabled while its module is off", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(SHARED))!;
  await openEditor(page, formUrl(doc.id));
  await page.getByTestId("button-add-section").click();
  const cube = page.locator('[data-testid="button-add-section-type"][data-type="cube.dim"]');
  await expect(cube).toBeDisabled();
  await expect(cube).toContainText("InfoCube");
  await expect(cube).toContainText("InfoCube is off in this workspace.");
  await expect(page.locator('[data-testid="button-add-section-type"][data-type="dict"]')).toBeEnabled();
});

test.describe("with InfoCube on", () => {
  test.use({ seed: "full" });
  test("S26-01: a module's section type can be added while its module is on", async ({ page }) => {
    await signInAs(page, "Łukasz");
    const doc = (await storedDocument(SHARED))!;
    await openEditor(page, formUrl(doc.id));
    await page.getByTestId("button-add-section").click();
    const cube = page.locator('[data-testid="button-add-section-type"][data-type="cube.dim"]');
    await expect(cube).toBeEnabled();
    await expect(cube).toContainText("Facts with grain and type, dimensions and measures; dimensions with history; every dimensional attribute's feed.");
    await cube.click();
    await expect.poll(typesOf).toEqual(["text", "dict", "cube.dim"]);
    await expect(rowOfType(page, "cube.dim")).toContainText("InfoCube");
  });
});

test("S26-01: read only for a member who may not change the document, with Duplicate as my document", async ({ page }) => {
  // Kasia is a guest: she opens and prints the shared document but does not change it
  await signInAs(page, "Kasia Zielińska");
  const doc = (await storedDocument(SHARED))!;
  await openEditor(page, formUrl(doc.id));
  await expect(page.getByTestId("badge-read-only")).toHaveText("Read only");
  await expect(page.getByTestId("banner-document-read-only")).toContainText("A shared document is changed by modelers, admins and owners. Duplicate it to make your own copy.");
  await expect(page.getByTestId("button-add-section")).toHaveCount(0);
  await expect(page.getByTestId("button-section-remove")).toHaveCount(0);
  await expect(rowOfType(page, "dict").getByTestId("check-section-on")).toBeDisabled();
  await rowOfType(page, "dict").click();
  await expect(page.getByTestId("input-section-heading")).toHaveAttribute("readonly", "");
  await expect(page.getByTestId("checks-dict-columns-keys")).toBeDisabled();
  // the preview and Print stay
  await expect(page.getByTestId("button-print")).toBeEnabled();

  await page.getByTestId("button-duplicate-mine").click();
  await expect(page).toHaveURL(/\/d\/[^/]+$/);
  await expect.poll(async () => !!(await storedDocument(`${SHARED} (copy)`))).toBe(true);
  const copy = (await storedDocument(`${SHARED} (copy)`))!;
  await expect(page).toHaveURL(new RegExp(`/d/${copy.id}$`));
  await expect(page.getByTestId("badge-read-only")).toHaveCount(0);
  await expect(page.getByTestId("button-add-section")).toBeVisible();
});
