// InfoDocumenter's part of InfoCatalog (slice 39, C4 as answered): the documents that include an item, by the
// document's scope as its sections read it (`sectionScopeOf`), only those the reader sees in InfoMapper (`canSee`: a
// shared one or their own, never another's private one), none for a reader without a role in the workspace and none
// while InfoDocumenter is off there. A document from a baseline shows that baseline's state, not the live item's, so
// only documents from the live model count. Pure; joined by `src/compose/catalog.ts`.

import type { CatalogContribution, CatalogDocument, CatalogViewer } from "@/domain/catalog/contribution";
import type { CatalogItem } from "@/domain/catalog/items";
import { statusShown } from "@/domain/document/blocks";
import type { SectionScope } from "@/domain/document/sections";
import type { DocumentState } from "@/domain/document/state";
import type { ModuleTable } from "@/domain/types";
import { drawnLevel, touchesScope } from "./parts";
import { canSee } from "./rights";
import { sectionScopeOf } from "./scope";
import type { DocumentDefinition } from "./types";

type Status = "draft" | "review" | "approved";

/** Whether a document's scope holds the item. */
export function scopeIncludes(state: DocumentState<ModuleTable>, scope: SectionScope, item: CatalogItem): boolean {
  if (item.kind === "requirement") return touchesScope(state, scope, { id: item.id }, true);
  const drawn = item.anchors.entities.some((id) => {
    const e = state.entity.get(id);
    return !!e && scope.entityIds.has(id) && drawnLevel(state, scope, e);
  });
  if (item.kind === "mapping" || item.kind === "cube_mapping") {
    const status = item.marks.find((m) => m.t === "status");
    return drawn && (!status || statusShown(scope.mappings, (status as { status: Status }).status));
  }
  return drawn || item.anchors.tables.some((id) => scope.tableIds.has(id));
}

export function documentsIncluding(state: DocumentState<ModuleTable>, item: CatalogItem, viewer: CatalogViewer): CatalogDocument[] {
  const snapshot = state.snapshot;
  if (!snapshot.workspace.infodoc || !viewer.member || viewer.member.user_id !== viewer.userId) return [];
  const access = { workspace: snapshot.workspace, member: viewer.member };
  const documents = (snapshot.modules as unknown as { document_definition?: readonly DocumentDefinition[] }).document_definition ?? [];
  return documents
    .filter((d) => d.source_kind === "live" && canSee(access, d) && scopeIncludes(state, sectionScopeOf(d.scope, snapshot), item))
    .map((d) => ({ id: d.id, name: d.name, shared: d.shared }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1));
}

export const DOCUMENTS_CATALOG: CatalogContribution = {
  module: "infodocumenter",
  tables: ["document_definition"],
  documentsIncluding,
};
