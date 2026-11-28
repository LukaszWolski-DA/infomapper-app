// InfoCatalog's composition (slice 39, AD-33's new extension point, Q3 as answered): the modules' contributions
// (`CatalogContribution`), joined here and applied after the port's read (`store.catalog.read`), so neither the data
// layer nor InfoCatalog names a module. InfoCube gives its kinds; InfoDocumenter the documents that include an item.

import type { CatalogContribution, CatalogDocument, CatalogViewer } from "@/domain/catalog/contribution";
import { CORE_TABS, coreCatalogItems, type CatalogItem, type CatalogTab } from "@/domain/catalog/items";
import type { CatalogRead } from "@/domain/catalog/read";
import type { WorkspaceSnapshot } from "@/domain/model/workspace-model";
import type { ModuleTable } from "@/domain/types";
import { catalogIndex, searchCatalog, type CatalogAnswer, type CatalogIndex } from "@/modules/infocatalog/domain/search";
import { CUBE_CATALOG } from "@/modules/infocube/domain/catalog";
import { DOCUMENTS_CATALOG } from "@/modules/infodocumenter/domain/catalog";
import { getDataStore } from "@/data";
import type { Uuid } from "@/domain/ids";
import type { CatalogOrganization } from "@/domain/permissions";
import { documentStateFor } from "./documents";
import { STORE_SCHEMA } from "./tables";

export const CATALOG_CONTRIBUTIONS: readonly CatalogContribution[] = [CUBE_CATALOG, DOCUMENTS_CATALOG];

/** The module tables a catalog read takes (the contributions' and what a document's state reads). */
export const CATALOG_TABLES: readonly ModuleTable[] = [...new Set(CATALOG_CONTRIBUTIONS.flatMap((c) => c.tables))];

/** The tabs after "All": InfoMapper's, then the modules' in the contributions' order. */
export const CATALOG_TABS: readonly CatalogTab[] = [...CORE_TABS, ...CATALOG_CONTRIBUTIONS.flatMap((c) => c.tabs ?? [])];

/** Every item of one workspace: InfoMapper's kinds, then each module's. */
export const workspaceCatalogItems = (snapshot: WorkspaceSnapshot<ModuleTable>): CatalogItem[] => [
  ...coreCatalogItems(snapshot),
  ...CATALOG_CONTRIBUTIONS.flatMap((c) => c.items?.(snapshot) ?? []),
];

/** The index of a read: its workspaces' items, in the scope's order. */
export function catalogIndexOf(read: CatalogRead<ModuleTable>): CatalogIndex {
  return catalogIndex(read.snapshots.flatMap(workspaceCatalogItems), CATALOG_TABS, read.snapshots.map((s) => s.workspace.id));
}

/** A search of a read (C1: on the server, the first 200 and the counts). */
export const catalogSearch = (read: CatalogRead<ModuleTable>, query: string, tab?: string): CatalogAnswer => searchCatalog(catalogIndexOf(read), query, tab);

/** The documents that include an item, as the viewer sees them in InfoMapper (C4); the document state is built once. */
export function catalogDocuments(snapshot: WorkspaceSnapshot<ModuleTable>, item: CatalogItem, viewer: CatalogViewer): CatalogDocument[] {
  const givers = CATALOG_CONTRIBUTIONS.filter((c) => c.documentsIncluding);
  if (!givers.length || !viewer.member) return [];
  const state = documentStateFor(snapshot);
  return givers.flatMap((c) => c.documentsIncluding!(state, item, viewer));
}

/** The licensed organizations whose catalog the person reads (none: no landing zone, no catalog, no "All apps"). */
export const catalogReadableFor = (userId: Uuid, unlocked: ReadonlySet<Uuid>): Promise<CatalogOrganization[]> => getDataStore(STORE_SCHEMA).catalog.readable(userId, unlocked);

const SHOWN_KINDS = new Set(CATALOG_TABS.flatMap((t) => t.kinds));

/** How many items a read holds (the kinds the tabs show), for the landing tile's count. */
export const catalogItemCount = (read: CatalogRead<ModuleTable> | null): number =>
  read ? read.snapshots.reduce((n, s) => n + workspaceCatalogItems(s).filter((i) => SHOWN_KINDS.has(i.kind)).length, 0) : 0;
