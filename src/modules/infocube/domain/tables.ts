// How undo treats InfoCube's tables (slice 15a, AD-33, E1; `cube_key` since slice 15b, the dimensional mappings since 15c): all are in the undo history, so deleting an entity or an
// attribute together with its InfoCube rows is one step that one undo brings back (X-4).

import { statusOnlyEvent, type ModuleRevertRefusal, type ModuleTableClass } from "@/domain/commands/undo";
import { AGGREGATE_TEXTS, aggregateIndex } from "./aggregates";
import type { CubeEntity, InfoCubeTable } from "./types";

/** An aggregate whose base's entity is deleted (slice 19, F7): its base is cleared in the same change group. */
export const aggregateLosesBase = (): Readonly<Record<string, unknown>> => ({ base_fact_entity_id: null });

/**
 * Slice 19 (F6): a revert that leaves a live fact an aggregate of itself (at any depth, made by someone else meanwhile)
 * or of a fact that is deleted, is refused.
 */
export const aggregateRevertRefusal: ModuleRevertRefusal = (rows, touched) => {
  const cubes = [...(rows.get("cube_entity")?.values() ?? [])] as unknown as CubeEntity[];
  const entities = rows.get("entity");
  const name = (id: string) => (entities?.get(id)?.name as string | undefined) ?? "a fact";
  const liveFact = new Set(cubes.filter((c) => c.deleted_at === null && c.role === "fact" && entities?.get(c.entity_id)?.deleted_at == null).map((c) => c.entity_id));
  const index = aggregateIndex(cubes);
  for (const t of touched) {
    if (t.table !== "cube_entity") continue;
    const c = rows.get("cube_entity")?.get(t.key) as unknown as CubeEntity | undefined;
    if (!c || c.deleted_at !== null || c.role !== "fact" || !c.base_fact_entity_id) continue;
    if (c.base_fact_entity_id === c.entity_id || index.reaches(c.entity_id, c.entity_id)) return AGGREGATE_TEXTS.undoSelf(name(c.entity_id));
    if (!liveFact.has(c.base_fact_entity_id)) return AGGREGATE_TEXTS.undoDeleted(name(c.entity_id));
  }
  return null;
};

/** A lookup whose relationship is deleted (slice 18, F16): an approved one goes back to review; any other is left. */
export const lookupLosesRelationship = (row: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | null =>
  row.kind === "lookup" && row.status === "approved" ? { status: "review", approved_by: null, approved_at: null } : null;

export const INFOCUBE_UNDO: Readonly<Record<InfoCubeTable, ModuleTableClass>> = {
  cube_entity: {
    parents: [["entity_id", "entity"]],
    noun: "fact or dimension",
    // slice 19 (F7): an aggregate outlives its base; the base's delete clears it in the same change group
    follows: [["base_fact_entity_id", "entity", aggregateLosesBase]],
    revertRefusal: aggregateRevertRefusal,
  },
  cube_measure: { parents: [["attribute_id", "attribute"]], noun: "measure" },
  // slice 15b (RP-B): a key link goes with its relationship or its attribute, in the same change group
  cube_key: { parents: [["relationship_id", "relationship"], ["attribute_id", "attribute"]], noun: "key link" },
  // slice 15c (M1, Q-5): a dimensional mapping goes with its target, and whole when one of its inputs goes with its
  // logical attribute; a reviewer undoes their own status change, as on InfoMapper's mappings (O9)
  cube_mapping: {
    parents: [["attribute_id", "attribute"]],
    noun: "dimensional mapping",
    // slice 18: an image written before lookups had no lookup
    defaults: { lookup_relationship_id: null, lookup_default: null },
    // slice 18 (F15, F16): a lookup outlives its relationship and keeps its id, so its panel can say it is gone; an
    // approved one goes back to review in the same change group. Not a parent: undo brings either back alone.
    follows: [["lookup_relationship_id", "relationship", lookupLosesRelationship]],
    goesWhole: [["cube_mapping_input", "mapping_id", "attribute_id"]],
    action: (e) => (statusOnlyEvent(e) ? "mapping.set_status" : "model.edit"),
  },
  cube_mapping_input: { parents: [["mapping_id", "cube_mapping"], ["attribute_id", "attribute"]], noun: "dimensional mapping input" },
};
