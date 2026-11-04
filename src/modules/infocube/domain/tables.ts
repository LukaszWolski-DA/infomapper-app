// How undo treats InfoCube's tables (slice 15a, AD-33, E1): both are in the undo history, so deleting an entity or an
// attribute together with its InfoCube rows is one step that one undo brings back (X-4).

import type { ModuleTableClass } from "@/domain/commands/undo";
import type { InfoCubeTable } from "./types";

export const INFOCUBE_UNDO: Readonly<Record<InfoCubeTable, ModuleTableClass>> = {
  cube_entity: { parents: [["entity_id", "entity"]], noun: "fact or dimension" },
  cube_measure: { parents: [["attribute_id", "attribute"]], noun: "measure" },
};
