// InfoCube's tables in the local data file and the rules the database would enforce on them (slice 15a, AD-33),
// mirroring supabase/migrations/20261104100100_infocube_entities.sql and (slice 15b, `cube_key`)
// 20261104110100_infocube_keys.sql. Registered with the store by `src/compose/`.

import { model, oneOf, type AnyRow, type TableRules } from "@/data/local/schema";
import { ADDITIVITIES, CUBE_ROLES, SCD_TYPES, type CubeEntity, type CubeKey, type CubeMeasure, type InfoCubeTable } from "../domain/types";

/** InfoCube's tables in the file, absent until its first row (the AD-31 schema check reads this interface). */
export interface InfoCubeDb {
  cube_entity: CubeEntity[];
  cube_measure: CubeMeasure[];
  cube_key: CubeKey[];
}

/** A fact has a grain and no SCD type; a dimension an SCD type and no grain (`cube_entity_shape_ck`). */
const shapeFits = (r: AnyRow) =>
  r.role === "fact" ? r.scd_type === null : r.grain === null && (SCD_TYPES as readonly unknown[]).includes(r.scd_type);

export const INFOCUBE_RULES: Readonly<Record<InfoCubeTable, TableRules>> = {
  cube_entity: {
    key: ["id"],
    foreignKeys: { ...model, entity_id: "entity" },
    unique: [{ columns: ["entity_id"], live: true }],
    checks: [
      { name: "cube_entity_role_ck", test: oneOf(CUBE_ROLES, "role") },
      { name: "cube_entity_shape_ck", test: shapeFits },
    ],
  },
  cube_measure: {
    key: ["id"],
    foreignKeys: { ...model, attribute_id: "attribute" },
    unique: [{ columns: ["attribute_id"], live: true }],
    checks: [{ name: "cube_measure_additivity_ck", test: oneOf(ADDITIVITIES, "additivity") }],
  },
  // slice 15b (RP-B): one key per relationship, one relationship per attribute; that the relationship joins a fact and a
  // dimension and the attribute is the fact's is the module's commands' check, as `cube_measure`'s "a fact's attribute"
  cube_key: {
    key: ["id"],
    foreignKeys: { ...model, relationship_id: "relationship", attribute_id: "attribute" },
    unique: [
      { columns: ["relationship_id"], live: true },
      { columns: ["attribute_id"], live: true },
    ],
  },
};
