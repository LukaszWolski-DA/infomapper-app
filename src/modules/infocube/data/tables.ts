// InfoCube's tables in the local data file and the rules the database would enforce on them (slice 15a, AD-33),
// mirroring supabase/migrations/20261104100100_infocube_entities.sql and (slice 15b, `cube_key`)
// 20261104110100_infocube_keys.sql and (slice 15c, the dimensional mappings) 20261105110000_infocube_mappings.sql and
// (slice 19, the types) 20261108130000_infocube_types.sql and (slice 22, the unknown member)
// 20261109120000_infocube_unknown_member.sql. Registered with the store by `src/compose/`.

import { model, oneOf, type AnyRow, type TableRules } from "@/data/local/schema";
import {
  ADDITIVITIES,
  CUBE_MAPPING_KINDS,
  CUBE_MAPPING_STATUSES,
  CUBE_ROLES,
  DEFAULT_DIM_KIND,
  DEFAULT_FACT_TYPE,
  DIM_KINDS,
  FACT_TYPES,
  HISTORIES,
  type CubeAttribute,
  type CubeEntity,
  type CubeKey,
  type CubeMapping,
  type CubeMappingInput,
  type CubeMeasure,
  type InfoCubeTable,
} from "../domain/types";

/** InfoCube's tables in the file, absent until its first row (the AD-31 schema check reads this interface). */
export interface InfoCubeDb {
  cube_entity: CubeEntity[];
  cube_measure: CubeMeasure[];
  cube_key: CubeKey[];
  cube_mapping: CubeMapping[];
  cube_mapping_input: CubeMappingInput[];
  cube_attribute: CubeAttribute[];
}

const noneOrOneOf = (values: readonly string[], column: string) => (r: AnyRow) => r[column] === null || values.includes(r[column] as string);

/**
 * A fact has a type and a factless flag and none of a dimension's fields; a dimension a kind and a history and none of a
 * fact's, no grain either (`cube_entity_shape_ck`, slice 19); slice 22: a dimension says whether it has an unknown
 * member, a fact has none.
 */
const shapeFits = (r: AnyRow) =>
  r.role === "fact"
    ? r.fact_type != null && r.is_factless != null && r.dim_kind == null && r.history == null && r.snapshot_period == null && r.has_unknown_member == null
    : r.grain === null && r.fact_type == null && r.is_factless == null && r.base_fact_entity_id == null && r.dim_kind != null && r.history != null && r.has_unknown_member != null;

const OLD_HISTORY: Record<number, string> = { 0: "keep", 1: "overwrite", 2: "history" };
const NEW_COLUMNS = ["fact_type", "is_factless", "base_fact_entity_id", "dim_kind", "history", "snapshot_period", "has_unknown_member"] as const;

/**
 * A `cube_entity` row written before slice 19 (F1), as it reads now: a fact a transaction, not factless, without a base; a
 * dimension standard, its `scd_type` 0, 1 or 2 as keep, overwrite or history (overwrite when absent); `scd_type` dropped.
 * A row written before slice 22 (acceptance F4): a dimension has its unknown member on, a fact none.
 * Null for a row in the current shape. The migration does the same in the database.
 */
export function upgradeCubeEntity(row: AnyRow): AnyRow | null {
  if (!("scd_type" in row) && NEW_COLUMNS.every((c) => c in row)) return null;
  const { scd_type: scd, ...rest } = row;
  const fact = row.role === "fact";
  return {
    ...rest,
    fact_type: fact ? ((row.fact_type as string | undefined) ?? DEFAULT_FACT_TYPE) : null,
    is_factless: fact ? ((row.is_factless as boolean | undefined) ?? false) : null,
    base_fact_entity_id: fact ? ((row.base_fact_entity_id as string | undefined) ?? null) : null,
    dim_kind: fact ? null : ((row.dim_kind as string | undefined) ?? DEFAULT_DIM_KIND),
    history: fact ? null : ((row.history as string | undefined) ?? OLD_HISTORY[scd as number] ?? "overwrite"),
    snapshot_period: fact ? null : ((row.snapshot_period as string | undefined) ?? null),
    has_unknown_member: fact ? null : ((row.has_unknown_member as boolean | undefined) ?? true),
  };
}

export const INFOCUBE_RULES: Readonly<Record<InfoCubeTable, TableRules>> = {
  cube_entity: {
    key: ["id"],
    // slice 19: the base may point to a deleted entity's row between a revert's steps; it reads as none then
    foreignKeys: { ...model, entity_id: "entity", base_fact_entity_id: "entity" },
    unique: [{ columns: ["entity_id"], live: true }],
    checks: [
      { name: "cube_entity_role_ck", test: oneOf(CUBE_ROLES, "role") },
      { name: "cube_entity_fact_type_ck", test: noneOrOneOf(FACT_TYPES, "fact_type") },
      { name: "cube_entity_dim_kind_ck", test: noneOrOneOf(DIM_KINDS, "dim_kind") },
      { name: "cube_entity_history_ck", test: noneOrOneOf(HISTORIES, "history") },
      { name: "cube_entity_base_ck", test: (r) => r.base_fact_entity_id == null || r.base_fact_entity_id !== r.entity_id },
      { name: "cube_entity_shape_ck", test: shapeFits },
    ],
    // slice 19 (F1): rows written before the types are converted when the file is loaded
    upgrade: upgradeCubeEntity,
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
  // slice 15c (M1): that the target is dimensional, the inputs logical and a direct copy reads exactly one (AD-26) is
  // the module's commands' check; the database checks the closed lists and one row per input attribute
  cube_mapping: {
    key: ["id"],
    foreignKeys: { ...model, attribute_id: "attribute", approved_by: "app_user", lookup_relationship_id: "relationship" },
    // slice 18 (Q2): rows written before lookups read their two columns as null
    defaults: { lookup_relationship_id: null, lookup_default: null },
    checks: [
      { name: "cube_mapping_kind_ck", test: oneOf(CUBE_MAPPING_KINDS, "kind") },
      { name: "cube_mapping_status_ck", test: oneOf(CUBE_MAPPING_STATUSES, "status") },
      // an approval is logged (AD-06), as `mapping_approval_ck`; a transformation may wait for its rule (the prototype's
      // second input makes one with an empty rule and asks for it), so there is no `mapping_rule_ck`
      { name: "cube_mapping_approval_ck", test: (r) => (r.status === "approved") === (r.approved_at != null && r.approved_at !== "") },
    ],
  },
  cube_mapping_input: {
    key: ["id"],
    foreignKeys: { ...model, mapping_id: "cube_mapping", attribute_id: "attribute" },
    unique: [{ columns: ["mapping_id", "attribute_id"], live: true }],
  },
  // slice 22: one live row per attribute; that the attribute is a dimension's is the module's command's check, as
  // `cube_measure`'s "a fact's attribute"
  cube_attribute: {
    key: ["id"],
    foreignKeys: { ...model, attribute_id: "attribute" },
    unique: [{ columns: ["attribute_id"], live: true }],
    checks: [
      {
        name: "cube_attribute_unknown_value_ck",
        test: (r) => r.unknown_value === null || (typeof r.unknown_value === "string" && r.unknown_value !== "" && r.unknown_value === r.unknown_value.trim()),
      },
    ],
  },
};
