// The count rules checked inside the write (slice 30, F5, F6): what a command counted from the rows it read can be
// changed by another write at the same moment, which no version check sees (two people removing each other's Owner
// role, deleting the last two projects, …). Each adapter applies a write set's rows, then asks this rule, on the state
// after them and before it commits, whether anything counted is now missing: the local adapter in its serialised write
// (on its next state), Postgres in the write's transaction under the workspace's lock (with the rows it read for the
// checks the write set needs). One rule, so both adapters refuse the same writes with the same messages.
//
// The six rules:
// - `last_owner`: a workspace with members keeps an owner (slice 8, D-58);
// - `last_project`: a workspace keeps a live project (slice 12a, D-65);
// - `infocube_off`: no live fact or dimension while InfoCube is off (slice 15a, C-7);
// - `canvas_links`: a live canvas keeps a live project, a live project a live canvas (D-28);
// - `org_owner_workspace`: an organization's owner keeps a workspace there (D-58);
// - `org_membership`: an organization member's row goes with their last workspace there, and only then (D-58, P7).
// The last two cross workspaces: a write that can break them locks the organization's row first (`needsOrganizationLock`).

import type { Write } from "../changes";
import { domainError, staleVersion, type DomainError } from "../errors";
import type { Uuid } from "../ids";
import { INFOCUBE_OFF_MESSAGE, turnOffRefusedMessage } from "../model/levels";
import type { AppUser, Canvas, Entity, Organization, OrganizationMember, Project, ProjectCanvas, Workspace, WorkspaceMember } from "../types";
import { CANVAS_NEEDS_PROJECT_MESSAGE, PROJECT_NEEDS_CANVAS_MESSAGE } from "./canvas";
import { LAST_OWNER } from "./people";
import { LAST_PROJECT_MESSAGE } from "./project";

export type CountCheck =
  | { kind: "last_owner"; workspaceId: Uuid }
  | { kind: "last_project"; workspaceId: Uuid }
  | { kind: "infocube_off"; workspaceId: Uuid; turnedOff: boolean }
  | { kind: "canvas_links"; workspaceId: Uuid; canvasIds: Uuid[]; projectIds: Uuid[] }
  | { kind: "org_owner_workspace"; workspaceId: Uuid; userId: Uuid }
  /** `removedFrom`: the organizations whose `organization_member` row of the person the write removes (P7). */
  | { kind: "org_membership"; workspaceId: Uuid; userId: Uuid; removedFrom: Uuid[] };

/**
 * The rows the checks read, as they are after the write. Each list may hold more than the checks need (the local adapter
 * passes its whole state) but never less: Postgres reads, per check, the rows named in `countReads`.
 */
export interface CountRows {
  workspace: readonly Pick<Workspace, "id" | "name" | "organization_id" | "infocube" | "deleted_at">[];
  workspace_member: readonly Pick<WorkspaceMember, "workspace_id" | "user_id" | "role">[];
  project: readonly Pick<Project, "id" | "workspace_id" | "deleted_at">[];
  entity: readonly Pick<Entity, "workspace_id" | "deleted_at" | "model_level">[];
  canvas: readonly Pick<Canvas, "id" | "deleted_at">[];
  project_canvas: readonly Pick<ProjectCanvas, "project_id" | "canvas_id">[];
  organization: readonly Pick<Organization, "id" | "name">[];
  organization_member: readonly Pick<OrganizationMember, "organization_id" | "user_id" | "role">[];
  app_user: readonly Pick<AppUser, "id" | "display_name">[];
}

const rowOf = (w: Write): Record<string, unknown> => (w.kind === "remove" ? (w.before as unknown as Record<string, unknown>) : (w.row as unknown as Record<string, unknown>));
const beforeOf = (w: Write): Record<string, unknown> | null => (w.kind === "insert" ? null : (w.before as unknown as Record<string, unknown>));

/** The checks a write set needs, in the order the local adapter has always made them (owner, project, InfoCube), then the rest. */
export function countChecks(writes: readonly Write[]): CountCheck[] {
  const owners = new Set<Uuid>();
  const projects = new Set<Uuid>();
  const cube = new Map<Uuid, boolean>();
  const links = new Map<Uuid, { canvasIds: Set<Uuid>; projectIds: Set<Uuid> }>();
  const people = new Map<string, { workspaceId: Uuid; userId: Uuid }>();
  const removedRows = new Map<Uuid, Uuid[]>();
  for (const w of writes) {
    const row = rowOf(w);
    const before = beforeOf(w);
    switch (w.table) {
      case "workspace_member":
        if (w.kind !== "insert") owners.add(before!.workspace_id as Uuid);
        // a removal, or an addition racing one, changes who still has a workspace in the organization
        people.set(`${String(row.workspace_id)}|${String(row.user_id)}`, { workspaceId: row.workspace_id as Uuid, userId: row.user_id as Uuid });
        break;
      case "organization_member":
        if (w.kind === "remove") removedRows.set(row.user_id as Uuid, [...(removedRows.get(row.user_id as Uuid) ?? []), row.organization_id as Uuid]);
        break;
      case "project":
        if (w.kind === "update" && before!.deleted_at === null && row.deleted_at !== null) projects.add(before!.workspace_id as Uuid);
        break;
      case "workspace":
        cube.set(row.id as Uuid, true);
        break;
      case "entity":
        if (!cube.has(row.workspace_id as Uuid)) cube.set(row.workspace_id as Uuid, false);
        break;
      case "project_canvas": {
        if (w.kind !== "remove") break;
        const at = links.get(row.workspace_id as Uuid) ?? { canvasIds: new Set<Uuid>(), projectIds: new Set<Uuid>() };
        at.canvasIds.add(row.canvas_id as Uuid);
        at.projectIds.add(row.project_id as Uuid);
        links.set(row.workspace_id as Uuid, at);
        break;
      }
    }
  }
  return [
    ...[...owners].map((workspaceId) => ({ kind: "last_owner" as const, workspaceId })),
    ...[...projects].map((workspaceId) => ({ kind: "last_project" as const, workspaceId })),
    ...[...cube].map(([workspaceId, turnedOff]) => ({ kind: "infocube_off" as const, workspaceId, turnedOff })),
    ...[...links].map(([workspaceId, l]) => ({ kind: "canvas_links" as const, workspaceId, canvasIds: [...l.canvasIds], projectIds: [...l.projectIds] })),
    ...[...people.values()].flatMap((p) => [
      { kind: "org_owner_workspace" as const, ...p },
      { kind: "org_membership" as const, ...p, removedFrom: removedRows.get(p.userId) ?? [] },
    ]),
  ];
}

