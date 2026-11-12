// Slice 25's helpers: the Documentation tab, the form and the document page; the e2e data file's documents; test data
// written through the domain (a document as any person, the licence, a person added or gone).

import { expect, type Locator, type Page } from "@playwright/test";
import { DOCUMENT_SECTION_KINDS } from "../../src/compose/documents";
import { readDb, writeDb } from "../../src/data/local/file";
import { uuidv7 } from "../../src/domain/ids";
import { createDocument, setDocumentShared, updateDocument, type UpdateDocumentInput } from "../../src/modules/infodocumenter/domain/commands";
import { DEMO_DOCUMENT_NAMES } from "../../src/modules/infodocumenter/data/demo";
import type { DocumentDefinition, DocumentPreset } from "../../src/modules/infodocumenter/domain/types";
import { E2E_DB } from "../config";
import { addPerson } from "../slice-08/helpers";
import { cubeStore } from "../slice-15a/helpers";
import { RETAIL, SEED_IDS } from "../slice-07c/helpers";

export { expectToast, signInAs } from "../slice-00/helpers";
export { archive } from "../slice-07a/helpers";
export { RETAIL, SEED_IDS, DEMO_DOCUMENT_NAMES };

export const docsUrl = (ws: string = RETAIL) => `/w/${ws}?tab=docs`;
export const settingsUrl = (ws: string = RETAIL) => `/w/${ws}?tab=settings`;
export const formUrl = (id: string, ws: string = RETAIL) => `/w/${ws}/d/${id}`;
export const viewUrl = (id: string, ws: string = RETAIL) => `/w/${ws}/d/${id}/view`;

/** Signs in through the test users' list by a person's name (an added person too). */
export async function signInByName(page: Page, name: string) {
  await page.goto("/sign-in");
  await page.getByTestId("button-dev-user").filter({ hasText: name }).click();
  await expect(page.getByTestId("bar-top")).toBeVisible();
}

/** Every document of the e2e data file, deleted ones too. */
export const storedDocuments = async (): Promise<DocumentDefinition[]> => ((await readDb(E2E_DB)) as unknown as { document_definition?: DocumentDefinition[] }).document_definition ?? [];
export const storedDocument = async (name: string) => (await storedDocuments()).find((d) => d.name === name && d.deleted_at === null);
export const documentEvents = async (id: string) => (await readDb(E2E_DB)).change_event.filter((e) => e.object_id === id);

/** A row of the Documentation tab by the document's name. */
export const docRow = (page: Page, name: string): Locator => page.locator(`[data-testid="row-document"][data-name="${name}"]`);

/** InfoDocumenter's licence for an organization, as test data (the seed's plain file has none). */
export async function grantDocLicence(organizationId: string = SEED_IDS.orgInfoMate) {
  const db = await readDb(E2E_DB);
  const at = new Date().toISOString();
  db.organization_licence.push({ id: uuidv7(), version: 1, created_at: at, created_by: SEED_IDS.userLukasz, updated_at: at, updated_by: SEED_IDS.userLukasz, deleted_at: null, organization_id: organizationId, module: "infodoc" });
  await writeDb(E2E_DB, db);
}

/** Changes the e2e data file's workspace row (InfoDocumenter's switch, the language) as test data. */
export async function setWorkspace(ws: string, patch: Partial<{ infodoc: boolean; infocube: boolean; doc_language: "en" | "pl" | "de" }>) {
  const db = await readDb(E2E_DB);
  Object.assign(db.workspace.find((w) => w.id === ws)!, patch);
  await writeDb(E2E_DB, db);
}

async function asPerson<T>(userId: string, ws: string, command: (ctx: { actorId: string; now: string; newId: () => string }, access: never, doc?: DocumentDefinition) => { ok: true; value: T; writeSet: never } | { ok: false; error: { message: string } }) {
  const s = cubeStore();
  const workspace = (await s.workspaces.get(ws))!;
  const access = { workspace, member: await s.workspaces.getMember(ws, userId) };
  const ctx = { actorId: userId, now: new Date().toISOString(), newId: () => uuidv7() };
  const result = command(ctx, access as never);
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return result.value;
}

