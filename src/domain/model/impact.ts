// Deleting an entity (D-47): what goes with it, and the impact the dialog shows before anything is deleted.

import type { Uuid } from "../ids";
import type { Attribute, Canvas, CanvasItem, Entity, Mapping, MappingInput, Project, ProjectCanvas, Relationship } from "../types";

/** The live rows around one entity, as loaded by the caller. Rows that do not belong to the entity are ignored. */
export interface EntityRows {
  entity: Entity;
  attributes: readonly Attribute[];
  mappings: readonly Mapping[];
  mappingInputs: readonly MappingInput[];
  relationships: readonly Relationship[];
  canvasItems: readonly CanvasItem[];
}

export interface EntityCascade {
  attributes: Attribute[];
  mappings: Mapping[];
  mappingInputs: MappingInput[];
  relationships: Relationship[];
  canvasItems: CanvasItem[];
}

const live = <R extends { deleted_at: string | null }>(rows: readonly R[]): R[] => rows.filter((r) => r.deleted_at === null);

/** Everything that is soft-deleted together with the entity, in one change group. */
export function entityCascade(rows: EntityRows): EntityCascade {
  const id = rows.entity.id;
  const attributes = live(rows.attributes).filter((a) => a.entity_id === id);
  const attributeIds = new Set(attributes.map((a) => a.id));
  const mappings = live(rows.mappings).filter((m) => attributeIds.has(m.attribute_id));
  const mappingIds = new Set(mappings.map((m) => m.id));
  return {
    attributes,
    mappings,
    mappingInputs: live(rows.mappingInputs).filter((i) => mappingIds.has(i.mapping_id)),
    relationships: live(rows.relationships).filter((r) => r.from_entity_id === id || r.to_entity_id === id),
    canvasItems: live(rows.canvasItems).filter((c) => c.entity_id === id),
  };
}

export interface EntityImpact {
  attributes: number;
  mappings: number;
  approvedMappings: number;
  relationships: number;
  /** Canvases the entity is on, by name. */
  canvases: { id: Uuid; name: string }[];
  /** Projects holding one of those canvases, by name. */
  projects: { id: Uuid; name: string }[];
}

/** The impact dialog's numbers: attributes, mappings (approved among them), relationships, canvases and projects. */
export function entityImpact(
  rows: EntityRows,
  context: { canvases: readonly Canvas[]; projects: readonly Project[]; projectCanvases: readonly ProjectCanvas[] },
): EntityImpact {
  const cascade = entityCascade(rows);
  const canvasIds = new Set(cascade.canvasItems.map((c) => c.canvas_id));
  const canvases = live(context.canvases).filter((c) => canvasIds.has(c.id));
  const projectIds = new Set(context.projectCanvases.filter((l) => canvasIds.has(l.canvas_id)).map((l) => l.project_id));
  const projects = live(context.projects).filter((p) => projectIds.has(p.id));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  return {
    attributes: cascade.attributes.length,
    mappings: cascade.mappings.length,
    approvedMappings: cascade.mappings.filter((m) => m.status === "approved").length,
    relationships: cascade.relationships.length,
    canvases: canvases.map(({ id, name }) => ({ id, name })).sort(byName),
    projects: projects.map(({ id, name }) => ({ id, name })).sort(byName),
  };
}
