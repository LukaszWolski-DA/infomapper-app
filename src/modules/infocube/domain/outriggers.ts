// Outriggers (slice 19, D-74; prototype `cubeIndex`'s `outOf` and `outs`): a dimension referenced by another dimension.
// Derived, never stored: in a live relationship between two different dimensions, the "one" end is an outrigger of the
// other; with 1:1 the relationship's `from` end; many-to-many gives none (a bridge, left for later; Łukasz, step 1). A
// relationship's minimums and roles do not matter. Pure.

import type { Uuid } from "@/domain/ids";
import type { Relationship } from "@/domain/types";
import type { CubeRole } from "./types";

export interface Outriggers {
  /** The dimensions this outrigger belongs to (the other ends). */
  outOf(dimensionId: Uuid): readonly Uuid[];
  /** The outriggers of this dimension. */
  outs(dimensionId: Uuid): readonly Uuid[];
}

type Rel = Pick<Relationship, "from_entity_id" | "to_entity_id" | "from_max" | "to_max" | "deleted_at">;

/** The "one" end of a relationship between two dimensions, or null (many-to-many). */
export function outriggerEnd(r: Rel): Uuid | null {
  if (r.from_max === "1") return r.from_entity_id;
  if (r.to_max === "1") return r.to_entity_id;
  return null;
}

export function outriggers(relationships: readonly Rel[], roleOf: (entityId: Uuid) => CubeRole | undefined): Outriggers {
  const outOf = new Map<Uuid, Uuid[]>();
  const outs = new Map<Uuid, Uuid[]>();
  const add = (m: Map<Uuid, Uuid[]>, k: Uuid, v: Uuid) => {
    const list = m.get(k) ?? m.set(k, []).get(k)!;
    if (!list.includes(v)) list.push(v);
  };
  for (const r of relationships) {
    if (r.deleted_at !== null || r.from_entity_id === r.to_entity_id) continue;
    if (roleOf(r.from_entity_id) !== "dimension" || roleOf(r.to_entity_id) !== "dimension") continue;
    const one = outriggerEnd(r);
    if (!one) continue;
    const many = one === r.from_entity_id ? r.to_entity_id : r.from_entity_id;
    add(outOf, one, many);
    add(outs, many, one);
  }
  return { outOf: (id) => outOf.get(id) ?? [], outs: (id) => outs.get(id) ?? [] };
}
