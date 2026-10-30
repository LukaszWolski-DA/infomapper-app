// A synthetic model for timing the requirement index (slice 4a step 3; slice 4p item 10 in the browser): 500
// requirements in chains of parents, 5,000 attributes on 500 entities, 3,000 columns in 300 tables, 2,000 mappings
// (every fifth a transformation with two inputs, a third of them drafts) and 3,000 links to all five kinds of target.
// Not used by the application; `scripts/bench-requirement-index.ts` and the measuring hook (`window.__imIndexTiming`) use
// it.

import type { Attribute, Entity, Mapping, MappingInput, Requirement, RequirementLink, SourceColumn, SourceTable } from "../types";

export function syntheticIndexInput() {
  const std = (id: string) => ({ id, workspace_id: "ws", version: 1, created_at: "t", created_by: "u", updated_at: "t", updated_by: "u", deleted_at: null });
  const id = (kind: string, n: number) => `${kind}-${n}`;

  const ENTITIES = 500, ATTRIBUTES = 5000, TABLES = 300, COLUMNS = 3000, MAPPINGS = 2000, REQUIREMENTS = 500, LINKS = 3000;

  const entities: Entity[] = Array.from({ length: ENTITIES }, (_, i) => ({ ...std(id("e", i)), concept_id: "c", name: `E${i}`, stereotype: "object", definition_html: null, definition_text: null }));
  const attributes: Attribute[] = Array.from({ length: ATTRIBUTES }, (_, i) => ({
    ...std(id("a", i)),
    entity_id: id("e", i % ENTITIES),
    name: `a${i}`,
    sort_order: Math.floor(i / ENTITIES),
    data_type: i % 3 === 0 ? "integer" : "string",
    custom_type: null,
    type_length: null,
    type_precision: null,
    type_scale: null,
    is_primary_key: false,
    is_foreign_key: false,
    is_business_key: false,
    is_pii: false,
    is_nullable: true,
    definition_html: null,
    definition_text: null,
    copied_from_attribute_id: null,
  }));
  const sourceTables: SourceTable[] = Array.from({ length: TABLES }, (_, i) => ({ ...std(id("t", i)), source_system_id: "s", database_name: "db", schema_name: "dbo", name: `t${i}`, object_type: "table", file_format: null, row_count: null, comment: null, missing_since: null, retired_since: null, note_html: null, note_text: null }));
  const sourceColumns: SourceColumn[] = Array.from({ length: COLUMNS }, (_, i) => ({
    ...std(id("col", i)),
    source_table_id: id("t", i % TABLES),
    name: `c${i}`,
    ordinal: Math.floor(i / TABLES) + 1,
    data_type: i % 4 === 0 ? "int" : "varchar",
    type_length: null,
    type_precision: null,
    type_scale: null,
    is_nullable: true,
    is_primary_key: false,
    is_foreign_key: false,
    is_business_key: false,
    is_pii: false,
    default_value: null,
    comment: null,
    note_html: null,
    note_text: null,
    missing_since: null, retired_since: null, not_needed: false,
  }));
  const mappings: Mapping[] = Array.from({ length: MAPPINGS }, (_, i) => ({
    ...std(id("m", i)),
    attribute_id: id("a", (i * 2) % ATTRIBUTES),
    kind: i % 5 === 0 ? "transform" : "direct",
    rule_expression: i % 5 === 0 ? "f(x)" : null,
    status: i % 3 === 0 ? "draft" : "approved",
    note_html: null,
    note_text: null,
    approved_by: i % 3 === 0 ? null : "u",
    approved_at: i % 3 === 0 ? null : "t",
    review_reason: null,
  }));
  // one input each, a second one for every fifth (the transformations)
  const mappingInputs: MappingInput[] = mappings.flatMap((m, i) => [
    { ...std(`${m.id}#0`), mapping_id: m.id, source_column_id: id("col", i % COLUMNS), sort_order: 0 },
    ...(i % 5 === 0 ? [{ ...std(`${m.id}#1`), mapping_id: m.id, source_column_id: id("col", (i + 7) % COLUMNS), sort_order: 1 }] : []),
  ]);
  const requirements: Requirement[] = Array.from({ length: REQUIREMENTS }, (_, i) => ({
    ...std(id("r", i)),
    key: `REQ-${100 + i}`,
    kind: (["need", "data", "business_rule", "dq_rule", "non_functional"] as const)[i % 5]!,
    name: `Requirement ${i}`,
    description_html: null,
    description_text: null,
    expression: null,
    severity: null,
    status: "draft",
    priority: "should",
    owner_name: null,
    external_ref: null,
    parent_id: i % 4 === 0 || i === 0 ? null : id("r", i - 1),
  }));
  const none = { entity_id: null, attribute_id: null, mapping_id: null, source_table_id: null, source_column_id: null };
  const links: RequirementLink[] = Array.from({ length: LINKS }, (_, i) => {
    const target =
      i % 10 === 0
        ? { entity_id: id("e", i % ENTITIES) }
        : i % 10 < 6
          ? { attribute_id: id("a", (i * 7) % ATTRIBUTES) }
          : i % 10 < 8
            ? { mapping_id: id("m", i % MAPPINGS) }
            : i % 10 === 8
              ? { source_table_id: id("t", i % TABLES) }
              : { source_column_id: id("col", i % COLUMNS) };
    return { ...std(id("k", i)), requirement_id: id("r", i % REQUIREMENTS), ...none, ...target };
  });
  const model = { entities, attributes, mappings, mappingInputs, sourceTables, sourceColumns };
  return { requirements, links, model };
}
