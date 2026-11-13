// S25-02 (slice 25, PRD item 10 as changed; F14 b, F15, F16, F17): an owner makes a shared document; a modeler changes
// it, cannot delete another's shared one, deletes their own; a reader (an InfoMate reader added for this) makes, changes
// and deletes a private one and opens and prints the shared one, read only; a guest (Kasia) makes a private one and
// prints; nobody sees another's private document; a shared document whose author left cannot be made private; an
// archived workspace's documents open and print, read only. Step 4b: only its author makes a shared document private
// (others see the check box disabled with the reason); a document the person can no longer open returns to the
// Documentation tab with a toast, never a 404.

import { deleteDocument, setDocumentShared } from "../../src/modules/infodocumenter/domain/commands";
import { RIGHTS_TEXTS } from "../../src/modules/infodocumenter/domain/rights";
import { refusalAs } from "../slice-15a/helpers";
import { expect, test, type Page } from "./fixtures";
import {
  addReader,
  archive,
  DEMO_DOCUMENT_NAMES,
  docRow,
  docsUrl,
  expectToast,
  formUrl,
  laidOut,
  READER,
  removeMember,
  SEED_IDS,
  setShared,
  expectShared,
  sharedButton,
  shareDocumentAs,
  signInAs,
  signInByName,
  storedDocument,
  storedDocuments,
  viewUrl,
} from "./helpers";

/** New document from a preset: the form opens; returns its id. */
async function newDocument(page: Page, preset: "dictionary" | "s2t" | "blank" = "blank"): Promise<string> {
  await page.goto(docsUrl());
  await page.getByTestId("button-new-document").click();
  await page.getByTestId(`button-preset-${preset}`).click();
  // slice 26: the editor in place of the form
  await expect(page.getByTestId("page-document-editor")).toBeVisible();
  return page.url().split("/d/")[1]!;
}

/** Saves a text field of the form and waits for its stored value. */
async function rename(page: Page, id: string, name: string) {
  await page.getByTestId("input-document-name").fill(name);
  await page.getByTestId("input-document-name").press("Enter");
  await expect.poll(async () => (await storedDocuments()).find((d) => d.id === id)?.name).toBe(name);
}

/** The view lays the pages out, and Print is offered. */
async function printable(page: Page, id: string) {
  await page.goto(viewUrl(id));
  expect(await laidOut(page)).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId("button-print")).toBeEnabled();
}

test("S25-02: an owner shares a document; a modeler changes it but cannot delete it, and deletes her own", async ({ page, browser }) => {
  await signInAs(page, "Łukasz");
  const id = await newDocument(page, "dictionary");
  await expect(page.getByTestId("badge-sharing")).toHaveText("Private");
  await setShared(page, true);
  await expect.poll(async () => (await storedDocuments()).find((d) => d.id === id)?.shared).toBe(true);
  await rename(page, id, "Shared by the owner");

  const anna = await browser.newContext();
  const a = await anna.newPage();
  await signInAs(a, "Anna Nowak");
  await a.goto(docsUrl());
  const row = docRow(a, "Shared by the owner");
  await expect(row.getByTestId("button-document-open")).toHaveText("Edit");
  await expect(row.getByTestId("button-document-delete")).toHaveCount(0);
  await expect(row.getByTestId("text-document-meta")).toContainText("by Łukasz");
  await row.getByTestId("button-document-open").click();
  await a.getByTestId("input-document-audience").fill("Data owners");
  await a.getByTestId("input-document-audience").press("Enter");
  await expect.poll(async () => (await storedDocument("Shared by the owner"))?.audience).toBe("Data owners");
  // the domain refuses her delete whatever the page shows
  const shared = (await storedDocument("Shared by the owner"))!;
  expect(await refusalAs(SEED_IDS.userAnna, (ctx, access) => deleteDocument(ctx, access, shared, { workspaceId: shared.workspace_id, documentId: shared.id, expectedVersion: shared.version }))).toBe(RIGHTS_TEXTS.sharedDelete);

  // her own private document: deleted after the question
  await a.goto(docsUrl());
  const own = docRow(a, DEMO_DOCUMENT_NAMES.anna);
  await own.getByTestId("button-document-delete").click();
  await expect(a.getByTestId("text-delete-document")).toHaveText(`Delete ${DEMO_DOCUMENT_NAMES.anna}? It cannot be brought back.`);
  await a.getByTestId("button-confirm-delete-document").click();
  await expectToast(a, "Document deleted.");
  await expect(own).toHaveCount(0);
  expect(await storedDocument(DEMO_DOCUMENT_NAMES.anna)).toBeUndefined();
  await anna.close();
});

test("S25-02: a reader makes, changes and deletes a private document, and opens and prints the shared one read only", async ({ page }) => {
  await addReader();
  await signInByName(page, READER.name);
  const id = await newDocument(page);
  await rename(page, id, "Rita's notes");
  await page.goto(docsUrl());
  await expect(docRow(page, "Rita's notes")).toBeVisible();
  await docRow(page, "Rita's notes").getByTestId("button-document-delete").click();
  await page.getByTestId("button-confirm-delete-document").click();
  await expectToast(page, "Document deleted.");

  const shared = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  await page.goto(docsUrl());
  const row = docRow(page, DEMO_DOCUMENT_NAMES.shared);
  await expect(row.getByTestId("button-document-open")).toHaveText("Open");
  await expect(row.getByTestId("button-document-delete")).toHaveCount(0);
  await expect(row.getByTestId("button-document-duplicate")).toBeVisible();
  await page.goto(formUrl(shared.id));
  await expect(page.getByTestId("badge-read-only")).toHaveText("Read only");
  await expect(page.getByTestId("banner-document-read-only")).toContainText("A shared document is changed by modelers, admins and owners. Duplicate it to make your own copy.");
  await expect(page.getByTestId("button-duplicate-mine")).toHaveText("Duplicate as my document");
  await expect(page.getByTestId("input-document-name")).toHaveAttribute("readonly", "");
  // slice 26: "Who sees this document" is shown to everyone, disabled with the prototype's hint
  await expect(sharedButton(page, false)).toBeDisabled();
  await expect(page.getByTestId("panel-document")).toContainText("Only modelers, admins and owners share documents.");
  await printable(page, shared.id);
});

