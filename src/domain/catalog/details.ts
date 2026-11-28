// An item's details in InfoCatalog's drawer (slice 39, S39-04; the PRD's skeleton A3.2 without lineage, impact and the
// catalog's own content): its characteristics, its texts and the items one step away, each a link that opens in the
// same drawer. Pure, built from the item's workspace's snapshot and its catalog items. InfoMapper's kinds are here; a
// module gives its own kinds' through its contribution (`CatalogContribution.details`). A link names only an item the
// catalog has (a dimensional entity is no Entity item, C2), so every link opens.

import type { Uuid } from "../ids";
import { relationshipSentences } from "../model/relationship-sentences";
import { KIND_NAMES, PRIORITY_NAMES, STATUS_NAMES, usesExpression, usesSeverity } from "../model/requirements";
import { stereotypeIndex } from "../model/stereotypes";
import { formatAttributeType, formatColumnType } from "../model/type-check";
import type { WorkspaceSnapshot } from "../model/workspace-model";
import type { ModuleTable, RequirementLink } from "../types";
import { cardinality, type CatalogItem } from "./items";
import { physicalName } from "./physical";

/** An item of the same workspace, by its kind and id. */
export interface CatalogRef {
  readonly kind: string;
  readonly id: Uuid;
}

export interface CatalogLink {
  readonly ref: CatalogRef;
  readonly name: string;
  /** A short word after the name: a type, a status, a cardinality. */
  readonly note?: string;
}

/** One characteristic: a label and its text, or the items it names (links). */
export interface CatalogFact {
  readonly label: string;
  readonly text?: string;
  readonly links?: readonly CatalogLink[];
  /** A time (ISO), drawn in the reader's time zone. */
  readonly time?: string;
  /** Where the value comes from, said after it ("from InfoMapper"). */
  readonly note?: string;
  readonly mono?: boolean;
}

export interface CatalogText {
  readonly title: string;
  readonly text: string;
  readonly mono?: boolean;
}

/** Connected items of one kind: the first 50 (`GROUP_LIMIT`), and how many more. */
export interface CatalogGroup {
  readonly title: string;
  readonly links: readonly CatalogLink[];
  readonly more: number;
}

export interface CatalogDetails {
  readonly facts: readonly CatalogFact[];
  readonly texts: readonly CatalogText[];
  readonly groups: readonly CatalogGroup[];
}

/** What a details rule reads besides the snapshot: the workspace's catalog items, and facts the read adds (an import). */
export interface DetailsInput {
  readonly item: (kind: string, id: Uuid) => CatalogItem | undefined;
  /** A source system's last import (ISO), by system id. */
  readonly lastImports: Readonly<Record<Uuid, string>>;
}

export const GROUP_LIMIT = 50;
const yesNo = (v: boolean | null | undefined) => (v ? "Yes" : "No");

/** The builder's helpers over one workspace's items. */
export function detailsKit(input: DetailsInput) {
  const link = (kind: string, id: Uuid | null | undefined, note?: string): CatalogLink | null => {
    const it = id ? input.item(kind, id) : undefined;
    return it ? { ref: { kind, id: it.id }, name: it.name, ...(note ? { note } : {}) } : null;
  };
  const links = (xs: readonly (CatalogLink | null)[]): CatalogLink[] => xs.filter((x): x is CatalogLink => x !== null);
  const group = (title: string, xs: readonly (CatalogLink | null)[]): CatalogGroup | null => {
    const all = links(xs);
    return all.length ? { title: `${title} (${all.length.toLocaleString("en")})`, links: all.slice(0, GROUP_LIMIT), more: Math.max(0, all.length - GROUP_LIMIT) } : null;
  };
  const fact = (label: string, text: string | null | undefined, extra: Partial<CatalogFact> = {}): CatalogFact | null =>
    text != null && text.trim() !== "" ? { label, text, ...extra } : null;
  const linked = (label: string, xs: readonly (CatalogLink | null)[], fallback?: string): CatalogFact | null => {
    const all = links(xs);
    return all.length ? { label, links: all } : fallback ? { label, text: fallback } : null;
  };
  const text = (title: string, body: string | null | undefined, mono = false): CatalogText | null =>
    body != null && body.trim() !== "" ? { title, text: body, ...(mono ? { mono } : {}) } : null;
  const details = (facts: readonly (CatalogFact | null)[], texts: readonly (CatalogText | null)[], groups: readonly (CatalogGroup | null)[]): CatalogDetails => ({
    facts: facts.filter((x): x is CatalogFact => x !== null),
    texts: texts.filter((x): x is CatalogText => x !== null),
    groups: groups.filter((x): x is CatalogGroup => x !== null),
  });
  return { link, links, group, fact, linked, text, details, yesNo };
}

