// The synthetic model of the checks' benches (slice 20, step 2): about 20,000 attributes, 2,000 entities, 2,000
// relationships, 3,000 copies (chains, wrong ways, missing relationships), duplicates, calculations, 3,000 approved
// source mappings and 1,500 dimensional mappings. Plain data, no node module, so the browser bench bundles it too.

import type { ChecksDb } from "./checks-model";

export const SYNTHETIC_WS = "01900000-0000-7000-8000-ffff00000001";


export function synthetic(): ChecksDb {
  const db = { workspace: [], concept: [], entity: [], attribute: [], attribute_input: [], relationship: [], source_system: [], source_table: [], source_column: [], mapping: [], mapping_input: [] } as unknown as ChecksDb;
  const ws = "01900000-0000-7000-8000-ffff00000001";
  let n = 0;
  const id = () => `01900000-0000-7000-8000-${(++n).toString(16).padStart(12, "0")}`;
  const std = () => ({ id: id(), workspace_id: ws, version: 1, created_at: "2026-11-08T00:00:00.000Z", created_by: ws, updated_at: "2026-11-08T00:00:00.000Z", updated_by: ws, deleted_at: null });
  db.workspace.push({ ...std(), id: ws, infocube: true } as never);
  const concept = { ...std(), name: "C", description_html: null, description_text: null, color: "#000", sort_order: 0 };
  db.concept.push(concept as never);
  const TYPES = ["string", "integer", "decimal", "date"] as const;
  const ENTITIES = 2_000, LOGICAL = 1_500;
  const entities: string[] = [];
  const attrs: { id: string; entity: string; pk: boolean; type: string }[][] = [];
  for (let e = 0; e < ENTITIES; e++) {
    const row = { ...std(), concept_id: concept.id, name: `Entity ${e}`, alias: null, model_level: e < LOGICAL ? "logical" : "dimensional", stereotype: "object", definition_html: null, definition_text: null };
    db.entity.push(row as never);
    entities.push(row.id);
    const list = [];
    for (let k = 0; k < 10; k++) {
      const type = k === 0 ? "integer" : TYPES[(e + k) % 4]!;
      const name = k === 9 && e % 50 === 0 ? " Attr_1 " : `attr_${k}`; // a duplicate in every 50th entity
      const a = { ...std(), entity_id: row.id, name, alias: null, sort_order: k, data_type: type, custom_type: null, type_length: null, type_precision: null, type_scale: null, is_primary_key: k === 0, is_foreign_key: false, is_business_key: false, is_pii: false, is_nullable: k !== 0, definition_html: null, definition_text: null, copied_from_attribute_id: null as string | null, is_calculated: false, calc_rule: null as string | null };
      db.attribute.push(a as never);
      list.push({ id: a.id, entity: row.id, pk: k === 0, type });
    }
    attrs.push(list);
  }
  const attribute = (id: string) => db.attribute.find((a) => a.id === id)!;
  const copy = (entity: number, of: string, name: string) => {
    const o = attribute(of);
    const a = { ...o, ...std(), entity_id: entities[entity]!, name, sort_order: 10 + db.attribute.filter((x) => x.entity_id === entities[entity]).length, is_primary_key: false, is_foreign_key: true, copied_from_attribute_id: of };
    db.attribute.push(a);
    return a.id;
  };
  // 2,000 logical relationships, 1:N; most many sides hold a copy of the key, some a copy of a copy, some none
  const copies: string[] = [];
  for (let r = 0; r < 2_000; r++) {
    const one = r % LOGICAL, many = (r * 7 + 3) % LOGICAL;
    if (one === many) continue;
    db.relationship.push({ ...std(), from_entity_id: entities[one]!, to_entity_id: entities[many]!, label: "has", from_min: 1, from_max: "1", to_min: 0, to_max: "n", description: null, from_role: null, to_role: null } as never);
    if (r % 10 !== 0) copies.push(copy(many, attrs[one]![0]!.id, `key_${one}`));
  }
  // chains, wrong ways and copies without a relationship, up to 3,000 copies
  for (let i = 0; copies.length < 2_500; i++) copies.push(copy((i * 13 + 5) % LOGICAL, copies[i]!, `chain_${i}`));
  for (let i = 0; copies.length < 2_800; i++) copies.push(copy(i % LOGICAL, attrs[(i * 7 + 3) % LOGICAL]![0]!.id, `wrong_${i}`));
  for (let i = 0; copies.length < 3_000; i++) copies.push(copy((i * 31 + 11) % LOGICAL, attrs[(i * 17 + 1) % LOGICAL]![0]!.id, `loose_${i}`));
  // calculations with a mapping of their own
  // 300 tables of 10 columns, 3,000 approved source mappings onto logical attributes
  const system = { ...std(), name: "S", description: null };
  db.source_system.push(system as never);
  for (let t = 0; t < 300; t++) {
    const table = { ...std(), source_system_id: system.id, database_name: "d", schema_name: "s", name: `t${t}` };
    db.source_table.push(table as never);
    for (let c = 0; c < 10; c++) {
      const column = { ...std(), source_table_id: table.id, name: `c${c}`, ordinal: c, data_type: "varchar", type_length: 50, type_precision: null, type_scale: null, is_nullable: true, is_primary_key: false, is_foreign_key: false, comment: null, missing_since: t % 40 === 0 ? "2026-11-01T00:00:00.000Z" : null, retired_since: null };
      db.source_column.push(column as never);
      const target = attrs[(t * 10 + c) % LOGICAL]![(c % 9) + 1]!;
      const m = { ...std(), attribute_id: target.id, kind: "direct", rule_expression: null, status: "approved", note_html: null, note_text: null, approved_by: ws, approved_at: "2026-11-01T00:00:00.000Z", review_reason: null };
      db.mapping.push(m as never);
      db.mapping_input.push({ ...std(), mapping_id: m.id, source_column_id: column.id, sort_order: 0 } as never);
    }
  }
  for (let e = 0; e < LOGICAL; e += 20) {
    const a = attribute(attrs[e]![8]!.id);
    a.is_calculated = true;
    db.attribute_input.push({ ...std(), attribute_id: a.id, input_attribute_id: attrs[e]![7]!.id, sort_order: 0 } as never);
  }
  // InfoCube: every 5th dimensional entity a fact, the rest dimensions; 1,500 approved dimensional mappings
  db.cube_entity = [];
  db.cube_measure = [];
  db.cube_key = [];
  db.cube_mapping = [];
  db.cube_mapping_input = [];
  for (let e = LOGICAL; e < ENTITIES; e++) {
    const fact = e % 5 === 0;
    db.cube_entity.push({ ...std(), entity_id: entities[e]!, role: fact ? "fact" : "dimension", grain: fact && e % 2 ? "One row" : null, fact_type: fact ? "transaction" : null, is_factless: fact ? false : null, base_fact_entity_id: null, dim_kind: fact ? null : "standard", history: fact ? null : "overwrite", snapshot_period: null, has_unknown_member: fact ? null : true } as never);
  }
  // slice 22: every dimension related to a fact (400 relationships); every 4th dimension's unknown member off (100
  // `nounk` lines); a stored value "abc" on three attributes of every dimension (1,200 rows; those of the 300 dimensions
  // with it on that are no String do not fit: `unkval` lines)
  db.cube_attribute = [];
  for (let e = LOGICAL, d = 0; e < ENTITIES; e++) {
    if (e % 5 === 0) continue;
    const fact = LOGICAL + ((e - LOGICAL) % 100) * 5;
    db.relationship.push({ ...std(), from_entity_id: entities[e]!, to_entity_id: entities[fact]!, label: "describes", from_min: 1, from_max: "1", to_min: 0, to_max: "n", description: null, from_role: null, to_role: null } as never);
    if (d++ % 4 === 0) (db.cube_entity.find((c) => c.entity_id === entities[e]) as { has_unknown_member: boolean }).has_unknown_member = false;
    for (const k of [1, 4, 7]) db.cube_attribute.push({ ...std(), attribute_id: attrs[e]![k]!.id, unknown_value: "abc" } as never);
  }
  for (let i = 0; i < 1_500; i++) {
    const target = attrs[LOGICAL + (i % (ENTITIES - LOGICAL))]![(i % 9) + 1]!;
    const input = attrs[(i * 3) % LOGICAL]![(i % 9) + 1]!;
    const m = { ...std(), attribute_id: target.id, kind: "direct", rule_expression: null, status: "approved", note: null, approved_by: ws, approved_at: "2026-11-01T00:00:00.000Z", lookup_relationship_id: null, lookup_default: null };
    db.cube_mapping.push(m as never);
    db.cube_mapping_input.push({ ...std(), mapping_id: m.id, attribute_id: input.id, sort_order: 0 } as never);
  }
  return db;
}

