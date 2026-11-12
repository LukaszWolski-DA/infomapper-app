// A workspace's live model and its consistent snapshot, from stored rows (slice 25, step 1's F1). Pure: the local
// adapter's `model.load` and `snapshot` hand it the file's rows, so the live filter, the orders and the lost originals
// are one rule wherever the model is read, and a snapshot is one read of the file, never several that a write may fall
// between.

import type { Uuid } from "../ids";
import type {
  AppUser,
  CanvasItem,
  ChangeEvent,
  CoreWritableRows,
  LostOriginal,
  ModuleTable,
  Organization,
  Project,
  ProjectCanvas,
  Requirement,
  RequirementLink,
  Workspace,
  WorkspaceMember,
  WorkspaceModel,
  WritableRows,
} from "../types";

/** Stored rows of InfoMapper's tables, any workspace, deleted ones included: as the local file holds them. */
export type StoredRows = { readonly [K in keyof CoreWritableRows]: readonly CoreWritableRows[K][] } & { readonly change_event: readonly ChangeEvent[] };

type Row = { workspace_id: Uuid; deleted_at: string | null };
const live = <R extends { deleted_at: string | null }>(rows: readonly R[]): R[] => rows.filter((r) => r.deleted_at === null);
const ofWorkspace = <R extends Row>(rows: readonly R[], workspaceId: Uuid): R[] => rows.filter((r) => r.deleted_at === null && r.workspace_id === workspaceId);
const idsOf = (rows: readonly { id: Uuid; workspace_id: Uuid; deleted_at: string | null }[], workspaceId: Uuid) =>
  new Set(ofWorkspace(rows, workspaceId).map((r) => r.id));

/** A project's canvases in tab order: their place, then when they were added. */
export const byTabOrder = (a: ProjectCanvas, b: ProjectCanvas): number => a.sort_order - b.sort_order || a.added_at.localeCompare(b.added_at);

/**
 * The deleted originals that live copies point to, with their entity's name, deleted too or not (slice 10c, F6): what a
 * copy's panel names. One pass over the workspace's attributes.
 */
export function lostOriginalsOf(rows: Pick<StoredRows, "attribute" | "entity">, workspaceId: Uuid): LostOriginal[] {
  const attributes = rows.attribute.filter((a) => a.workspace_id === workspaceId);
  const byId = new Map(attributes.map((a) => [a.id, a]));
  const wanted = new Set<Uuid>();
  for (const a of attributes) {
    if (a.deleted_at !== null || a.copied_from_attribute_id === null) continue;
    if (byId.get(a.copied_from_attribute_id)?.deleted_at !== null) wanted.add(a.copied_from_attribute_id);
  }
  if (!wanted.size) return [];
  const entityName = new Map(rows.entity.filter((e) => e.workspace_id === workspaceId).map((e) => [e.id, e.name]));
  return [...wanted].flatMap((id) => {
    const a = byId.get(id);
    return a ? [{ id, name: a.name, entityName: entityName.get(a.entity_id) ?? "?" }] : [];
  });
}

/**
 * The workspace's live model: concepts in panel order (`sort_order`, then name), entities by name, attributes per entity
 * in model order, sources by name and columns in physical order, inputs in rule order; the classification and stereotype
 * lists with their removed rows (their codes stay taken), live classification links; the lost originals.
 */
export function workspaceModelOf(rows: StoredRows, workspaceId: Uuid): WorkspaceModel {
  const of = <R extends Row>(r: readonly R[]) => ofWorkspace(r, workspaceId);
  return {
    concepts: of(rows.concept).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    entities: of(rows.entity).sort((a, b) => a.name.localeCompare(b.name)),
    attributes: of(rows.attribute).sort((a, b) => a.entity_id.localeCompare(b.entity_id) || a.sort_order - b.sort_order),
    relationships: of(rows.relationship),
    sourceSystems: of(rows.source_system).sort((a, b) => a.name.localeCompare(b.name)),
    sourceTables: of(rows.source_table).sort((a, b) => a.name.localeCompare(b.name)),
    sourceColumns: of(rows.source_column).sort((a, b) => a.source_table_id.localeCompare(b.source_table_id) || a.ordinal - b.ordinal),
    mappings: of(rows.mapping),
    mappingInputs: of(rows.mapping_input).sort((a, b) => a.mapping_id.localeCompare(b.mapping_id) || a.sort_order - b.sort_order),
    attributeInputs: of(rows.attribute_input).sort((a, b) => a.attribute_id.localeCompare(b.attribute_id) || a.sort_order - b.sort_order),
    sourceRelationships: of(rows.source_relationship),
    sourceRelationshipColumns: of(rows.source_relationship_column).sort(
      (a, b) => a.source_relationship_id.localeCompare(b.source_relationship_id) || a.sort_order - b.sort_order,
    ),
    // slice 7c: the list with its removed rows (a removed built-in one can be restored), live links only
    classifications: rows.classification.filter((c) => c.workspace_id === workspaceId),
    classificationLinks: of(rows.classification_link),
    // slice 24: the list with its removed rows (their codes stay taken)
    stereotypes: rows.stereotype.filter((x) => x.workspace_id === workspaceId),
    lostOriginals: lostOriginalsOf(rows, workspaceId),
  };
}

