// InfoCatalog's composition (slice 39, AD-33's new extension point, Q3 as answered): the modules' contributions
// (`CatalogContribution`), joined here and applied after the port's read (`store.catalog.read`), so neither the data
// layer nor InfoCatalog names a module. InfoCube gives its kinds; InfoDocumenter the documents that include an item.

import { canvasesShowing } from "@/domain/catalog/canvases";
import type { CatalogContribution, CatalogDocument, CatalogViewer } from "@/domain/catalog/contribution";
import { coreCatalogDetails, type CatalogDetails, type DetailsInput } from "@/domain/catalog/details";
import { CORE_TABS, coreCatalogItems, type CatalogItem, type CatalogTab } from "@/domain/catalog/items";
import type { CatalogRead } from "@/domain/catalog/read";
import type { WorkspaceSnapshot } from "@/domain/model/workspace-model";
import type { ModuleTable } from "@/domain/types";
import { ALL_TAB, catalogIndex, searchCatalog, type CatalogAnswer, type CatalogIndex } from "@/modules/infocatalog/domain/search";
import { catalogView, markText, shownTabs, type CatalogState, type CatalogView } from "@/modules/infocatalog/domain/view";
import { OFF_CANVAS, offCanvasText, parseItemRef, type CatalogItemView } from "@/modules/infocatalog/domain/item";
import { CUBE_CATALOG } from "@/modules/infocube/domain/catalog";
import { DOCUMENTS_CATALOG } from "@/modules/infodocumenter/domain/catalog";
import { getDataStore } from "@/data";
import type { Uuid } from "@/domain/ids";
import type { CatalogOrganization, CatalogWorkspace } from "@/domain/permissions";
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

/** Every tab with where it shows: InfoMapper's always, a module's where it is on (its contribution's `on`). */
const TAB_SOURCES: readonly (CatalogTab & { on?: (w: CatalogWorkspace) => boolean })[] = [
  ...CORE_TABS,
  ...CATALOG_CONTRIBUTIONS.flatMap((c) => (c.tabs ?? []).map((t) => ({ ...t, on: c.on }))),
];

/**
 * A search page's view of a state (S39-03, C1): the organization and the scope as the person reads them, the tabs shown
 * there, one catalog read and the search; null when the person may not read the organization or the workspace (the page
 * answers "not found"). A tab that is not shown in the scope reads as "All".
 */
export async function catalogSearchView(userId: Uuid, unlocked: ReadonlySet<Uuid>, readable: readonly CatalogOrganization[], asked: CatalogState): Promise<CatalogView | null> {
  const organization = readable.find((o) => o.id === asked.org);
  if (!organization) return null;
  const scope = asked.scope ? organization.workspaces.filter((w) => w.id === asked.scope) : organization.workspaces;
  if (asked.scope && !scope.length) return null;
  const tabs = shownTabs(TAB_SOURCES, scope);
  const state: CatalogState = { ...asked, kind: asked.kind === ALL_TAB || tabs.some((t) => t.key === asked.kind) ? asked.kind : ALL_TAB };
  const read = scope.length
    ? await getDataStore(STORE_SCHEMA).catalog.read(userId, unlocked, { organizationId: organization.id, workspaceId: asked.scope }, CATALOG_TABLES)
    : { organization, snapshots: [] };
  if (!read) return null;
  const index = catalogIndex(read.snapshots.flatMap(workspaceCatalogItems), tabs, read.snapshots.map((s) => s.workspace.id));
  return catalogView(state, searchCatalog(index, state.q, state.kind), tabs, scope);
}

/** An item's details: InfoMapper's kinds, else the module whose kind it is. */
function detailsOf(snapshot: WorkspaceSnapshot<ModuleTable>, item: CatalogItem, input: DetailsInput): CatalogDetails | null {
  return coreCatalogDetails(snapshot, item, input) ?? CATALOG_CONTRIBUTIONS.map((c) => c.details?.(snapshot, item, input) ?? null).find((d) => d !== null) ?? null;
}

