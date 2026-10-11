// Working labels (D-08, D-24, slice 3a): how a typed name becomes a label name, what a label marks, and the suggestions
// of the Labels field (prototype normLabel, showLblSug).

import type { Uuid } from "../ids";
import type { Label, LabelLink } from "../types";

/** The longest label name (prototype normLabel). */
export const LABEL_NAME_MAX = 60;

/** At most this many existing labels are suggested. */
export const LABEL_SUGGESTIONS_MAX = 8;

/** A typed name as a label name: trimmed, commas removed, spaces become hyphens, at most 60 characters. */
export const normalizeLabelName = (value: string): string =>
  String(value).trim().replace(/,/g, "").replace(/\s+/g, "-").slice(0, LABEL_NAME_MAX);

/** The case-insensitive key the unique name rule uses (`label.name_key`, SQL `lower(name)`). */
export const labelKey = (name: string): string => name.toLowerCase();

/** What a label can mark (AD-15, D-24): one of the five target columns of `label_link`. */
export const LABEL_TARGET_KINDS = ["entity", "attribute", "mapping", "source_table", "source_column"] as const;
export type LabelTargetKind = (typeof LABEL_TARGET_KINDS)[number];

export interface LabelTarget {
  kind: LabelTargetKind;
  id: Uuid;
}

const COLUMN: Record<LabelTargetKind, keyof LabelLink> = {
  entity: "entity_id",
  attribute: "attribute_id",
  mapping: "mapping_id",
  source_table: "source_table_id",
  source_column: "source_column_id",
};

/** The five target columns of a link to this item: its own id in one, null in the others. */
export function targetColumns(target: LabelTarget): Pick<LabelLink, "entity_id" | "attribute_id" | "mapping_id" | "source_table_id" | "source_column_id"> {
  return {
    entity_id: target.kind === "entity" ? target.id : null,
    attribute_id: target.kind === "attribute" ? target.id : null,
    mapping_id: target.kind === "mapping" ? target.id : null,
    source_table_id: target.kind === "source_table" ? target.id : null,
    source_column_id: target.kind === "source_column" ? target.id : null,
  };
}

/** The item a link marks, or null when it breaks the “exactly one target” rule. */
export function targetOf(link: LabelLink): LabelTarget | null {
  const set = LABEL_TARGET_KINDS.filter((k) => link[COLUMN[k]] !== null);
  return set.length === 1 ? { kind: set[0]!, id: link[COLUMN[set[0]!]] as Uuid } : null;
}

export const marks = (link: LabelLink, target: LabelTarget): boolean => link[COLUMN[target.kind]] === target.id;

const live = <R extends { deleted_at: string | null }>(rows: readonly R[]): R[] => rows.filter((r) => r.deleted_at === null);

/** How many items each label marks (live links). */
export function labelItemCounts(links: readonly LabelLink[]): Map<Uuid, number> {
  const counts = new Map<Uuid, number>();
  for (const l of live(links)) counts.set(l.label_id, (counts.get(l.label_id) ?? 0) + 1);
  return counts;
}

/** The live label with this name in any case, if there is one. */
export const labelNamed = (labels: readonly Label[], name: string): Label | null =>
  live(labels).find((l) => l.name_key === labelKey(name)) ?? null;

export interface LabelSuggestions {
  /** What the person typed, normalised, when no label has that name yet: “Create “{name}”” comes first. */
  create: string | null;
  /** Existing labels the item does not have, matching what was typed: exact match first, then by how many items they mark, then by name; at most 8. */
  labels: Label[];
}

/**
 * The Labels field's suggestions (prototype showLblSug). `have` are the labels the item already has; they are not
 * suggested. With nothing typed, every other label is suggested.
 */
