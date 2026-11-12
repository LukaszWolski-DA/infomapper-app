// A document's scope as its sections read it (slice 25, PRD section 2, F7, F23): the entities of the chosen projects'
// canvases (the project home's rule, `projectScope`), narrowed to the chosen concepts, both levels; the levels and the
// mapping filter as chosen. Ids of projects or concepts deleted since are kept in the recipe and ignored here (F7): a
// choice whose every id is gone reads as no choice.

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
  let entities: readonly { id: Uuid; concept_id: Uuid }[] = model.entities;
  if (projects.size) {
    const canvases = snapshot.projectCanvases.filter((l) => projects.has(l.project_id)).map((l) => l.canvas_id);
    const onCanvases = projectScope(snapshot.canvasItems, canvases);
    entities = entities.filter((e) => onCanvases.has(e.id));
  }
  if (concepts.size) entities = entities.filter((e) => concepts.has(e.concept_id));
  return { entityIds: new Set(entities.map((e) => e.id)), logical: scope.logical, dimensional: scope.dimensional, mappings: scope.mappings };
}
