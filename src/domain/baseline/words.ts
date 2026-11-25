// The comparison's words (slice 35, step 1's Q5): kinds, groups, field names, values; one dictionary per documentation
// language, so slice 36's section "Changes since …" prints the same comparison in the document's language. English now;
// Polish and German are English until slice 36 writes them (as `labels.ts` did for German in slice 25).

import type { DocLanguage } from "../types";
import type { BaselineChange, ChangeKind, ClosedList, CompareValue, FieldChange, FieldName, ItemKind } from "./compare";

export interface CompareWords {
  readonly kinds: Readonly<Record<ItemKind, string>>;
  readonly groups: Readonly<Record<ChangeKind, string>>;
  readonly fields: Readonly<Record<FieldName, string>>;
  readonly closed: Readonly<Record<ClosedList, Readonly<Record<string, string>>>>;
  readonly yes: string;
  readonly no: string;
  /** An empty value. */
  readonly none: string;
  /** A long text that changed: "{field} (changed)". */
  readonly changedLong: (field: string) => string;
  /** A short value that changed: "{field}: {old} → {new}". */
  readonly changedShort: (field: string, before: string, after: string) => string;
}

const EN: CompareWords = {
  kinds: {
    entity: "Entity",
    attribute: "Attribute",
    mapping: "Mapping",
    relationship: "Relationship",
    requirement: "Requirement",
    source_table: "Source table",
    source_column: "Source column",
  },
  groups: { added: "Added", changed: "Changed", removed: "Removed" },
  fields: {
    name: "name",
    alias: "alias",
    stereotype: "stereotype",
    concept: "concept",
    definition: "definition",
    type: "type",
    pk: "PK",
    fk: "FK",
    bk: "BK",
    pii: "personal data",
    nullable: "nullable",
    calculated: "calculated",
    rule: "rule",
    status: "status",
    kind: "kind",
    source_columns: "source columns",
    target_attribute: "target attribute",
    note: "note",
    label: "label",
    from_min: "from min",
    from_max: "from max",
    to_min: "to min",
    to_max: "to max",
    from_role: "role at the left end",
    to_role: "role at the right end",
    description: "description",
    priority: "priority",
    severity: "severity",
    owner: "owner",
    external_ref: "external reference",
    parent: "parent",
    expression: "expression",
    system: "system",
    database: "database",
    schema: "schema",
    object_type: "object type",
    file_format: "file format",
    missing: "missing from source",
    classifications: "classifications",
    comment: "comment",
    default: "default",
    not_needed: "not needed",
  },
  closed: {
    mapping_status: { draft: "Draft", review: "In review", approved: "Approved" },
    mapping_kind: { direct: "Direct", transform: "Transform" },
    requirement_kind: { need: "Business need", data: "Data requirement", business_rule: "Business rule", dq_rule: "Data quality rule", non_functional: "Non-functional" },
    requirement_status: { draft: "Draft", agreed: "Agreed", implemented: "Implemented", verified: "Verified" },
    requirement_priority: { must: "Must", should: "Should", could: "Could", wont: "Won't" },
    requirement_severity: { warn: "Warn", block: "Block" },
    object_type: { table: "Table", view: "View", file: "File" },
  },
  yes: "yes",
  no: "no",
  none: "–",
  changedLong: (field) => `${field} (changed)`,
  changedShort: (field, before, after) => `${field}: ${before} → ${after}`,
};

/** By documentation language; Polish and German follow in slice 36. */
export const COMPARE_WORDS: Readonly<Record<DocLanguage, CompareWords>> = { en: EN, pl: EN, de: EN };

/** A short value as text: "–" when empty, "yes"/"no", a list joined with ", ", a closed list's label. */
export function valueText(v: CompareValue, words: CompareWords): string {
  if (v === null || v === "") return words.none;
  if (typeof v === "boolean") return v ? words.yes : words.no;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.length ? v.join(", ") : words.none;
  const coded = v as { list: ClosedList; code: string };
  return words.closed[coded.list][coded.code] ?? coded.code;
}

/** One field's change as text (B4.2): "type: varchar(10) → varchar(20)", or "definition (changed)" for a long text. */
export function fieldText(f: FieldChange, words: CompareWords): string {
  const name = words.fields[f.field];
  return f.long ? words.changedLong(name) : words.changedShort(name, valueText(f.before, words), valueText(f.after, words));
}

/** A change's "What changed": its fields joined with ", " (empty for an added or removed item). */
export const whatChanged = (c: BaselineChange, words: CompareWords): string => c.fields.map((f) => fieldText(f, words)).join(", ");
