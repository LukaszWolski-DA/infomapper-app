// Comparing two states of a workspace (slice 35, B1.6, B2.3, B4.2, B4.6; step 1's Q5 with Łukasz's answers 3 to 5): a
// pure function, two contents in, the changes out, shared with slice 36's section. Seven kinds, both model levels (a
// fact or a dimension is an Entity, its attributes Attributes; InfoCube's own rows are not compared). Added, changed and
// removed by id; a change lists every field that differs, a short value as old → new and a long text as "(changed)".
// Ids are shown by name, each in the state it belongs to. Order, places, times, versions, ids and who changed are not
// compared. The words are `words.ts`'s; nothing here is English text but the model's own names.

import { stereotypeIndex } from "../model/stereotypes";
import { formatAttributeType, formatColumnType } from "../model/type-check";
import type { Uuid } from "../ids";
import type { BaselineContent } from "./content";

export const ITEM_KINDS = ["entity", "attribute", "mapping", "relationship", "requirement", "source_table", "source_column"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export const CHANGE_KINDS = ["added", "changed", "removed"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

export type ClosedList = "mapping_status" | "mapping_kind" | "requirement_kind" | "requirement_status" | "requirement_priority" | "requirement_severity" | "object_type";

/** A short value: a text, yes/no, empty, a list of names, or a code of a closed list (its label is the words'). */
export type CompareValue = string | boolean | null | readonly string[] | { readonly list: ClosedList; readonly code: string };

export type FieldName =
  | "name" | "alias" | "stereotype" | "concept" | "definition"
  | "type" | "pk" | "fk" | "bk" | "pii" | "nullable" | "calculated" | "rule"
  | "status" | "kind" | "source_columns" | "target_attribute" | "note"
  | "label" | "from_min" | "from_max" | "to_min" | "to_max" | "from_role" | "to_role" | "description"
  | "priority" | "severity" | "owner" | "external_ref" | "parent" | "expression"
  | "system" | "database" | "schema" | "object_type" | "file_format" | "missing" | "classifications" | "comment"
  | "default" | "not_needed";

/** One changed field: a short one with both values, or a long text that changed. */
export type FieldChange =
  | { readonly field: FieldName; readonly long?: undefined; readonly before: CompareValue; readonly after: CompareValue }
  | { readonly field: FieldName; readonly long: true };

export interface BaselineChange {
  readonly kind: ItemKind;
  readonly change: ChangeKind;
  readonly id: Uuid;
  /** The item's label in the newer state (in the older one for a removed item). */
  readonly label: string;
  /** Changed fields in the kind's field order; empty for an added or removed item. */
  readonly fields: readonly FieldChange[];
}

/** An item as compared: its short fields and its long texts (compared, never shown). */
interface Item {
  readonly id: Uuid;
  readonly label: string;
  readonly short: readonly (readonly [FieldName, CompareValue])[];
  readonly long: readonly (readonly [FieldName, string | null])[];
}

const coded = (list: ClosedList, code: string | null): CompareValue => (code === null ? null : { list, code });
const text = (v: string | null | undefined): string | null => (v === undefined || v === null || v === "" ? null : v);

/** Every item of one state, by kind, labelled and with its fields from that state's own names. */
function itemsOf(c: BaselineContent): Record<ItemKind, Item[]> {
  const m = c.model;
  const entity = new Map(m.entities.map((e) => [e.id, e]));
  const attribute = new Map(m.attributes.map((a) => [a.id, a]));
  const concept = new Map(m.concepts.map((x) => [x.id, x.name]));
  const system = new Map(m.sourceSystems.map((s) => [s.id, s.name]));
  const table = new Map(m.sourceTables.map((t) => [t.id, t]));
  const column = new Map(m.sourceColumns.map((x) => [x.id, x]));
  const requirement = new Map(c.requirements.map((r) => [r.id, r]));
  const stereotypes = stereotypeIndex(m.stereotypes);
  const classification = new Map(m.classifications.map((x) => [x.id, x.name]));
  const classesOf = new Map<Uuid, string[]>();
  for (const k of m.classificationLinks) {
    const target = k.source_column_id ?? k.source_table_id;
    const name = classification.get(k.classification_id);
    if (!target || name === undefined) continue;
    const list = classesOf.get(target) ?? [];
    list.push(name);
    classesOf.set(target, list);
  }
  const classes = (id: Uuid): string[] => [...(classesOf.get(id) ?? [])].sort((a, b) => a.localeCompare(b));
  const entityName = (id: Uuid) => entity.get(id)?.name ?? "?";
  const attributeLabel = (id: Uuid) => {
    const a = attribute.get(id);
    return a ? `${entityName(a.entity_id)}.${a.name}` : "?";
  };
  const tableLabel = (id: Uuid) => {
    const t = table.get(id);
    return t ? `${system.get(t.source_system_id) ?? "?"} · ${t.name}` : "?";
  };
  const columnShort = (id: Uuid) => {
    const x = column.get(id);
    return x ? `${table.get(x.source_table_id)?.name ?? "?"}.${x.name}` : "?";
  };
  const inputs = new Map<Uuid, string[]>();
  for (const i of m.mappingInputs) {
    const list = inputs.get(i.mapping_id) ?? [];
    list.push(columnShort(i.source_column_id));
    inputs.set(i.mapping_id, list);
  }

  return {
    entity: m.entities.map((e) => ({
      id: e.id,
      label: e.name,
      short: [["name", e.name], ["alias", text(e.alias)], ["stereotype", stereotypes.name(e.stereotype)], ["concept", concept.get(e.concept_id) ?? "?"]],
      long: [["definition", text(e.definition_html)]],
    })),
    attribute: m.attributes.map((a) => ({
      id: a.id,
      label: attributeLabel(a.id),
      short: [
        ["name", a.name],
        ["alias", text(a.alias)],
        ["type", formatAttributeType(a)],
        ["pk", a.is_primary_key],
        ["fk", a.is_foreign_key],
        ["bk", a.is_business_key],
        ["pii", a.is_pii],
        ["nullable", a.is_nullable],
        ["calculated", a.is_calculated],
      ],
      long: [["definition", text(a.definition_html)], ["rule", text(a.calc_rule)]],
    })),
    mapping: m.mappings.map((x) => {
      const from = inputs.get(x.id) ?? [];
      return {
        id: x.id,
        label: `${from.join(", ") || "?"} → ${attributeLabel(x.attribute_id)}`,
        short: [
          ["status", coded("mapping_status", x.status)],
          ["kind", coded("mapping_kind", x.kind)],
          ["source_columns", from],
          ["target_attribute", attributeLabel(x.attribute_id)],
        ],
        long: [["rule", text(x.rule_expression)], ["note", text(x.note_html)]],
      };
    }),
    relationship: m.relationships.map((r) => ({
      id: r.id,
      label: `${entityName(r.from_entity_id)} – ${entityName(r.to_entity_id)}`,
      short: [
        ["label", text(r.label)],
        ["from_min", String(r.from_min)],
        ["from_max", r.from_max],
        ["to_min", String(r.to_min)],
        ["to_max", r.to_max],
        ["from_role", text(r.from_role)],
        ["to_role", text(r.to_role)],
      ],
      long: [["description", text(r.description)]],
    })),
    requirement: c.requirements.map((r) => ({
      id: r.id,
      label: `${r.key} ${r.name}`,
      short: [
        ["name", r.name],
        ["kind", coded("requirement_kind", r.kind)],
        ["status", coded("requirement_status", r.status)],
        ["priority", coded("requirement_priority", r.priority)],
        ["severity", coded("requirement_severity", r.severity)],
        ["owner", text(r.owner_name)],
        ["external_ref", text(r.external_ref)],
        ["parent", r.parent_id === null ? null : (requirement.get(r.parent_id)?.key ?? "?")],
      ],
      long: [["description", text(r.description_html)], ["expression", text(r.expression)]],
    })),
    source_table: m.sourceTables.map((t) => ({
      id: t.id,
      label: tableLabel(t.id),
      short: [
        ["name", t.name],
        ["system", system.get(t.source_system_id) ?? "?"],
        ["database", text(t.database_name)],
        ["schema", text(t.schema_name)],
        ["object_type", coded("object_type", t.object_type)],
        ["file_format", text(t.file_format)],
        ["missing", t.missing_since !== null],
        ["classifications", classes(t.id)],
      ],
      long: [["comment", text(t.comment)], ["note", text(t.note_html)]],
    })),
    source_column: m.sourceColumns.map((x) => ({
      id: x.id,
      label: `${tableLabel(x.source_table_id)}.${x.name}`,
      short: [
        ["name", x.name],
        ["type", formatColumnType(x)],
        ["nullable", x.is_nullable],
        ["pk", x.is_primary_key],
        ["fk", x.is_foreign_key],
        ["default", text(x.default_value)],
        ["not_needed", x.not_needed],
        ["missing", x.missing_since !== null],
        ["classifications", classes(x.id)],
      ],
      long: [["comment", text(x.comment)], ["note", text(x.note_html)]],
    })),
  };
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const byLabel = (a: BaselineChange, b: BaselineChange) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id);

/**
 * The changes from `older` to `newer`: per kind in `ITEM_KINDS`' order, added, then changed, then removed, each by its
 * label. The caller puts the older state first (B4.6: whichever row the dialog was opened from; Now is always newer).
 */
export function compareBaselines(older: BaselineContent, newer: BaselineContent): BaselineChange[] {
  const a = itemsOf(older);
  const b = itemsOf(newer);
  const out: BaselineChange[] = [];
  for (const kind of ITEM_KINDS) {
    const before = new Map(a[kind].map((x) => [x.id, x]));
    const after = new Map(b[kind].map((x) => [x.id, x]));
    const added: BaselineChange[] = [];
    const changed: BaselineChange[] = [];
    const removed: BaselineChange[] = [];
    for (const y of after.values()) {
      const x = before.get(y.id);
      if (!x) {
        added.push({ kind, change: "added", id: y.id, label: y.label, fields: [] });
        continue;
      }
      const fields: FieldChange[] = [];
      for (const [i, [field, value]] of y.short.entries()) {
        const old = x.short[i]![1];
        if (!same(old, value)) fields.push({ field, before: old, after: value });
      }
      for (const [i, [field, value]] of y.long.entries()) if (!same(x.long[i]![1], value)) fields.push({ field, long: true });
      if (fields.length) changed.push({ kind, change: "changed", id: y.id, label: y.label, fields });
    }
    for (const x of before.values()) if (!after.has(x.id)) removed.push({ kind, change: "removed", id: x.id, label: x.label, fields: [] });
    out.push(...added.sort(byLabel), ...changed.sort(byLabel), ...removed.sort(byLabel));
  }
  return out;
}

/** The dialog's filter (PRD): the item's label contains the text in any letter case; a kind narrows to that kind. */
export function filterChanges(changes: readonly BaselineChange[], query: string, kind: ItemKind | null = null): BaselineChange[] {
  const q = query.trim().toLowerCase();
  return changes.filter((c) => (!kind || c.kind === kind) && (!q || c.label.toLowerCase().includes(q)));
}

/** Which of two states is older (B4.6): by the time taken; Now (`null`) is always the newer. Ties keep the order given. */
export function olderFirst<T extends { readonly created_at: string }>(x: T | null, y: T | null): [T | null, T | null] {
  if (x === null) return [y, x];
  if (y === null) return [x, y];
  return y.created_at < x.created_at ? [y, x] : [x, y];
}