test("S25-02: a guest makes a private document and prints it; nobody sees another's private document", async ({ page, browser }) => {
  await signInAs(page, "Kasia Zielińska");
  await page.goto(docsUrl());
  // Kasia is a guest: she sees the shared document only
  await expect(page.getByTestId("row-document")).toHaveCount(1);
  const id = await newDocument(page, "dictionary");
  await expect(sharedButton(page, true)).toBeDisabled();
  await printable(page, id);

  const anna = await browser.newContext();
  const a = await anna.newPage();
  await signInAs(a, "Anna Nowak");
  await a.goto(docsUrl());
  await expect(docRow(a, DEMO_DOCUMENT_NAMES.s2t)).toHaveCount(0);
  await expect(a.getByTestId("row-document")).toHaveCount(2);
  const lukaszPrivate = (await storedDocument(DEMO_DOCUMENT_NAMES.s2t))!;
  // another's private document is never told to exist: its pages return to the tab with the toast (step 4b)
  for (const url of [formUrl(lukaszPrivate.id), viewUrl(lukaszPrivate.id), formUrl(id)]) {
    await a.goto(url);
    await expect(a.getByTestId("tab-docs"), url).toHaveAttribute("aria-selected", "true");
    await expectToast(a, "This document is no longer available to you.");
    expect(new URL(a.url()).searchParams.get("gone"), url).toBeNull();
  }
  await anna.close();
});

test("S25-02: only its author makes a shared document private; whoever else had it open returns to the tab", async ({ page, browser }) => {
  await shareDocumentAs(SEED_IDS.userAnna, DEMO_DOCUMENT_NAMES.anna, true);
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.anna))!;
  await signInAs(page, "Łukasz");
  await page.goto(formUrl(doc.id));
  await expectShared(page, true);
  await expect(sharedButton(page, false)).toBeDisabled();
  await expect(page.getByTestId("text-shared-locked")).toHaveText("Only Anna Nowak can make it private.");
  // the domain refuses it too, whatever the page shows
  expect(
    await refusalAs(SEED_IDS.userLukasz, (ctx, access) =>
      setDocumentShared(ctx, access, doc, { workspaceId: doc.workspace_id, documentId: doc.id, expectedVersion: doc.version, shared: false }, { member: true, name: "Anna Nowak" }),
    ),
  ).toBe("Only Anna Nowak can make it private.");

  const anna = await browser.newContext();
  const a = await anna.newPage();
  await signInAs(a, "Anna Nowak");
  await a.goto(formUrl(doc.id));
  await expect(a.getByTestId("text-shared-locked")).toHaveCount(0);
  await setShared(a, false);
  await expect.poll(async () => (await storedDocument(DEMO_DOCUMENT_NAMES.anna))!.shared).toBe(false);
  await anna.close();

  // Łukasz can no longer open it: the form and the page return to the tab with the toast
  for (const url of [formUrl(doc.id), viewUrl(doc.id)]) {
    await page.goto(url);
    await expect(page.getByTestId("tab-docs"), url).toHaveAttribute("aria-selected", "true");
    await expectToast(page, "This document is no longer available to you.");
  }
  await expect(docRow(page, DEMO_DOCUMENT_NAMES.anna)).toHaveCount(0);
});

test("S25-02: a shared document whose author left cannot be made private", async ({ page }) => {
  await shareDocumentAs(SEED_IDS.userAnna, DEMO_DOCUMENT_NAMES.anna, true);
  await removeMember(SEED_IDS.userAnna);
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.anna))!;
  await page.goto(formUrl(doc.id));
  await expect(sharedButton(page, false)).toBeDisabled();
  await expect(page.getByTestId("text-shared-locked")).toHaveText("Anna Nowak is no longer a member of this workspace, so the document stays shared.");
  expect(
    await refusalAs(SEED_IDS.userLukasz, (ctx, access) =>
      setDocumentShared(ctx, access, doc, { workspaceId: doc.workspace_id, documentId: doc.id, expectedVersion: doc.version, shared: false }, { member: false, name: "Anna Nowak" }),
    ),
  ).toBe("Anna Nowak is no longer a member of this workspace, so the document stays shared.");
  expect((await storedDocument(DEMO_DOCUMENT_NAMES.anna))!.shared).toBe(true);
});

test("S25-02: an archived workspace's documents open and print, read only", async ({ page }) => {
  await archive();
  await signInAs(page, "Łukasz");
  await page.goto(docsUrl());
  await expect(page.getByTestId("button-new-document")).toHaveCount(0);
  const row = docRow(page, DEMO_DOCUMENT_NAMES.shared);
  await expect(row.getByTestId("button-document-open")).toHaveText("Open");
  await expect(row.getByTestId("button-document-duplicate")).toHaveCount(0);
  await expect(row.getByTestId("button-document-delete")).toHaveCount(0);
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  await page.goto(formUrl(doc.id));
  await expect(page.getByTestId("banner-document-read-only")).toHaveText("This workspace is archived, so documents are read-only.");
  await expect(page.getByTestId("input-cover-title")).toHaveAttribute("readonly", "");
  await printable(page, doc.id);
});
