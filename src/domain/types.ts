// Row types for the tables in slice 0. Names and columns mirror docs/data-model-v2.md and
// supabase/migrations/20261002000000_initial_schema.sql, so the Supabase adapter can map them one to one.
// Timestamps are ISO 8601 strings (timestamptz).

import type { Uuid } from "./ids";

export type Timestamp = string;

// ---- Closed value lists (text + CHECK in the database, AD-18) ----

export const ORGANIZATION_ROLES = ["owner", "admin", "member"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const WORKSPACE_ROLES = ["owner", "admin", "modeler", "reviewer", "reader"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const DOC_LANGUAGES = ["en", "pl", "de"] as const;
export type DocLanguage = (typeof DOC_LANGUAGES)[number];

export const CHANGE_OPERATIONS = ["create", "update", "delete", "restore"] as const;
export type ChangeOperation = (typeof CHANGE_OPERATIONS)[number];

// ---- Standard columns (AD-12) ----

export interface VersionedColumns {
  id: Uuid;
  version: number;
  created_at: Timestamp;
  created_by: Uuid;
  updated_at: Timestamp;
  updated_by: Uuid;
  deleted_at: Timestamp | null;
}

export interface StandardColumns extends VersionedColumns {
  workspace_id: Uuid;
}

// ---- Tenancy and access ----

export interface AppUser {
  id: Uuid;
  email: string;
  display_name: string;
  created_at: Timestamp;
  last_seen_at: Timestamp | null;
}

export interface Organization extends VersionedColumns {
  name: string;
}

export interface OrganizationMember {
  organization_id: Uuid;
  user_id: Uuid;
  role: OrganizationRole;
  created_at: Timestamp;
}

export interface Workspace extends VersionedColumns {
  organization_id: Uuid;
  name: string;
  client_name: string | null;
  description: string | null;
  doc_language: DocLanguage;
  dv2_mode: boolean;
  four_eyes: boolean;
  archived_at: Timestamp | null;
  archived_by: Uuid | null;
  requirement_key_next: number;
}

export interface WorkspaceMember {
  workspace_id: Uuid;
  user_id: Uuid;
  role: WorkspaceRole;
  added_by: Uuid | null;
  created_at: Timestamp;
}

// ---- Organisation of work ----

export interface Project extends StandardColumns {
  name: string;
  description: string | null;
}

export interface CanvasLook {
  background: string;
  grid: string;
  layer: string;
}

export const DEFAULT_CANVAS_LOOK: CanvasLook = { background: "grey", grid: "dots", layer: "all" };

export interface Canvas extends StandardColumns {
  name: string;
  live_label_id: Uuid | null;
  look: CanvasLook;
}

export interface ProjectCanvas {
  project_id: Uuid;
  canvas_id: Uuid;
  workspace_id: Uuid;
  sort_order: number;
  added_at: Timestamp;
  added_by: Uuid;
}

// ---- History ----

export type RowImage = Record<string, unknown>;

export interface ChangeEvent {
  id: Uuid;
  workspace_id: Uuid;
  change_group_id: Uuid;
  occurred_at: Timestamp;
  user_id: Uuid;
  object_type: string;
  object_id: Uuid;
  operation: ChangeOperation;
  before_image: RowImage | null;
  after_image: RowImage | null;
  context_label_id: Uuid | null;
}

/** The tables a slice 0 command may write, with their row types. */
export interface WritableRows {
  workspace: Workspace;
  workspace_member: WorkspaceMember;
  project: Project;
  canvas: Canvas;
  project_canvas: ProjectCanvas;
}
export type WritableTable = keyof WritableRows;