/**
 * One item's drawer (S39-04, S39-05): read with its workspace's scope (the rights inside the port), its details, where
 * it is shown, the documents that include it as the reader sees them (C4), the owners. Null, the page's "not found",
 * for an item the person may not read or that does not exist; never another answer that would say it exists.
 */
export async function catalogItemView(userId: Uuid, unlocked: ReadonlySet<Uuid>, readable: readonly CatalogOrganization[], org: Uuid, refText: string): Promise<CatalogItemView | null> {
  const ref = parseItemRef(refText);
  const organization = readable.find((o) => o.id === org);
  const workspace = ref && organization?.workspaces.find((w) => w.id === ref.workspaceId);
  if (!ref || !organization || !workspace) return null;
  const store = getDataStore(STORE_SCHEMA);
  const read = await store.catalog.read(userId, unlocked, { organizationId: organization.id, workspaceId: workspace.id }, CATALOG_TABLES);
  const snapshot = read?.snapshots[0];
  if (!snapshot) return null;
  const items = new Map(workspaceCatalogItems(snapshot).filter((i) => SHOWN_KINDS.has(i.kind)).map((i) => [`${i.kind}:${i.id}`, i]));
  const item = items.get(`${ref.kind}:${ref.id}`);
  if (!item) return null;
  // a table's details name its system's last import (step 1, § 7): one more read, after the rights
  const lastImports: Record<Uuid, string> = {};
  if (item.kind === "source_table") {
    const table = snapshot.model.sourceTables.find((t) => t.id === item.id);
    const last = table ? (await store.model.listImports(workspace.id, table.source_system_id))[0] : undefined;
    if (last && table) lastImports[table.source_system_id] = last.created_at;
  }
  const details = detailsOf(snapshot, item, { item: (kind, id) => items.get(`${kind}:${id}`), lastImports });
  if (!details) return null;
  const member = snapshot.members.find((m) => m.user_id === userId) ?? null;
  const names = new Map(snapshot.people.map((p) => [p.id, p.display_name]));
  return {
    ref: refText,
    kind: item.kind,
    kindLabel: item.kindLabel,
    id: item.id,
    workspaceId: workspace.id,
    name: item.name,
    path: item.path,
    workspace: { name: workspace.name, archived: workspace.archived, hasRole: workspace.hasRole },
    marks: [...item.marks.map(markText), ...(workspace.archived ? [{ text: "Archived", tone: "plain" as const }] : [])],
    details,
    canvases: canvasesShowing(snapshot, item),
    documents: catalogDocuments(snapshot, item, { userId, member }),
    owners: snapshot.members.filter((m) => m.role === "owner").map((m) => names.get(m.user_id) ?? "someone").sort((a, b) => a.localeCompare(b, "en")),
    homeTab: item.open && "tab" in item.open ? item.open.tab : null,
  };
}

/**
 * What a workspace's home says when "Open in InfoMapper" found the item on no canvas (S39-05, Q9: `?gone=off-canvas&item=
 * {kind}:{id}`, the name read here, never carried in the address); null when the item is not there.
 */
export async function offCanvasNotice(workspaceId: Uuid, ref: string): Promise<string | null> {
  const at = ref.indexOf(":");
  if (at < 1) return null;
  const snapshot = await getDataStore(STORE_SCHEMA).snapshot(workspaceId, CATALOG_TABLES);
  const item = snapshot && workspaceCatalogItems(snapshot).find((i) => i.kind === ref.slice(0, at) && i.id === ref.slice(at + 1));
  return item ? offCanvasText(item.name) : null;
}

// slice 39: what `src/app`'s catalog route reads of InfoCatalog (the address and the view), through the composition root
export { addressOf, stateOf } from "@/modules/infocatalog/domain/address";
export { OFF_CANVAS };
export type { CatalogItemView, CatalogState, CatalogView };
