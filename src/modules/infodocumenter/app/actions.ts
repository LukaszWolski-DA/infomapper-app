"use server";

// InfoDocumenter's server actions (slice 25, step 4) over step 2's commands: create from a preset, save one field,
// share or unshare, duplicate, delete. Each runs through `runCommand` (the session, an unlocked organization, the
// composed store, the write with its change event), outside undo: no Undo in their toasts. The rights are the domain's
// (`rights.ts`): a guest makes and prints private documents, an archived workspace's are read only.

import { revalidatePath } from "next/cache";
import { baselineRefs, DOCUMENT_SECTION_KINDS, DOCUMENT_SECTION_TYPES, documentCanvases, documentChanges, documentModel, type DocumentModel } from "@/app/_lib/documents";
import { loadAccess, modelRead } from "@/app/_lib/model-command";
import { documentHref } from "@/app/_lib/paths";
import { runCommand, type ActionResult, type Saved } from "@/app/_lib/run-command";
import { withTiming } from "@/app/_lib/timing";
import type { DataStore } from "@/data";
import type { CommandResult } from "@/domain/changes";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { WorkspaceSnapshot } from "@/domain/model/workspace-model";
import type { ModuleTable } from "@/domain/types";
import type { SectionChanges } from "@/domain/document/state";
import { openRefusal } from "../domain/rights";
import { browserSnapshot } from "./snapshot";
import {
  addDocumentSection,
  createChangesDocument,
  type CreateChangesDocumentInput,
  moveDocumentSection,
  removeDocumentSection,
  type AddDocumentSectionInput,
  type MoveDocumentSectionInput,
  type RemoveDocumentSectionInput,
  createDocument,
  deleteDocument,
  duplicateDocument,
  setDocumentShared,
  updateDocument,
  type CreateDocumentInput,
  type DeleteDocumentInput,
  type DuplicateDocumentInput,
  type ShareDocumentInput,
  type UpdateDocumentInput,
} from "../domain/commands";
import type { DocumentDefinition } from "../domain/types";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };

const documentOf = async (store: DataStore, access: WorkspaceAccess, id: unknown): Promise<DocumentDefinition | null> =>
  typeof id === "string" ? ((await store.modules.list(access.workspace.id, "document_definition")).find((d) => d.id === id) ?? null) : null;

