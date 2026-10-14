// Deleting an entity (D-47): what goes with it, and the impact the dialog shows before anything is deleted.

import type { Uuid } from "../ids";
import type { Attribute, Canvas, CanvasItem, Entity, Mapping, MappingInput, Project, ProjectCanvas, Relationship } from "../types";
import type { RequirementIndex } from "./requirement-index";

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
  /** Requirements whose scope contains the entity, by key (slice 4a: they lose it from their scope). */
  requirements: { id: Uuid; key: string }[];
}

/**
 * The impact dialog's numbers: attributes, mappings (approved among them), relationships, canvases, projects and the
 * requirements whose scope contains the entity (prototype `entityImpact`, slice 4a).
 */
export function entityImpact(
  rows: EntityRows,
  context: { canvases: readonly Canvas[]; projects: readonly Project[]; projectCanvases: readonly ProjectCanvas[]; requirements?: RequirementIndex },
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
    requirements: (context.requirements?.requirements ?? [])
      .filter((r) => context.requirements!.scope(r.id).entities.has(rows.entity.id))
      .map(({ id, key }) => ({ id, key }))
      .sort((a, b) => a.key.localeCompare(b.key, "en", { numeric: true })),
  };
}

/** At most this many keys are named in the delete dialog's requirements row; the rest are counted. */
export const IMPACT_KEYS_SHOWN = 5;

/**
 * The delete dialog's requirements row (slice 4a, Łukasz after step 3): “4 requirements” — “lose it from their scope:
 * REQ-101, REQ-102, REQ-103, REQ-105”; one: “1 requirement” — “loses it from its scope: REQ-104”; more than five: the
 * first five keys, then “and 3 more”; none: “0 requirements” — “–”.
 */
export function requirementsImpactRow(keys: readonly string[]): [what: string, happens: string] {
  const n = keys.length;
  const what = `${n} requirement${n === 1 ? "" : "s"}`;
  if (!n) return [what, "–"];
  const named = keys.slice(0, IMPACT_KEYS_SHOWN).join(", ");
  const rest = n > IMPACT_KEYS_SHOWN ? ` and ${n - IMPACT_KEYS_SHOWN} more` : "";
  return [what, n === 1 ? `loses it from its scope: ${named}` : `lose it from their scope: ${named}${rest}`];
}