/** Live requirement links whose requirement and element are live too (the domain deletes links with their elements). */
export function liveRequirementLinksOf(rows: Pick<StoredRows, "requirement" | "requirement_link" | "entity" | "attribute" | "mapping" | "source_table" | "source_column">, workspaceId: Uuid): RequirementLink[] {
  const requirements = idsOf(rows.requirement, workspaceId);
  const targets = [idsOf(rows.entity, workspaceId), idsOf(rows.attribute, workspaceId), idsOf(rows.mapping, workspaceId), idsOf(rows.source_table, workspaceId), idsOf(rows.source_column, workspaceId)];
  return live(rows.requirement_link).filter((k) => {
    if (k.workspace_id !== workspaceId || !requirements.has(k.requirement_id)) return false;
    const target = [k.entity_id, k.attribute_id, k.mapping_id, k.source_table_id, k.source_column_id];
    return target.some((id, i) => id !== null && targets[i]!.has(id));
  });
}

/** Links whose project and canvas both still exist. */
export function liveProjectCanvasesOf(rows: Pick<StoredRows, "project" | "canvas" | "project_canvas">, workspaceId: Uuid): ProjectCanvas[] {
  const projects = idsOf(rows.project, workspaceId);
  const canvases = idsOf(rows.canvas, workspaceId);
  return rows.project_canvas.filter((l) => l.workspace_id === workspaceId && projects.has(l.project_id) && canvases.has(l.canvas_id));
}

/**
 * The people a workspace's pages may name (slice 8, F10): its members and everyone with a change event in it, removed
 * people included, so earlier work keeps its author's name. Never anyone else.
 */
export function workspacePeopleOf(rows: Pick<StoredRows, "app_user" | "workspace_member" | "change_event">, workspaceId: Uuid): AppUser[] {
  const ids = new Set(rows.workspace_member.filter((m) => m.workspace_id === workspaceId).map((m) => m.user_id));
  for (const e of rows.change_event) if (e.workspace_id === workspaceId) ids.add(e.user_id);
  return rows.app_user.filter((u) => ids.has(u.id));
}

/** A module's live rows of a workspace, by table. */
export type ModuleRowsOf<T extends ModuleTable> = { readonly [K in T]: readonly WritableRows[K][] };

/**
 * One consistent read of a workspace (slice 25, F1): everything a generated document reads, from one state of the data.
 * The model as `model.load` gives it; the live requirements and their live links; the live projects, their live canvas
 * links in tab order and the live cards; the members and the people the pages may name; the organization; the asked
 * modules' live rows.
 */
export interface WorkspaceSnapshot<T extends ModuleTable = never> {
  readonly workspace: Workspace;
  readonly organization: Organization | null;
  readonly model: WorkspaceModel;
  readonly requirements: readonly Requirement[];
  readonly requirementLinks: readonly RequirementLink[];
  readonly projects: readonly Project[];
  readonly projectCanvases: readonly ProjectCanvas[];
  readonly canvasItems: readonly CanvasItem[];
  readonly members: readonly WorkspaceMember[];
  readonly people: readonly AppUser[];
  readonly modules: ModuleRowsOf<T>;
}

/**
 * The snapshot from stored rows; `modules` are the module tables' rows as the store reads them (its defaults and
 * upgrades applied), any workspace, deleted ones included. Null when the workspace is not live.
 */
export function workspaceSnapshotOf<T extends ModuleTable>(
  rows: StoredRows,
  workspaceId: Uuid,
  modules: { readonly [K in T]: readonly WritableRows[K][] },
): WorkspaceSnapshot<T> | null {
  const workspace = live(rows.workspace).find((w) => w.id === workspaceId);
  if (!workspace) return null;
  const moduleRows = Object.fromEntries(
    Object.entries(modules).map(([table, list]) => [table, ofWorkspace(list as readonly Row[], workspaceId)]),
  ) as unknown as ModuleRowsOf<T>;
  return {
    workspace,
    organization: live(rows.organization).find((o) => o.id === workspace.organization_id) ?? null,
    model: workspaceModelOf(rows, workspaceId),
    requirements: ofWorkspace(rows.requirement, workspaceId),
    requirementLinks: liveRequirementLinksOf(rows, workspaceId),
    projects: ofWorkspace(rows.project, workspaceId),
    projectCanvases: liveProjectCanvasesOf(rows, workspaceId).sort(byTabOrder),
    canvasItems: ofWorkspace(rows.canvas_item, workspaceId),
    members: rows.workspace_member.filter((m) => m.workspace_id === workspaceId),
    people: workspacePeopleOf(rows, workspaceId),
    modules: moduleRows,
  };
}
