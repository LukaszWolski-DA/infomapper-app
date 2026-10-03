// How roles are shown: labels, what each allows (prototype, user indicator) and the indicator colour.

import type { WorkspaceRole } from "@/domain/types";

export const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  modeler: "Modeler",
  reviewer: "Reviewer",
  reader: "Reader",
};

export const ROLE_CAN: Record<WorkspaceRole, string> = {
  owner: "You can do everything here, including deleting or transferring the workspace.",
  admin: "You can edit the model, approve, invite people and change settings.",
  modeler: "You can edit the model and canvases. Approving is for reviewers and admins.",
  reviewer: "You can approve mappings and requirements and add notes, but not edit the model.",
  reader: "You can only read this workspace.",
};

/** full = may edit, review = may approve and add notes, none = read-only (reader or archived workspace). */
export type Standing = "full" | "review" | "none";

export function standingOf(role: WorkspaceRole, archived: boolean): Standing {
  if (archived) return "none";
  if (role === "owner" || role === "admin" || role === "modeler") return "full";
  return role === "reviewer" ? "review" : "none";
}
