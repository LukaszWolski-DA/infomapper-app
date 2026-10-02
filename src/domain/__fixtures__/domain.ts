// Test fixtures for domain unit tests. Not used by application code.

import type { CommandContext } from "../changes";
import type { WorkspaceAccess } from "../permissions";
import {
  DEFAULT_CANVAS_LOOK,
  type Canvas,
  type Organization,
  type OrganizationMember,
  type Project,
  type ProjectCanvas,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceRole,
} from "../types";

export const T0 = "2026-10-01T08:00:00.000Z";
export const NOW = "2026-10-02T12:00:00.000Z";

export const ids = {
  org: "01900000-0000-7000-8000-000000000001",
  otherOrg: "01900000-0000-7000-8000-000000000002",
  ws: "01900000-0000-7000-8000-000000000010",
  actor: "01900000-0000-7000-8000-000000000100",
  someoneElse: "01900000-0000-7000-8000-000000000101",
  projectA: "01900000-0000-7000-8000-000000001001",
  projectB: "01900000-0000-7000-8000-000000001002",
  canvas1: "01900000-0000-7000-8000-000000002001",
  canvas2: "01900000-0000-7000-8000-000000002002",
} as const;

/** A context whose ids count up predictably: 01900000-0000-7000-8000-9000000000NN. */
export function makeCtx(actorId: string = ids.actor): CommandContext & { issued: string[] } {
  const issued: string[] = [];
  return {
    actorId,
    now: NOW,
    issued,
    newId: () => {
      const id = `01900000-0000-7000-8000-9${String(issued.length + 1).padStart(11, "0")}`;
      issued.push(id);
      return id;
    },
  };
}

const standard = { version: 1, created_at: T0, created_by: ids.someoneElse, updated_at: T0, updated_by: ids.someoneElse, deleted_at: null };

export const organization = (over: Partial<Organization> = {}): Organization => ({
  id: ids.org,
  name: "InfoMate",
  ...standard,
  ...over,
});

export const organizationMember = (over: Partial<OrganizationMember> = {}): OrganizationMember => ({
  organization_id: ids.org,
  user_id: ids.actor,
  role: "member",
  created_at: T0,
  ...over,
});

export const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  id: ids.ws,
  organization_id: ids.org,
  name: "Retail Co – DWH",
  client_name: "Retail Co",
  description: null,
  doc_language: "en",
  dv2_mode: false,
  four_eyes: false,
  archived_at: null,
  archived_by: null,
  requirement_key_next: 101,
  ...standard,
  version: 3,
  ...over,
});

export const member = (role: WorkspaceRole, over: Partial<WorkspaceMember> = {}): WorkspaceMember => ({
  workspace_id: ids.ws,
  user_id: ids.actor,
  role,
  added_by: null,
  created_at: T0,
  ...over,
});

export const access = (role: WorkspaceRole | null, ws: Partial<Workspace> = {}): WorkspaceAccess => ({
  workspace: workspace(ws),
  member: role ? member(role) : null,
});

export const archived = { archived_at: T0, archived_by: ids.actor };

export const project = (id: string = ids.projectA, over: Partial<Project> = {}): Project => ({
  id,
  workspace_id: ids.ws,
  name: id === ids.projectA ? "Customer 360" : "Order management",
  description: null,
  ...standard,
  ...over,
});

export const canvas = (id: string = ids.canvas1, over: Partial<Canvas> = {}): Canvas => ({
  id,
  workspace_id: ids.ws,
  name: id === ids.canvas1 ? "Customer & orders" : "Order lines & products",
  live_label_id: null,
  look: { ...DEFAULT_CANVAS_LOOK },
  ...standard,
  version: 2,
  ...over,
});

export const link = (projectId: string, canvasId: string, sortOrder = 0): ProjectCanvas => ({
  project_id: projectId,
  canvas_id: canvasId,
  workspace_id: ids.ws,
  sort_order: sortOrder,
  added_at: T0,
  added_by: ids.someoneElse,
});
