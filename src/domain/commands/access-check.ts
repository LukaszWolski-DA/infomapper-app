// The access a command was checked with, read again inside the write (slice 30, B3, L1): a role changed or a workspace
// archived between the command's read and its write refuses the write. The domain checks permissions against what its
// loader read (`loadAccess`); the write set does not say which action it needed, so the rule is plain: any difference
// refuses (a promotion meanwhile costs one save again; Łukasz, 19 November 2026). Both adapters compare with the state
// before the write's own rows (an archive's own write changes the archive).

import { ARCHIVED_MESSAGE, domainError, staleVersion, type DomainError } from "../errors";
import type { Uuid } from "../ids";

/** What a command read about the actor, as `runCommand` records it from the store it hands the command. */
export interface CheckedAccess {
  userId: Uuid;
  /** The workspace the write is in, when the command read it: its archive and the actor's role there (null: no row). */
  workspace?: { id: Uuid; name: string; archived: boolean; role: string | null };
  /** The organization, when the command read the actor's membership there (a workspace's create). */
  organization?: { id: Uuid; name?: string; role: string | null };
}

/** The same facts as they stand inside the write, before its rows. Absent parts were not read (nothing to compare). */
export interface AccessNow {
  workspace?: { archived: boolean; role: string | null } | null;
  organization?: { role: string | null };
}

export const roleChangedMessage = (where: string): string => `Your role in ${where} changed meanwhile, so nothing was saved.`;

/** The refusal when the access changed since the command checked it, else null. */
export function accessChangedRefusal(checked: CheckedAccess, now: AccessNow): DomainError | null {
  if (checked.workspace && now.workspace !== undefined) {
    if (now.workspace === null) return domainError("not_found", "This workspace does not exist.");
    if (now.workspace.role !== checked.workspace.role) return domainError("forbidden", roleChangedMessage(checked.workspace.name));
    if (now.workspace.archived && !checked.workspace.archived) return domainError("archived", ARCHIVED_MESSAGE);
    // unarchived meanwhile: what the command decided on is out of date, so it is built again from fresh data
    if (!now.workspace.archived && checked.workspace.archived) return staleVersion();
  }
  if (checked.organization && now.organization && now.organization.role !== checked.organization.role) {
    return domainError("forbidden", roleChangedMessage(checked.organization.name ?? "this organization"));
  }
  return null;
}