/** A document command with the workspace's access and the document loaded; on success the pages are fresh again. */
async function documentCommand<T>(
  input: { workspaceId?: unknown; documentId?: unknown } | null | undefined,
  build: (access: WorkspaceAccess, doc: DocumentDefinition | null, store: DataStore, ctx: Parameters<Parameters<typeof runCommand>[0]>[0]) => Promise<CommandResult<T>> | CommandResult<T>,
): Promise<ActionResult<T>> {
  const result = await runCommand<T>(async (ctx, store, user) => {
    const access = await loadAccess(store, input?.workspaceId, user.id);
    if (!access) return NOT_FOUND;
    return build(access, await documentOf(store, access, input?.documentId), store, ctx);
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/**
 * Slice 27 (D9): the canvases of the chosen projects (every project's, then the rest, when none), in order, for Diagrams'
 * figures; slice 36 (F6): the source's, a baseline's from its content.
 */
async function scopeCanvases(store: DataStore, workspaceId: Uuid, chosen: readonly Uuid[], baselineId: Uuid | null = null): Promise<Uuid[]> {
  return (await documentCanvases(store, workspaceId, { baselineId }, chosen)).order;
}

/** A document's baseline, while its source is one. */
const baselineOf = (doc: Pick<DocumentDefinition, "source_kind" | "baseline_id"> | null): Uuid | null => (doc?.source_kind === "baseline" ? doc.baseline_id : null);

/**
 * New document (D13): a private document from the preset; the page then opens its form. Slice 36: the sign-off preset and
 * "New document from it" (`baselineId`) are made from a baseline, their figures from its canvases.
 */
export async function createDocumentAction(input: CreateDocumentInput): Promise<ActionResult<{ documentId: Uuid; href: string }>> {
  return documentCommand(input, async (access, _doc, store, ctx) => {
    const baselines = await baselineRefs(store, access.workspace.id);
    const given = typeof input?.baselineId === "string" ? input.baselineId : null;
    const from = given ?? (input?.preset === "signoff" ? (baselines[0]?.id ?? null) : null);
    const canvases = await scopeCanvases(store, access.workspace.id, [], from && baselines.some((b) => b.id === from) ? from : null);
    const r = createDocument(ctx, access, input, DOCUMENT_SECTION_KINDS, canvases, baselines);
    return r.ok ? { ...r, value: { documentId: r.value.document.id, href: documentHref(access.workspace.id, r.value.document.id) } } : r;
  });
}

/** Slice 36 (S36-01): a baseline's row's "New document from it": the sign-off preset from that baseline. */
export async function createDocumentFromBaselineAction(input: { workspaceId: string; baselineId: string }): Promise<ActionResult<{ documentId: Uuid; href: string }>> {
  return createDocumentAction({ workspaceId: input?.workspaceId, baselineId: input?.baselineId, preset: "signoff" });
}

/** Slice 36 (B4.6): the Compare dialog's "Make a document"; the page then opens the editor. */
export async function createChangesDocumentAction(input: CreateChangesDocumentInput): Promise<ActionResult<{ documentId: Uuid; href: string }>> {
  return documentCommand(input, async (access, _doc, store, ctx) => {
    const r = createChangesDocument(ctx, access, input, DOCUMENT_SECTION_KINDS, await baselineRefs(store, access.workspace.id));
    return r.ok ? { ...r, value: { documentId: r.value.document.id, href: documentHref(access.workspace.id, r.value.document.id) } } : r;
  });
}

/** One field of the form (the name, the audience, a title page field, a scope part, a section's switch or options). */
export async function updateDocumentAction(input: UpdateDocumentInput): Promise<ActionResult<Saved>> {
  return documentCommand(input, async (access, doc, store, ctx) => {
    // slice 27: a figure added must show a canvas (or a frame of it) of the document's source (slice 36, F6: a
    // baseline's own canvases); read only for a figures' save
    const given = input as { section?: { options?: unknown }; source?: unknown } | null;
    const options = given?.section?.options;
    const figures = typeof options === "object" && options !== null && "figures" in options;
    const none = { canvasIds: new Set<string>(), frameCanvas: new Map<string, string>() };
    const canvases = figures ? await documentCanvases(store, access.workspace.id, { baselineId: baselineOf(doc) }, []) : none;
    // slice 36: a source or a "Compared with" chosen must be a live baseline of the workspace
    const chooses = given?.source !== undefined || (typeof options === "object" && options !== null && "against" in options);
    const baselines = chooses ? await baselineRefs(store, access.workspace.id) : [];
    const r = updateDocument(ctx, access, doc, input, DOCUMENT_SECTION_KINDS, canvases, baselines);
    return r.ok ? { ...r, value: { version: r.value.document.version } } : r;
  });
}

/** "Shared with the workspace" (D4 as answered: at once, no question); refused while the author has left (F17 a). */
export async function setDocumentSharedAction(input: ShareDocumentInput): Promise<ActionResult<Saved>> {
  return documentCommand(input, async (access, doc, store, ctx) => {
    const member = doc ? await store.workspaces.getMember(access.workspace.id, doc.author_id) : null;
    const people = await store.users.listForWorkspace(access.workspace.id);
    const name = (doc && people.find((p) => p.id === doc.author_id)?.display_name) ?? "Its author";
    const r = setDocumentShared(ctx, access, doc, input, { member: member !== null, name });
    return r.ok ? { ...r, value: { version: r.value.document.version } } : r;
  });
}

/** Duplicate: the person's private copy, "{name} (copy)". */
export async function duplicateDocumentAction(input: DuplicateDocumentInput): Promise<ActionResult<{ name: string; href: string }>> {
  return documentCommand(input, (access, doc, _store, ctx) => {
    const r = duplicateDocument(ctx, access, doc, input);
    return r.ok ? { ...r, value: { name: r.value.document.name, href: documentHref(access.workspace.id, r.value.document.id) } } : r;
  });
}

/** Delete, after the tab's question (D10); outside undo. */
export async function deleteDocumentAction(input: DeleteDocumentInput): Promise<ActionResult<null>> {
  return documentCommand(input, (access, doc, _store, ctx) => {
    const r = deleteDocument(ctx, access, doc, input);
    return r.ok ? { ...r, value: null } : r;
  });
}

// ---- the editor (slice 26) ----

/** "+ Add section": a registered type at the end; the answer names the new section, which the editor selects. */
export async function addDocumentSectionAction(input: AddDocumentSectionInput): Promise<ActionResult<Saved<{ sectionId: Uuid }>>> {
  return documentCommand(input, async (access, doc, store, ctx) => {
    // slice 27 (D9): a new Diagrams gets one figure per canvas of the document's scope
    const diagrams = (input as { type?: unknown } | null)?.type === "diagrams";
    const canvasIds = diagrams && doc ? await scopeCanvases(store, access.workspace.id, doc.scope.projects, baselineOf(doc)) : [];
    const r = addDocumentSection(ctx, access, doc, input, DOCUMENT_SECTION_TYPES, canvasIds);
    return r.ok ? { ...r, value: { version: r.value.document.version, sectionId: r.value.sectionId } } : r;
  });
}

/** A section's remove (no question, the prototype's); outside undo. */
export async function removeDocumentSectionAction(input: RemoveDocumentSectionInput): Promise<ActionResult<Saved>> {
  return documentCommand(input, (access, doc, _store, ctx) => {
    const r = removeDocumentSection(ctx, access, doc, input);
    return r.ok ? { ...r, value: { version: r.value.document.version } } : r;
  });
}

/** A section's move up or down. */
export async function moveDocumentSectionAction(input: MoveDocumentSectionInput): Promise<ActionResult<Saved>> {
  return documentCommand(input, (access, doc, _store, ctx) => {
    const r = moveDocumentSection(ctx, access, doc, input);
    return r.ok ? { ...r, value: { version: r.value.document.version } } : r;
  });
}

// ---- slice 36: a document's model from its source ----

/** What the editor reads once when it opens (and again after its source changes): the model as the browser may hold it. */
export type DocumentModelAnswer = Omit<DocumentModel, "snapshot"> & { snapshot: WorkspaceSnapshot<ModuleTable> };

/**
 * The editor's model from the document's source (Q1): the live model, or a baseline's content read back as a snapshot,
 * as the browser may hold it (`browserSnapshot`), with the workspace's live baselines and the changes sections'
 * comparisons made here (Q3). Only for a document the person may open; a read, no write.
 */
export async function documentModelAction(input: { workspaceId: string; documentId: string }): Promise<ActionResult<DocumentModelAnswer>> {
  return withTiming(
    () =>
      modelRead(input?.workspaceId, async (access, _model, store) => {
        const doc = await documentOf(store, access, input?.documentId);
        if (!doc || openRefusal(access, doc)) throw new Error("not_found");
        const model = await documentModel(store, access.workspace, doc);
        if (!model) throw new Error("not_found");
        return { ...model, snapshot: browserSnapshot(model.snapshot) };
      }).catch(() => ({ ok: false as const, code: "not_found" as const, message: "This document is no longer available to you." })),
    (summary, result) =>
      console.log(`timing ${JSON.stringify({ route: "document-model", ok: result.ok, ...summary, bytes: result.ok ? Buffer.byteLength(JSON.stringify(result.value)) : 0 })}`),
  );
}

/**
 * The comparisons alone (Q3): asked again by the editor after a saved change of what they depend on
 * (`changesRequestKey`: the source, the scope, a "Compared with", a changes section added or switched), never per
 * keystroke. Read from the stored recipe.
 */
export async function documentChangesAction(input: { workspaceId: string; documentId: string }): Promise<ActionResult<Record<string, SectionChanges>>> {
  return modelRead(input?.workspaceId, async (access, _model, store) => {
    const doc = await documentOf(store, access, input?.documentId);
    if (!doc || openRefusal(access, doc)) throw new Error("not_found");
    const changes = await documentChanges(store, access.workspace, doc);
    if (!changes) throw new Error("not_found");
    return changes;
  }).catch(() => ({ ok: false as const, code: "not_found" as const, message: "This document is no longer available to you." }));
}