/** Whether a write set can break a count across the organization's workspaces: its row is locked first (B4's order). */
export function needsOrganizationLock(writes: readonly Write[]): boolean {
  return writes.some((w) => w.table === "workspace_member" || w.table === "organization_member");
}

/** The first check the state after the write breaks, as the refusal its command would give; null when none. */
export function countRefusal(rows: CountRows, checks: readonly CountCheck[]): DomainError | null {
  for (const check of checks) {
    const refusal = refusalOf(rows, check);
    if (refusal) return refusal;
  }
  return null;
}

function refusalOf(rows: CountRows, check: CountCheck): DomainError | null {
  const workspace = rows.workspace.find((w) => w.id === check.workspaceId);
  switch (check.kind) {
    case "last_owner": {
      const members = rows.workspace_member.filter((m) => m.workspace_id === check.workspaceId);
      return members.length > 0 && !members.some((m) => m.role === "owner") ? domainError("invalid", LAST_OWNER(workspace?.name ?? "This workspace")) : null;
    }
    case "last_project":
      return rows.project.some((p) => p.workspace_id === check.workspaceId && p.deleted_at === null) ? null : domainError("invalid", LAST_PROJECT_MESSAGE);
    case "infocube_off": {
      if (!workspace || workspace.infocube) return null;
      const count = rows.entity.filter((e) => e.workspace_id === check.workspaceId && e.deleted_at === null && e.model_level === "dimensional").length;
      if (!count) return null;
      return check.turnedOff ? domainError("invalid", turnOffRefusedMessage(count)) : domainError("forbidden", INFOCUBE_OFF_MESSAGE);
    }
    case "canvas_links": {
      const liveCanvas = new Set(rows.canvas.filter((c) => c.deleted_at === null).map((c) => c.id));
      const liveProject = new Set(rows.project.filter((p) => p.deleted_at === null).map((p) => p.id));
      for (const canvasId of check.canvasIds) {
        if (liveCanvas.has(canvasId) && !rows.project_canvas.some((l) => l.canvas_id === canvasId && liveProject.has(l.project_id))) {
          return domainError("invalid", CANVAS_NEEDS_PROJECT_MESSAGE);
        }
      }
      for (const projectId of check.projectIds) {
        if (liveProject.has(projectId) && !rows.project_canvas.some((l) => l.project_id === projectId && liveCanvas.has(l.canvas_id))) {
          return domainError("invalid", PROJECT_NEEDS_CANVAS_MESSAGE);
        }
      }
      return null;
    }
    case "org_owner_workspace":
    case "org_membership": {
      if (!workspace) return null;
      const organizationId = workspace.organization_id;
      const inOrganization = new Set(rows.workspace.filter((w) => w.organization_id === organizationId && w.deleted_at === null).map((w) => w.id));
      const hasWorkspace = rows.workspace_member.some((m) => m.user_id === check.userId && inOrganization.has(m.workspace_id));
      const member = rows.organization_member.find((m) => m.organization_id === organizationId && m.user_id === check.userId) ?? null;
      if (check.kind === "org_owner_workspace") {
        if (hasWorkspace || member?.role !== "owner") return null;
        const person = rows.app_user.find((u) => u.id === check.userId)?.display_name ?? "This person";
        const organization = rows.organization.find((o) => o.id === organizationId)?.name ?? "the organization";
        return domainError("invalid", `${person} owns ${organization}, so they keep at least one workspace there.`);
      }
      // the member row (admin or member) goes with the last workspace and stays with any other: a removal that raced
      // another removal or an addition was built on rows changed meanwhile, so it is refused as stale and built again
      if (member && member.role !== "owner" && !hasWorkspace) return staleVersion();
      // and the other way round: a row removed while the person still has a workspace there would make them a guest
      if (check.removedFrom.includes(organizationId) && hasWorkspace) return staleVersion();
      return null;
    }
  }
}

/** The organization a count check reads across workspaces, if any (null for checks within one workspace). */
export const crossesWorkspaces = (check: CountCheck): boolean => check.kind === "org_owner_workspace" || check.kind === "org_membership";
