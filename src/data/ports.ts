// Repository interfaces (AD-19). The app talks to stored data only through these.
// Adapters: the local JSON file now (src/data/local, AD-29), Supabase later.
// Every read of workspace data takes the workspace id and filters on it. Soft-deleted rows are never returned.

import type { WriteSet } from "@/domain/changes";
import type { DomainError } from "@/domain/errors";
import type { Uuid } from "@/domain/ids";
import type {
  AppUser,
  Canvas,
  ChangeEvent,
  Organization,
  OrganizationMember,
  Project,
  ProjectCanvas,
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

export interface ChangeEventRepository {
  /** The change log of a workspace, oldest first. */
  list(workspaceId: Uuid): Promise<ChangeEvent[]>;
}

export type ApplyResult = { ok: true } | { ok: false; error: DomainError };

export interface DataStore {
  users: UserRepository;
  organizations: OrganizationRepository;
  workspaces: WorkspaceRepository;
  projects: ProjectRepository;
  canvases: CanvasRepository;
  changeEvents: ChangeEventRepository;
  /**
   * Applies the rows and change events of one command together or not at all (AD-13). Refuses a stale version,
   * unknown ids, duplicate keys and broken rules with the same error a database would cause.
   */
  apply(writeSet: WriteSet): Promise<ApplyResult>;
}
