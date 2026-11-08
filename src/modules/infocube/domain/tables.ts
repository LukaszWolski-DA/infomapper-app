// How undo treats InfoCube's tables (slice 15a, AD-33, E1; `cube_key` since slice 15b, the dimensional mappings since 15c): all are in the undo history, so deleting an entity or an
// attribute together with its InfoCube rows is one step that one undo brings back (X-4).

import { statusOnlyEvent, type ModuleTableClass } from "@/domain/commands/undo";
import type { InfoCubeTable } from "./types";

export const INFOCUBE_UNDO: Readonly<Record<InfoCubeTable, ModuleTableClass>> = {
  cube_entity: { parents: [["entity_id", "entity"]], noun: "fact or dimension" },
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
    goesWhole: [["cube_mapping_input", "mapping_id", "attribute_id"]],
    action: (e) => (statusOnlyEvent(e) ? "mapping.set_status" : "model.edit"),
  },
  cube_mapping_input: { parents: [["mapping_id", "cube_mapping"], ["attribute_id", "attribute"]], noun: "dimensional mapping input" },
};