export function labelSuggestions(labels: readonly Label[], links: readonly LabelLink[], typed: string, have: ReadonlySet<Uuid>): LabelSuggestions {
  const name = normalizeLabelName(typed);
  const q = labelKey(name);
  const counts = labelItemCounts(links);
  const all = live(labels);
  const exact = (l: Label) => (l.name_key === q ? 0 : 1);
  const matching = all
    .filter((l) => !have.has(l.id) && (!q || l.name_key.includes(q)))
    .sort((a, b) => exact(a) - exact(b) || (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.name.localeCompare(b.name))
    .slice(0, LABEL_SUGGESTIONS_MAX);
  return { create: q && !all.some((l) => l.name_key === q) ? name : null, labels: matching };
}

/** An item as a key of `labelNamesByItem`: `attribute:<id>`, `mapping:<id>`, … */
export const itemKey = (target: LabelTarget): string => `${target.kind}:${target.id}`;

/** The names of the labels on each item (live links of live labels), sorted, for the canvas marks and their tooltips. */
export function labelNamesByItem(labels: readonly Label[], links: readonly LabelLink[]): Map<string, string[]> {
  const names = new Map(live(labels).map((l) => [l.id, l.name]));
  const out = new Map<string, string[]>();
  for (const k of live(links)) {
    const name = names.get(k.label_id);
    const target = targetOf(k);
    if (!name || !target) continue;
    const key = itemKey(target);
    out.set(key, [...(out.get(key) ?? []), name]);
  }
  for (const list of out.values()) list.sort((a, b) => a.localeCompare(b));
  return out;
}

/** What `projectLabels` needs to tell whether an item is on one of the project's canvases. */
export interface ProjectLabelContext {
  /** Entities and source tables with a card on one of the project's canvases. */
  entitiesHere: ReadonlySet<Uuid>;
  tablesHere: ReadonlySet<Uuid>;
  /** The entity of each attribute, the table of each column. */
  entityOfAttribute: ReadonlyMap<Uuid, Uuid>;
  tableOfColumn: ReadonlyMap<Uuid, Uuid>;
  /** The attribute of each mapping and the columns it reads. */
  mappingEnds: ReadonlyMap<Uuid, { attributeId: Uuid; columnIds: readonly Uuid[] }>;
}

/**
 * The labels of a project's home (D-29, prototype projLabels): the labels pinned to it, and those marking an item on
 * one of its canvases (an entity or table with a card there, an attribute or column of one, a mapping with an end on
 * one). Pinned ones first, then by how many items they mark, then by name. A pinned label is listed also when no canvas
 * uses it (Łukasz, step 0).
 */
export function projectLabels(
  labels: readonly Label[],
  links: readonly LabelLink[],
  pinned: ReadonlySet<Uuid>,
  here: ProjectLabelContext,
): { label: Label; items: number; pinned: boolean }[] {
  const onCanvas = (t: LabelTarget): boolean => {
    switch (t.kind) {
      case "entity":
        return here.entitiesHere.has(t.id);
      case "source_table":
        return here.tablesHere.has(t.id);
      case "attribute":
        return here.entitiesHere.has(here.entityOfAttribute.get(t.id) ?? "");
      case "source_column":
        return here.tablesHere.has(here.tableOfColumn.get(t.id) ?? "");
      case "mapping": {
        const m = here.mappingEnds.get(t.id);
        return !!m && (here.entitiesHere.has(here.entityOfAttribute.get(m.attributeId) ?? "") || m.columnIds.some((c) => here.tablesHere.has(here.tableOfColumn.get(c) ?? "")));
      }
    }
  };
  const ids = new Set([...pinned]);
  for (const k of live(links)) {
    const t = targetOf(k);
    if (t && onCanvas(t)) ids.add(k.label_id);
  }
  const counts = labelItemCounts(links);
  return live(labels)
    .filter((l) => ids.has(l.id))
    .map((label) => ({ label, items: counts.get(label.id) ?? 0, pinned: pinned.has(label.id) }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.items - a.items || a.label.name.localeCompare(b.label.name));
}
