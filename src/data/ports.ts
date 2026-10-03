// Repository interfaces (AD-19). The app talks to stored data only through these.
// Adapters: the local JSON file now (src/data/local, AD-29), Supabase later.
// Every read of workspace data takes the workspace id and filters on it. Soft-deleted rows are never returned.

import type { WriteSet } from "@/domain/changes";
import type { DomainError } from "@/domain/errors";
import type { Uuid } from "@/domain/ids";
import type {
  AppUser,
  Attribute,
  Canvas,
  CanvasItem,
  ChangeEvent,
  Concept,
  Entity,
  Mapping,
  MappingInput,
  Organization,
  OrganizationMember,
  Project,
  ProjectCanvas,
  Relationship,
  SourceColumn,
  SourceSystem,
  SourceTable,
  Workspace,
  WorkspaceMember,
} from "@/domain/types";

export interface UserRepository {
  list(): Promise<AppUser[]>;
  get(userId: Uuid): Promise<AppUser | null>;
}

export interface OrganizationRepository {
  get(organizationId: Uuid): Promise<Organization | null>;
  /** Organizations the user is a member of, or a guest in through a workspace membership. */
  listForUser(userId: Uuid): Promise<Organization[]>;
  getMember(organizationId: Uuid, userId: Uuid): Promise<OrganizationMember | null>;
  /** All organization memberships of the given users (to tell guests apart). */
  listMembershipsOfUsers(userIds: readonly Uuid[]): Promise<OrganizationMember[]>;
}

export interface WorkspaceRepository {
  get(workspaceId: Uuid): Promise<Workspace | null>;
  /** Workspaces the user is a member of. */
  listForUser(userId: Uuid): Promise<Workspace[]>;
  getMember(workspaceId: Uuid, userId: Uuid): Promise<WorkspaceMember | null>;
  listMembers(workspaceId: Uuid): Promise<WorkspaceMember[]>;
}

export interface ProjectRepository {
  get(workspaceId: Uuid, projectId: Uuid): Promise<Project | null>;
  list(workspaceId: Uuid): Promise<Project[]>;
}

export interface CanvasRepository {
  get(workspaceId: Uuid, canvasId: Uuid): Promise<Canvas | null>;
  list(workspaceId: Uuid): Promise<Canvas[]>;
  /** Links of a project to its live canvases, in tab order. */
  listLinksOfProject(workspaceId: Uuid, projectId: Uuid): Promise<ProjectCanvas[]>;
  /** Links of a canvas to its live projects. */
  listLinksOfCanvas(workspaceId: Uuid, canvasId: Uuid): Promise<ProjectCanvas[]>;
}

/** The live model of one workspace (slice 1a). */
export interface WorkspaceModel {
  /** In panel order (sort_order). */
  concepts: Concept[];
  entities: Entity[];
  /** Per entity in model order (sort_order, D-36). */
  attributes: Attribute[];
  relationships: Relationship[];
  sourceSystems: SourceSystem[];
  sourceTables: SourceTable[];
  /** Per table in physical order (ordinal). */
  sourceColumns: SourceColumn[];
  mappings: Mapping[];
  /** Per mapping in rule order (sort_order). */
  mappingInputs: MappingInput[];
}

export interface ModelRepository {
  /** Every live model row of the workspace, from concepts to mapping inputs. */
  load(workspaceId: Uuid): Promise<WorkspaceModel>;
}

export interface CanvasItemRepository {
  get(workspaceId: Uuid, canvasItemId: Uuid): Promise<CanvasItem | null>;
  /** Cards on every canvas of the workspace (for the delete impact, D-47). */
  list(workspaceId: Uuid): Promise<CanvasItem[]>;
  listOfCanvas(workspaceId: Uuid, canvasId: Uuid): Promise<CanvasItem[]>;
}

export interface ChangeEventRepository {
  /** The change log of a workspace, oldest first. */
  list(workspaceId: Uuid): Promise<ChangeEvent[]>;
  /** Events about one mapping and its inputs, oldest first (four-eyes, AD-06). */
  listForMapping(workspaceId: Uuid, mappingId: Uuid): Promise<ChangeEvent[]>;
}

export type ApplyResult = { ok: true } | { ok: false; error: DomainError };

export interface DataStore {
  users: UserRepository;
  organizations: OrganizationRepository;
  workspaces: WorkspaceRepository;
  projects: ProjectRepository;
  canvases: CanvasRepository;
  model: ModelRepository;
  canvasItems: CanvasItemRepository;
  changeEvents: ChangeEventRepository;
  /**
   * Applies the rows and change events of one command together or not at all (AD-13). Refuses a stale version,
   * unknown ids, duplicate keys and broken rules with the same error a database would cause.
   */
  apply(writeSet: WriteSet): Promise<ApplyResult>;
}
