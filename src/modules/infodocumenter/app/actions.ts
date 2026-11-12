"use server";

// InfoDocumenter's server actions (slice 25, step 4) over step 2's commands: create from a preset, save one field,
// share or unshare, duplicate, delete. Each runs through `runCommand` (the session, an unlocked organization, the
// composed store, the write with its change event), outside undo: no Undo in their toasts. The rights are the domain's
// (`rights.ts`): a guest makes and prints private documents, an archived workspace's are read only.

import { revalidatePath } from "next/cache";
import { DOCUMENT_SECTION_KINDS } from "@/app/_lib/documents";
import { loadAccess } from "@/app/_lib/model-command";
import { documentHref } from "@/app/_lib/paths";
import { runCommand, type ActionResult, type Saved } from "@/app/_lib/run-command";
import type { DataStore } from "@/data";
import type { CommandResult } from "@/domain/changes";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceAccess } from "@/domain/permissions";
import {
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

/** New document (D13): a private document from the preset; the page then opens its form. */
export async function createDocumentAction(input: CreateDocumentInput): Promise<ActionResult<{ documentId: Uuid; href: string }>> {
  return documentCommand(input, (access, _doc, _store, ctx) => {
    const r = createDocument(ctx, access, input, DOCUMENT_SECTION_KINDS);
    return r.ok ? { ...r, value: { documentId: r.value.document.id, href: documentHref(access.workspace.id, r.value.document.id) } } : r;
  });
}

/** One field of the form (the name, the audience, a title page field, a scope part, a section's switch or options). */
export async function updateDocumentAction(input: UpdateDocumentInput): Promise<ActionResult<Saved>> {
  return documentCommand(input, (access, doc, _store, ctx) => {
    const r = updateDocument(ctx, access, doc, input, DOCUMENT_SECTION_KINDS);
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
