// The modules' rules that InfoMapper's commands take as arguments (slice 15a, AD-33): `src/app` reads them here and
// hands them to the domain, which never imports a module.

import type { DataStore } from "@/data";
import type { Uuid } from "@/domain/ids";
import { dimensionEnd } from "@/modules/infocube/domain/commands";

/**
 * The entity a new relationship between `a` and `b` must start at, its 1..1 end (E9, D-67): between a fact and a
 * dimension the dimension; null otherwise. Reads InfoCube's roles only.
 */
export async function relationshipOneEnd(store: DataStore, workspaceId: Uuid, a: Uuid, b: Uuid): Promise<Uuid | null> {
  return dimensionEnd(await store.modules.list(workspaceId, "cube_entity"), a, b);
}
