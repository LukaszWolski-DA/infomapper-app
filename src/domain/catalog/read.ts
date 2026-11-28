// What InfoCatalog's read takes from the data (slice 39, C1 as answered): the tables, the scope and the result. Both
// adapters read the same tables of the readable workspaces in scope, in one consistent read, and hand them to the
// domain's own rules (`catalogReadable`, `workspaceSnapshotOf`), so their answers are equal (the contract test).

import type { Uuid } from "../ids";
import type { WorkspaceSnapshot } from "../model/workspace-model";
import type { CatalogOrganization } from "../permissions";
import type { ModuleTable } from "../types";

/**
 * InfoMapper's tables a catalog read takes per workspace (by `workspace_id`): the model's (as `model.load`), the
 * requirements, the projects, canvases and cards (where an item is shown), the members (the owners' names). Never
 * frames, labels, notes or change events: the catalog shows none of them.
 */
export const CATALOG_WORKSPACE_TABLES = [
  "concept",
  "entity",
  "attribute",
  "attribute_input",
  "relationship",
  "source_system",
  "source_table",
  "source_column",
  "source_relationship",
  "source_relationship_column",
  "classification",
  "classification_link",
  "stereotype",
  "mapping",
  "mapping_input",
  "requirement",
  "requirement_link",
  "project",
  "canvas",
  "project_canvas",
  "canvas_item",
  "workspace_member",
] as const;

/**
 * Read with their deleted rows, as `snapshot` reads them: the lost originals, removed classifications and stereotypes,
 * and the two tables without `deleted_at` (a project's canvas links, the members).
 */
export const CATALOG_WITH_DELETED: ReadonlySet<string> = new Set(["entity", "attribute", "classification", "stereotype", "project_canvas", "workspace_member"]);

/** Where a search looks: an organization's readable workspaces, or one of them. */
export interface CatalogScope {
  readonly organizationId: Uuid;
  readonly workspaceId: Uuid | null;
}

/** One read of a scope: the organization as the person reads it, and a snapshot per readable workspace in scope, in its order. */
export interface CatalogRead<T extends ModuleTable = never> {
  readonly organization: CatalogOrganization;
  readonly snapshots: readonly WorkspaceSnapshot<T>[];
}

/** The workspaces a scope reads, or null when the person may not read it (an organization or a workspace they do not read). */
export function scopeWorkspaces(readable: readonly CatalogOrganization[], scope: CatalogScope): { organization: CatalogOrganization; ids: Uuid[] } | null {
  const organization = readable.find((o) => o.id === scope.organizationId);
  if (!organization) return null;
  if (scope.workspaceId === null) return { organization, ids: organization.workspaces.map((w) => w.id) };
  return organization.workspaces.some((w) => w.id === scope.workspaceId) ? { organization, ids: [scope.workspaceId] } : null;
}