/** Test data: a document made from a preset as a person, through the domain. */
export const createDocumentAs = (userId: string, preset: DocumentPreset, ws: string = RETAIL) =>
  asPerson(userId, ws, (ctx, access) => createDocument(ctx as never, access, { workspaceId: ws, preset }, DOCUMENT_SECTION_KINDS) as never) as Promise<{ document: DocumentDefinition }>;

/** Test data: a save of a document as a person (the stored version). */
export async function updateDocumentAs(userId: string, name: string, patch: Omit<UpdateDocumentInput, "workspaceId" | "documentId" | "expectedVersion">, ws: string = RETAIL) {
  const doc = (await storedDocument(name))!;
  return asPerson(userId, ws, (ctx, access) => updateDocument(ctx as never, access, doc, { workspaceId: ws, documentId: doc.id, expectedVersion: doc.version, ...patch }, DOCUMENT_SECTION_KINDS) as never);
}

/** Test data: shares or unshares a document as a person. */
export async function shareDocumentAs(userId: string, name: string, shared: boolean, ws: string = RETAIL) {
  const doc = (await storedDocument(name))!;
  return asPerson(userId, ws, (ctx, access) => setDocumentShared(ctx as never, access, doc, { workspaceId: ws, documentId: doc.id, expectedVersion: doc.version, shared }, { member: true, name: "" }) as never);
}

/** Test data: a reader of InfoMate added to "Retail Co – DWH" (F16: Kasia, the seed's reader, is a guest). */
export const READER = { name: "Rita Reader", email: "rita.reader@infomate.pl" };
export const addReader = () => addPerson(SEED_IDS.userLukasz, RETAIL, { ...READER, role: "reader" });

/** Test data: a person gone from the workspace (their membership removed; their documents stay). */
export async function removeMember(userId: string, ws: string = RETAIL) {
  const db = await readDb(E2E_DB);
  db.workspace_member = db.workspace_member.filter((m) => !(m.workspace_id === ws && m.user_id === userId));
  await writeDb(E2E_DB, db);
}

/** The document page: waits until Paged.js has laid out the pages, and returns how many. */
export async function laidOut(page: Page): Promise<number> {
  const pages = page.getByTestId("document-pages");
  await expect(pages).toHaveAttribute("data-state", "done", { timeout: 30_000 });
  await expect(page.getByTestId("text-pages")).toHaveText(/^\d+ pages?$/);
  return Number(await pages.getAttribute("data-pages"));
}

/** The laid-out pages. */
export const pagesOf = (page: Page) => page.locator('[data-testid="document-host"] .pagedjs_page');

/** The text of a section on the laid-out pages, by its heading (all of its pages). */
export async function sectionText(page: Page, heading: string): Promise<string> {
  return page.evaluate((h) => {
    const all = [...document.querySelectorAll('[data-testid="document-host"] .pagedjs_page')];
    const at = all.findIndex((p) => [...p.querySelectorAll("h2")].some((x) => x.textContent === h));
    if (at < 0) return "";
    const out: string[] = [];
    for (let i = at; i < all.length; i++) {
      if (i > at && all[i]!.querySelector("h2[id]")) break;
      out.push(all[i]!.querySelector(".pagedjs_page_content")?.textContent ?? "");
    }
    return out.join("\n");
  }, heading);
}

/** The computed `content` of a page's margin box (Paged.js draws it in `::after`). */
export const marginContent = (page: Page, index: number, box: string) =>
  page.evaluate(
    ([i, b]) => {
      const p = document.querySelectorAll('[data-testid="document-host"] .pagedjs_page')[i as number];
      const c = p?.querySelector(`.pagedjs_margin-${b} .pagedjs_margin-content`);
      return c ? getComputedStyle(c, "::after").content : null;
    },
    [index, box] as const,
  );
