// Slice 36's helpers: documents from a baseline in the editor and on the Baselines tab, baselines and documents made
// as test data through the domain and the composed store, and changes of the live model in the e2e data file.
import { expect, type Locator, type Page } from "@playwright/test";
import { baselineContentNow } from "../../src/compose/baselines";
import { DOCUMENT_SECTION_KINDS } from "../../src/compose/documents";
import { readDb, writeDb } from "../../src/data/local/file";
import { createBaseline, deleteBaseline } from "../../src/domain/commands/baseline";
import { uuidv7 } from "../../src/domain/ids";
import { createDocument } from "../../src/modules/infodocumenter/domain/commands";
import type { DocumentDefinition } from "../../src/modules/infodocumenter/domain/types";
import { E2E_DB } from "../config";
import { composedStore, DEMO_BASELINE, RETAIL, SEED_IDS } from "../slice-35/helpers";
import { laidOut } from "../slice-25/helpers";

export { compareDialog, composedStore, deleteDialog, DEMO_BASELINE, expectToast, minute, openBaselines, openCompare, RETAIL, rowNamed, SEED_IDS, signInAs } from "../slice-35/helpers";
export { docRow, docsUrl, formUrl, laidOut, marginContent, openFold, pagesOf, sectionText, storedDocument, storedDocuments, viewUrl } from "../slice-25/helpers";
export { openEditor, preview, rowOfType } from "../slice-26/helpers";
export { markdownText, openMarkdown } from "../slice-34/helpers";

export const LUKASZ = SEED_IDS.userLukasz;
export const ANNA = SEED_IDS.userAnna;
/** "Stage 1 sign-off" as the browser names it (the e2e run is in Europe/Warsaw). */
export const STAGE_1 = DEMO_BASELINE.name;

export const modelState = (page: Page): Locator => page.getByTestId("select-model-state");
/** The text of a select's chosen option. */
export const chosenText = (select: Locator): Promise<string> => select.evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent ?? "");
/** A select's options' texts. */
export const optionTexts = (select: Locator): Promise<string[]> => select.evaluate((el) => [...(el as HTMLSelectElement).options].map((o) => o.textContent ?? ""));

/**
 * Real pages after every change ("Exact pages", S26-07's way), chosen once the page has hydrated: a choice made before
 * it is lost (the mode is the session's, read after hydration). Then the first layout.
 */
export async function exactPages(page: Page): Promise<void> {
  const mode = page.getByTestId("select-preview-mode");
  await expect(async () => {
    await mode.selectOption("auto");
    await mode.selectOption("exact");
    expect(await page.evaluate(() => sessionStorage.getItem("infomapper:document-preview"))).toBe("exact");
  }).toPass({ timeout: 20_000 });
  await expect(page.getByTestId("document-pages")).toHaveAttribute("data-shown", "pages", { timeout: 30_000 });
  await laidOut(page);
}

/** Waits until the editor's document shows a stored version (a save's page has arrived). */
export async function expectVersion(page: Page, version: number) {
  await expect(page.getByTestId("page-document-editor")).toHaveAttribute("data-version", String(version));
}

/** Test data: a baseline taken now, as a person through the domain and the composed store. */
export async function takeBaseline(name: string, userId: string = LUKASZ): Promise<string> {
  const s = composedStore();
  const access = { workspace: (await s.workspaces.get(RETAIL))!, member: await s.workspaces.getMember(RETAIL, userId) };
  const content = (await baselineContentNow(s, RETAIL))!;
  const r = createBaseline({ actorId: userId, now: new Date().toISOString(), newId: () => uuidv7() }, access, { baselines: await s.baselines.listAll(RETAIL) }, content, { workspaceId: RETAIL, name });
  if (!r.ok) throw new Error(r.error.message);
  const applied = await s.apply(r.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return r.value.baseline.id;
}

/** Test data: a baseline deleted as Łukasz. */
export async function deleteBaselineAs(baselineId: string): Promise<void> {
  const s = composedStore();
  const access = { workspace: (await s.workspaces.get(RETAIL))!, member: await s.workspaces.getMember(RETAIL, LUKASZ) };
  const b = (await s.baselines.get(RETAIL, baselineId))!;
  const r = deleteBaseline({ actorId: LUKASZ, now: new Date().toISOString(), newId: () => uuidv7() }, access, b, { baselineId, expectedVersion: b.version });
  if (!r.ok) throw new Error(r.error.message);
  const applied = await s.apply(r.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
}

/** Test data: a private document from a baseline ("New document from it"), as a person; its id. */
export async function documentFromBaseline(baselineId: string, userId: string = LUKASZ): Promise<string> {
  const s = composedStore();
  const access = { workspace: (await s.workspaces.get(RETAIL))!, member: await s.workspaces.getMember(RETAIL, userId) };
  const refs = (await s.baselines.list(RETAIL)).map((b) => ({ id: b.id, name: b.name, created_at: b.created_at }));
  const r = createDocument({ actorId: userId, now: new Date().toISOString(), newId: () => uuidv7() }, access, { workspaceId: RETAIL, preset: "signoff", baselineId }, DOCUMENT_SECTION_KINDS, [], refs);
  if (!r.ok) throw new Error(r.error.message);
  const applied = await s.apply(r.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return r.value.document.id;
}

type Db = Awaited<ReturnType<typeof readDb>>;
/** Test data: a change of the e2e data file (the live model; never a baseline's content, which is a file of its own). */
export async function changeDb(change: (db: Db) => void): Promise<void> {
  const db = await readDb(E2E_DB);
  change(db);
  await writeDb(E2E_DB, db);
}

/** Test data: a document's recipe changed in the e2e data file. */
export async function changeDocument(id: string, change: (d: DocumentDefinition) => void): Promise<void> {
  await changeDb((db) => {
    const d = (db as unknown as { document_definition: DocumentDefinition[] }).document_definition.find((x) => x.id === id)!;
    change(d);
    d.version += 1;
  });
}

/** A changes section entry, as the editor's "+ Add section" makes it. */
export const changesSection = (against: string | null = null) => ({ id: uuidv7(), type: "changes", on: true, heading: null, newPage: true, options: { against } });

/** The live logical entity by name in the e2e data file. */
export const liveEntity = (db: Db, name: string) => db.entity.find((e) => e.workspace_id === RETAIL && e.name === name && e.model_level === "logical" && e.deleted_at === null)!;

/** The section's rows on the laid-out pages: "Kind | Item | What changed", after its heading. */
export async function changesRows(page: Page, heading: string): Promise<string[]> {
  return page.evaluate((h) => {
    const pages = [...document.querySelectorAll('[data-testid="document-host"] .pagedjs_page')];
    const text = (x: Element) => [...x.childNodes].filter((c) => !(c instanceof Element && c.classList.contains("dnum"))).map((c) => c.textContent).join("");
    const at = pages.findIndex((p) => [...p.querySelectorAll("h2")].some((x) => text(x) === h));
    if (at < 0) return [];
    const out: string[] = [];
    for (let i = at; i < pages.length; i++) {
      if (i > at && pages[i]!.querySelector("h2[id]")) break;
      for (const tr of pages[i]!.querySelectorAll("tbody tr")) out.push([...tr.querySelectorAll("td")].map((td) => (td.textContent ?? "").trim()).join(" | ").trim());
    }
    return out;
  }, heading);
}
