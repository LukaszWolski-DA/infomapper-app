// Repository interfaces (AD-19). The app talks to stored data only through these.
// Adapters: the local JSON file now (src/data/local, AD-29), Supabase later.
// Every read of workspace data takes the workspace id and filters on it. Soft-deleted rows are never returned.

import type { WriteSet } from "@/domain/changes";
import type { WorkspaceRows } from "@/domain/commands/undo";
import type { DomainError } from "@/domain/errors";
import type { Uuid } from "@/domain/ids";
import type { UndoHistory } from "@/domain/model/undo-history";
import type {
  AppUser,
  Canvas,
  CanvasItem,
  ChangeEvent,
  Frame,
  Label,
  LabelLink,
  Note,
  Organization,
  OrganizationMember,
  Project,
  ProjectCanvas,
  ProjectPinnedLabel,
  Workspace,
  WorkspaceMember,
  WorkspaceModel,
} from "@/domain/types";

export type { WorkspaceModel } from "@/domain/types";

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

export interface ModelRepository {
  /** Every live model row of the workspace, from concepts to mapping inputs. */
  load(workspaceId: Uuid): Promise<WorkspaceModel>;
  /** Every row of the undoable tables, deleted ones included (undo and redo, slice 1b). */
  loadForUndo(workspaceId: Uuid): Promise<WorkspaceRows>;
}

export interface CanvasItemRepository {
  get(workspaceId: Uuid, canvasItemId: Uuid): Promise<CanvasItem | null>;
  /** Cards on every canvas of the workspace (for the delete impact, D-47). */
  list(workspaceId: Uuid): Promise<CanvasItem[]>;
  listOfCanvas(workspaceId: Uuid, canvasId: Uuid): Promise<CanvasItem[]>;
}

export interface FrameRepository {
  /** Frames on every canvas of the workspace (concept deletion turns concept frames into free ones, D-47). */
  list(workspaceId: Uuid): Promise<Frame[]>;
  listOfCanvas(workspaceId: Uuid, canvasId: Uuid): Promise<Frame[]>;
}

/** Working labels (slice 3a): the workspace's labels, what they mark, and the labels pinned to its projects. */
export interface LabelRepository {
  list(workspaceId: Uuid): Promise<Label[]>;
  get(workspaceId: Uuid, labelId: Uuid): Promise<Label | null>;
  /** Links whose label and item are both live. */
  listLinks(workspaceId: Uuid): Promise<LabelLink[]>;
  getLink(workspaceId: Uuid, labelLinkId: Uuid): Promise<LabelLink | null>;
  /** Pins of live labels to live projects. */
  listPins(workspaceId: Uuid): Promise<ProjectPinnedLabel[]>;
}

/** Notes on canvases (slice 3a). */
export interface NoteRepository {
  /** Notes on every live canvas of the workspace (the project home, deleting an entity from every canvas). */
  list(workspaceId: Uuid): Promise<Note[]>;
  listOfCanvas(workspaceId: Uuid, canvasId: Uuid): Promise<Note[]>;
  get(workspaceId: Uuid, noteId: Uuid): Promise<Note | null>;
}

export interface ChangeEventRepository {
  /** The change log of a workspace, oldest first. */
  list(workspaceId: Uuid): Promise<ChangeEvent[]>;
  /** Events about one mapping and its inputs, oldest first (four-eyes, AD-06). */
  listForMapping(workspaceId: Uuid, mappingId: Uuid): Promise<ChangeEvent[]>;
}

/**
 * The undo history of each person in each workspace (slice 1b). In memory on the server for now; it comes into the
 * database with Supabase. Steps whose change group is no longer in the change log (fresh demo data) are left out.
 */
export interface UndoHistoryRepository {
  get(workspaceId: Uuid, userId: Uuid): Promise<UndoHistory>;
  /** Changes the history in one step, so two writes at the same moment cannot lose a step. */
  update(workspaceId: Uuid, userId: Uuid, change: (history: UndoHistory) => UndoHistory): Promise<UndoHistory>;
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
  frames: FrameRepository;
  labels: LabelRepository;
  notes: NoteRepository;
  changeEvents: ChangeEventRepository;
  undoHistory: UndoHistoryRepository;
  /**
   * Applies the rows and change events of one command together or not at all (AD-13). Refuses a stale version,
   * unknown ids, duplicate keys and broken rules with the same error a database would cause.
   */
  apply(writeSet: WriteSet): Promise<ApplyResult>;
}
