// InfoCatalog's read, shared by both adapters (slice 39, C1): from the rows an adapter read for the readable workspaces
// in scope to the answer, by the domain's rules only, so the two adapters answer the same (tests/contract/catalog.test.ts).

import { scopeWorkspaces, type CatalogRead, type CatalogScope } from "@/domain/catalog/read";
import type { Uuid } from "@/domain/ids";
import { workspaceSnapshotOf, type StoredRows, type WorkspaceSnapshot } from "@/domain/model/workspace-model";
import type { CatalogOrganization } from "@/domain/permissions";
import type { ModuleTable, WritableRows } from "@/domain/types";
import { CORE_SCHEMA } from "./local/schema";
import type { AnyRow } from "./rows";

type Rows = Readonly<Record<string, readonly AnyRow[]>>;

/**
 * The snapshots of the scope's readable workspaces from rows that hold (at least) those workspaces' catalog tables,
 * their `workspace` and `organization` rows and their members' `app_user` rows. Every other InfoMapper table reads as
 * empty, so a snapshot carries no frames, labels or change events (and names only the members). Null when the person
 * may not read the scope.
 */
export function catalogReadOf<T extends ModuleTable>(
  rows: Rows,
  readable: readonly CatalogOrganization[],
  scope: CatalogScope,
  modules: { readonly [K in T]: readonly WritableRows[K][] },
): CatalogRead<T> | null {
  const found = scopeWorkspaces(readable, scope);
  if (!found) return null;
  const stored: Record<string, readonly AnyRow[]> = {};
  for (const table of Object.keys(CORE_SCHEMA.rules)) stored[table] = rows[table] ?? [];
  stored.change_event = [];
  const snapshots = found.ids
    .map((id: Uuid) => workspaceSnapshotOf(stored as unknown as StoredRows, id, modules))
    .filter((s): s is WorkspaceSnapshot<T> => s !== null);
  return { organization: found.organization, snapshots };
}
