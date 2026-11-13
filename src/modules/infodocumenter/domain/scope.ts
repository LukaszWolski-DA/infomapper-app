// A document's scope as its sections read it (slice 25, PRD section 2, F7, F23): the entities of the chosen projects'
// canvases (the project home's rule, `projectScope`), narrowed to the chosen concepts, both levels; the levels and the
// mapping filter as chosen. Ids of projects or concepts deleted since are kept in the recipe and ignored here (F7): a
// choice whose every id is gone reads as no choice.
//
// Slice 26 (F13): the source tables in scope, shared by Source tables, the classification register and Conventions'
// types: the prototype's `scopeOf` rule (below).

import { statusShown } from "@/domain/document/blocks";
import type { SectionScope } from "@/domain/document/sections";
import type { Uuid } from "@/domain/ids";
import { projectScope } from "@/domain/model/checks";
import type { WorkspaceSnapshot } from "@/domain/model/workspace-model";
import type { ModuleTable } from "@/domain/types";
import type { DocumentScope } from "./types";

export function sectionScopeOf(scope: DocumentScope, snapshot: WorkspaceSnapshot<ModuleTable>): SectionScope {
  const model = snapshot.model;
  const projects = new Set(snapshot.projects.map((p) => p.id).filter((id) => scope.projects.includes(id)));
  const concepts = new Set(model.concepts.map((c) => c.id).filter((id) => scope.concepts.includes(id)));
  // the scope's canvases: the chosen projects', or every canvas of a live project
  const canvases = new Set(snapshot.projectCanvases.filter((l) => !projects.size || projects.has(l.project_id)).map((l) => l.canvas_id));
  let entities: readonly { id: Uuid; concept_id: Uuid }[] = model.entities;
  if (projects.size) {
    const onCanvases = projectScope(snapshot.canvasItems, [...canvases]);
    entities = entities.filter((e) => onCanvases.has(e.id));
  }
  if (concepts.size) entities = entities.filter((e) => concepts.has(e.concept_id));
  const entityIds = new Set(entities.map((e) => e.id));
  return { entityIds, tableIds: sourceTablesInScope(snapshot, entityIds, canvases, { projects: projects.size > 0, concepts: concepts.size > 0, mappings: scope.mappings }), logical: scope.logical, dimensional: scope.dimensional, mappings: scope.mappings };
}

/**
 * The source tables in scope (F13, the prototype's `scopeOf`): every table with a column that a shown mapping (the
 * document's mapping filter) reads into an attribute of an entity in scope; with no concept chosen, also every table
 * with a card on the scope's canvases; with neither a project nor a concept chosen, every live table. Pure.
 */
export function sourceTablesInScope(
  snapshot: Pick<WorkspaceSnapshot<ModuleTable>, "model" | "canvasItems">,
  entityIds: ReadonlySet<Uuid>,
  canvases: ReadonlySet<Uuid>,
  chosen: { projects: boolean; concepts: boolean; mappings: SectionScope["mappings"] },
): Set<Uuid> {
  const model = snapshot.model;
  const live = new Set(model.sourceTables.map((t) => t.id));
  if (!chosen.projects && !chosen.concepts) return live;
  const out = new Set<Uuid>();
  const entityOf = new Map(model.attributes.map((a) => [a.id, a.entity_id]));
  const tableOf = new Map(model.sourceColumns.map((c) => [c.id, c.source_table_id]));
  const shown = new Set(model.mappings.filter((m) => entityIds.has(entityOf.get(m.attribute_id) ?? "") && statusShown(chosen.mappings, m.status)).map((m) => m.id));
  for (const i of model.mappingInputs) {
    if (!shown.has(i.mapping_id)) continue;
    const t = tableOf.get(i.source_column_id);
    if (t && live.has(t)) out.add(t);
  }
  if (!chosen.concepts)
    for (const item of snapshot.canvasItems) if (item.source_table_id && canvases.has(item.canvas_id) && live.has(item.source_table_id) && item.deleted_at === null) out.add(item.source_table_id);
  return out;
}
