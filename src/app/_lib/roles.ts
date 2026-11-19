// How roles are shown: labels, what each allows (prototype, user indicator) and the indicator colour.

import type { WorkspaceRole } from "@/domain/types";

// the domain's people commands name roles in their texts the same way (slice 8)
export { ROLE_LABEL } from "@/domain/commands/people";

export const ROLE_CAN: Record<WorkspaceRole, string> = {
  owner: "You can do everything here, including deleting or transferring the workspace.",
  admin: "You can edit the model, approve, add people, change their roles and change settings.",
  modeler: "You can edit the model and canvases. Approving is for reviewers and admins.",
  reviewer: "You can approve mappings and requirements and add notes, but not edit the model.",
  reader: "You can only read this workspace.",
};

/**
 * Why "Add person" is off on the online server (slice 30, B5, L6): an `app_user` made there would have no Auth account and
 * could never sign in; accounts are made by script until the people slice.
 */
export const ADD_PERSON_ONLINE_TEXT = "People are added by an administrator on this server for now.";

/** full = may edit, review = may approve and add notes, none = read-only (reader or archived workspace). */
export type Standing = "full" | "review" | "none";

export function standingOf(role: WorkspaceRole, archived: boolean): Standing {
  if (archived) return "none";
  if (role === "owner" || role === "admin" || role === "modeler") return "full";
  return role === "reviewer" ? "review" : "none";
}
