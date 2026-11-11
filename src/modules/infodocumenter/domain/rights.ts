// Who may do what with a document (slice 25, PRD item 10 as changed after step 1; F14 (b), F15, F17). Pure. One core
// action, `module.own_objects` (every role, never in an archived workspace: AD-05's addition), carries the member's
// own documents; `model.edit` (owners, admins and modelers) carries sharing and changing a shared document; owners and
// admins delete any shared one. Every member who sees a document opens and prints it, guests included (F16 as changed).

import { domainError, notFound, type DomainError } from "@/domain/errors";
import { checkPermission, type WorkspaceAccess } from "@/domain/permissions";
import type { DocumentDefinition } from "./types";

/** The refusals (step 1's list of new texts). */
export const RIGHTS_TEXTS = {
  off: "InfoDocumenter is off in this workspace.",
  privateEdit: "Only its author changes a private document.",
  sharedEdit: "A shared document is changed by modelers, admins and owners.",
  sharedDelete: "A shared document is deleted by owners, admins or its author.",
  share: "Only modelers, admins and owners share documents.",
  authorGone: (author: string) => `${author} is no longer a member of this workspace, so the document stays shared.`,
} as const;

type Doc = Pick<DocumentDefinition, "author_id" | "shared" | "deleted_at" | "workspace_id">;

const isAuthor = (access: WorkspaceAccess, doc: Doc) => access.member !== null && doc.author_id === access.member.user_id;

/** Whether the person sees the document: a shared one, or their own. Never another's private one. */
export const canSee = (access: WorkspaceAccess, doc: Doc): boolean =>
  access.member !== null && access.member.workspace_id === access.workspace.id && doc.workspace_id === access.workspace.id && doc.deleted_at === null && (doc.shared || isAuthor(access, doc));

/** The member's own objects: membership, the archive (refused), any role. */
const own = (access: WorkspaceAccess): DomainError | null => checkPermission(access, "module.own_objects");

/** Why the module refuses every write: InfoDocumenter off in the workspace (AD-35: nothing creates or brings back one). */
const offRefusal = (access: WorkspaceAccess): DomainError | null => (access.workspace.infodoc ? null : domainError("forbidden", RIGHTS_TEXTS.off));

/** Making a document of one's own (and duplicating one): every member, not in an archived workspace, while it is on. */
export function createRefusal(access: WorkspaceAccess): DomainError | null {
  return own(access) ?? offRefusal(access);
}

/**
 * The refusal of a document the person does not see: "not found", never "forbidden", so another's private document is
 * not told to exist (F15).
 */
const unseen = (access: WorkspaceAccess, doc: Doc | null | undefined): DomainError | null => (doc && canSee(access, doc) ? null : notFound("document"));

/** Changing a document's recipe: a private one by its author; a shared one by owners, admins and modelers. */
export function editRefusal(access: WorkspaceAccess, doc: Doc | null | undefined): DomainError | null {
  const first = own(access) ?? offRefusal(access) ?? unseen(access, doc);
  if (first) return first;
  if (doc!.shared) return checkPermission(access, "model.edit") ? domainError("forbidden", RIGHTS_TEXTS.sharedEdit) : null;
  return isAuthor(access, doc!) ? null : domainError("forbidden", RIGHTS_TEXTS.privateEdit);
}

/**
 * Sharing or unsharing: owners, admins and modelers, on a document they see (a private one is its author's). Unsharing
 * makes it its author's private document again, refused while the author is no longer a member (F17 a).
 */
export function shareRefusal(access: WorkspaceAccess, doc: Doc | null | undefined, shared: boolean, author: { member: boolean; name: string }): DomainError | null {
  const first = own(access) ?? offRefusal(access) ?? unseen(access, doc);
  if (first) return first;
  if (checkPermission(access, "model.edit")) return domainError("forbidden", RIGHTS_TEXTS.share);
  if (!shared && doc!.shared && !author.member) return domainError("invalid", RIGHTS_TEXTS.authorGone(author.name));
  return null;
}

/** Deleting: a private one by its author; a shared one by owners, admins or its author, also one whose role was lowered (F17 b). */
export function deleteRefusal(access: WorkspaceAccess, doc: Doc | null | undefined): DomainError | null {
  const first = own(access) ?? offRefusal(access) ?? unseen(access, doc);
  if (first) return first;
  if (isAuthor(access, doc!)) return null;
  if (!doc!.shared) return domainError("forbidden", RIGHTS_TEXTS.privateEdit);
  const role = access.member!.role;
  return role === "owner" || role === "admin" ? null : domainError("forbidden", RIGHTS_TEXTS.sharedDelete);
}

/** Opening and printing: every member who sees it, guests included, also in an archived workspace, while it is on. */
export function openRefusal(access: WorkspaceAccess, doc: Doc | null | undefined): DomainError | null {
  return checkPermission(access, "workspace.view") ?? offRefusal(access) ?? unseen(access, doc);
}

/** What the page offers on a document the person sees (the tab's buttons and the form, step 4). */
export function documentRights(access: WorkspaceAccess, doc: Doc): { edit: boolean; share: boolean; delete: boolean; duplicate: boolean } {
  return {
    edit: editRefusal(access, doc) === null,
    share: own(access) === null && checkPermission(access, "model.edit") === null && canSee(access, doc),
    delete: deleteRefusal(access, doc) === null,
    duplicate: createRefusal(access) === null && canSee(access, doc),
  };
}