/** InfoMapper's kinds' details; null for a kind that is not InfoMapper's. */
export function coreCatalogDetails(snapshot: WorkspaceSnapshot<ModuleTable>, item: CatalogItem, input: DetailsInput): CatalogDetails | null {
  const k = detailsKit(input);
  const m = snapshot.model;
  const person = (id: Uuid | null) => (id ? snapshot.people.find((p) => p.id === id)?.display_name ?? "someone" : null);
  const liveAttrs = m.attributes.filter((a) => a.deleted_at === null);
  const liveRels = m.relationships.filter((r) => r.deleted_at === null);
  const entityName = (id: Uuid) => m.entities.find((e) => e.id === id)?.name ?? "?";
  const inputsOf = (mappingId: Uuid) => m.mappingInputs.filter((i) => i.mapping_id === mappingId).map((i) => i.source_column_id);
  const requirementsOf = (target: keyof Pick<RequirementLink, "entity_id" | "attribute_id" | "mapping_id" | "source_table_id" | "source_column_id">, id: Uuid) =>
    k.group(
      "Requirements",
      snapshot.requirementLinks.filter((l) => l[target] === id).map((l) => {
        const r = snapshot.requirements.find((x) => x.id === l.requirement_id);
        return k.link("requirement", l.requirement_id, r ? STATUS_NAMES[r.status] : undefined);
      }),
    );
  const mappingLink = (id: Uuid) => k.link("mapping", id, item.kind === "mapping" ? undefined : (() => {
    const x = m.mappings.find((y) => y.id === id);
    return x ? (x.status === "review" ? "In review" : x.status.charAt(0).toUpperCase() + x.status.slice(1)) : undefined;
  })());

  switch (item.kind) {
    case "entity": {
      const e = m.entities.find((x) => x.id === item.id)!;
      const attrs = liveAttrs.filter((a) => a.entity_id === e.id);
      const rels = liveRels.filter((r) => r.from_entity_id === e.id || r.to_entity_id === e.id);
      return k.details(
        [
          k.linked("Concept", [k.link("concept", e.concept_id)]),
          k.fact("Stereotype", stereotypeIndex(m.stereotypes).name(e.stereotype)),
          k.fact("Alias", e.alias),
          k.fact("Level", "Logical"),
          k.fact("Attributes", String(attrs.length)),
        ],
        [k.text("Definition", e.definition_text)],
        [
          k.group("Attributes", attrs.map((a) => k.link("attribute", a.id, formatAttributeType(a)))),
          k.group("Relationships", rels.map((r) => k.link("relationship", r.id, `${cardinality(r.from_min, r.from_max)} — ${cardinality(r.to_min, r.to_max)}`))),
          requirementsOf("entity_id", e.id),
        ],
      );
    }
    case "attribute": {
      const a = m.attributes.find((x) => x.id === item.id)!;
      return k.details(
        [
          k.linked("Entity", [k.link("entity", a.entity_id)], entityName(a.entity_id)),
          k.fact("Type", formatAttributeType(a)),
          k.fact("Alias", a.alias),
          k.fact("Primary key", yesNo(a.is_primary_key)),
          k.fact("Foreign key", yesNo(a.is_foreign_key)),
          k.fact("Business key", yesNo(a.is_business_key)),
          k.fact("Personal data", yesNo(a.is_pii)),
          k.fact("May be empty", yesNo(a.is_nullable)),
          k.fact("Calculated", yesNo(a.is_calculated)),
        ],
        [k.text("Definition", a.definition_text), a.is_calculated ? k.text("Calculation rule", a.calc_rule, true) : null],
        [k.group("Mappings", m.mappings.filter((x) => x.attribute_id === a.id).map((x) => mappingLink(x.id))), requirementsOf("attribute_id", a.id)],
      );
    }
    case "relationship": {
      const r = m.relationships.find((x) => x.id === item.id)!;
      const from = entityName(r.from_entity_id);
      const to = entityName(r.to_entity_id);
      return k.details(
        [
          k.linked("From", [k.link("entity", r.from_entity_id)], from),
          k.linked("To", [k.link("entity", r.to_entity_id)], to),
          k.fact("Cardinality", `${from} ${cardinality(r.from_min, r.from_max)} — ${cardinality(r.to_min, r.to_max)} ${to}`),
          k.fact(`Role of ${from}`, r.from_role),
          k.fact(`Role of ${to}`, r.to_role),
        ],
        [k.text("Reads", relationshipSentences(r, from, to).join(" ")), k.text("Description", r.description)],
        [],
      );
    }
    case "concept": {
      const c = m.concepts.find((x) => x.id === item.id)!;
      const entities = item.anchors.entities;
      return k.details([k.fact("Entities", String(entities.length))], [k.text("Description", c.description_text)], [k.group("Entities", entities.map((id) => k.link("entity", id)))]);
    }
    case "source_table": {
      const t = m.sourceTables.find((x) => x.id === item.id)!;
      const system = m.sourceSystems.find((s) => s.id === t.source_system_id);
      const columns = m.sourceColumns.filter((c) => c.source_table_id === t.id);
      const columnIds = new Set(columns.map((c) => c.id));
      const fed = new Set<Uuid>();
      for (const x of m.mappings) if (inputsOf(x.id).some((id) => columnIds.has(id))) fed.add(liveAttrs.find((a) => a.id === x.attribute_id)?.entity_id ?? "");
      const keys = m.sourceRelationships.filter((r) => r.source_table_id === t.id);
      const classes = classNames(snapshot, t.id);
      return k.details(
        [
          k.fact("System", system?.name ?? "?"),
          k.fact("Physical name", physicalName(system?.name, t), { mono: true }),
          k.fact("Object", t.object_type === "view" ? "View" : t.object_type === "file" ? `File${t.file_format ? ` (${t.file_format})` : ""}` : "Table"),
          k.fact("Columns", String(columns.length)),
          k.fact("Rows", t.row_count != null ? t.row_count.toLocaleString("en") : null),
          k.fact("Classifications", classes.join(", ")),
          system && input.lastImports[system.id] ? { label: "Last import", time: input.lastImports[system.id]!, note: `of ${system.name}` } : k.fact("Last import", "Not imported"),
          t.retired_since ? { label: "Retired since", time: t.retired_since } : t.missing_since ? { label: "Missing since", time: t.missing_since } : null,
        ],
        [k.text("Comment", t.comment), k.text("Note", t.note_text)],
        [
          k.group("Columns", columns.map((c) => k.link("source_column", c.id, formatColumnType(c)))),
          k.group("Declared foreign keys", keys.map((r) => k.link("source_table", r.to_source_table_id, r.name))),
          k.group("Entities it feeds", [...fed].map((id) => k.link("entity", id))),
          requirementsOf("source_table_id", t.id),
        ],
      );
    }
    case "source_column": {
      const c = m.sourceColumns.find((x) => x.id === item.id)!;
      const t = m.sourceTables.find((x) => x.id === c.source_table_id)!;
      const system = m.sourceSystems.find((s) => s.id === t.source_system_id);
      return k.details(
        [
          k.linked("Table", [k.link("source_table", t.id)], t.name),
          k.fact("Physical name", physicalName(system?.name, t, c), { mono: true }),
          k.fact("Physical type", formatColumnType(c), { mono: true }),
          k.fact("Primary key", yesNo(c.is_primary_key)),
          k.fact("Foreign key", yesNo(c.is_foreign_key)),
          k.fact("May be empty", yesNo(c.is_nullable)),
          k.fact("Classifications", classNames(snapshot, c.id).join(", ")),
          c.not_needed ? k.fact("Not needed", "Yes") : null,
          c.retired_since ? { label: "Retired since", time: c.retired_since } : c.missing_since ? { label: "Missing since", time: c.missing_since } : null,
        ],
        [k.text("Comment", c.comment), k.text("Note", c.note_text)],
        [k.group("Mappings", m.mappings.filter((x) => inputsOf(x.id).includes(c.id)).map((x) => mappingLink(x.id))), requirementsOf("source_column_id", c.id)],
      );
    }
    case "mapping": {
      const x = m.mappings.find((y) => y.id === item.id)!;
      const status = x.status === "review" ? "In review" : x.status.charAt(0).toUpperCase() + x.status.slice(1);
      return k.details(
        [
          k.linked("Source", inputsOf(x.id).map((id) => k.link("source_column", id))),
          k.linked("Target", [k.link("attribute", x.attribute_id)]),
          k.fact("Kind", x.kind === "transform" ? "Transform" : "Direct"),
          k.fact("Status", status),
          x.approved_by ? { label: "Approved by", text: person(x.approved_by)!, ...(x.approved_at ? { time: x.approved_at } : {}) } : null,
        ],
        [k.text("Rule", x.rule_expression, true), k.text("Note", x.note_text)],
        [requirementsOf("mapping_id", x.id)],
      );
    }
    case "requirement": {
      const r = snapshot.requirements.find((y) => y.id === item.id)!;
      const traced = snapshot.requirementLinks
        .filter((l) => l.requirement_id === r.id)
        .map((l) =>
          l.entity_id ? k.link("entity", l.entity_id, "Entity")
          : l.attribute_id ? k.link("attribute", l.attribute_id, "Attribute")
          : l.mapping_id ? k.link("mapping", l.mapping_id, "Mapping")
          : l.source_table_id ? k.link("source_table", l.source_table_id, "Source table")
          : k.link("source_column", l.source_column_id, "Source column"),
        );
      return k.details(
        [
          k.fact("Kind", KIND_NAMES[r.kind]),
          k.fact("Status", STATUS_NAMES[r.status]),
          k.fact("Priority", PRIORITY_NAMES[r.priority]),
          k.fact("External reference", r.external_ref),
          k.fact("Owner", r.owner_name, { note: "from InfoMapper" }),
          usesSeverity(r.kind) ? k.fact("When it fails", r.severity === "block" ? "Block the load" : "Warn") : null,
          k.linked("Part of", [k.link("requirement", r.parent_id)]),
        ],
        [k.text("Description", r.description_text), usesExpression(r.kind) ? k.text(r.kind === "dq_rule" ? "Check" : "Rule", r.expression, true) : null],
        [k.group("Traced to", traced), k.group("Break-down", snapshot.requirements.filter((y) => y.parent_id === r.id).map((y) => k.link("requirement", y.id, STATUS_NAMES[y.status])))],
      );
    }
    case "classification": {
      const c = m.classifications.find((x) => x.id === item.id)!;
      const carriers = m.classificationLinks
        .filter((l) => l.classification_id === c.id)
        .map((l) => (l.source_column_id ? k.link("source_column", l.source_column_id) : k.link("source_table", l.source_table_id)));
      return k.details(
        [k.fact("Code", c.code, { mono: true }), k.fact("Applies to", c.scope === "table" ? "Source tables" : "Source columns"), k.fact("Carried by", String(k.links(carriers).length))],
        [k.text("Definition", c.definition)],
        [k.group("Carried by", carriers)],
      );
    }
    case "stereotype": {
      const s = m.stereotypes.find((x) => x.id === item.id)!;
      const entities = m.entities.filter((e) => e.deleted_at === null && e.model_level === "logical" && e.stereotype === s.code);
      return k.details(
        [k.fact("Code", s.code, { mono: true }), k.fact("Carried by", `${entities.length} ${entities.length === 1 ? "entity" : "entities"}`)],
        [k.text("Definition", s.definition)],
        [k.group("Entities", entities.map((e) => k.link("entity", e.id)))],
      );
    }
    default:
      return null;
  }
}

/** The live classifications' names on a source table or column. */
function classNames(snapshot: WorkspaceSnapshot<ModuleTable>, id: Uuid): string[] {
  const live = new Map(snapshot.model.classifications.filter((c) => c.deleted_at === null).map((c) => [c.id, c.name]));
  return snapshot.model.classificationLinks
    .filter((l) => (l.source_column_id ?? l.source_table_id) === id)
    .map((l) => live.get(l.classification_id))
    .filter((n): n is string => !!n);
}
