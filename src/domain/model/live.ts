// Live label canvases (D-10, D-11, D-25; slice 3b) and the active working context (D-26): pure rules.
// - `liveMembership`: what a label brings onto its live canvas (prototype liveRequired, rowRelevant);
// - `syncLiveCanvas`: what a live canvas must change to show exactly that (prototype syncLive, without the “Newly
//   labeled” frame: Łukasz's answer to Q3, new cards land to the right of the content, one under another);
// - `liveRemoveQuestion`: what taking a card off a live canvas unlabels (prototype liveRemove);
// - `contextTargets`: what an action created or changed that the active context labels (prototype autoLabel).

import type { Write } from "../changes";
import type { Uuid } from "../ids";
import type { Attribute, CanvasItem, LabelLink, LiveLevel, Mapping, MappingInput, RowFilter, SourceColumn } from "../types";
import { cardHeightFor } from "./card-size";
import type { LabelTarget } from "./labels";

/** The model rows membership reads (live rows of one workspace; deleted ones are skipped by the caller). */
export interface LiveModel {
  attributes: readonly Pick<Attribute, "id" | "entity_id">[];
  sourceColumns: readonly Pick<SourceColumn, "id" | "source_table_id">[];
  mappings: readonly Pick<Mapping, "id" | "attribute_id">[];
  mappingInputs: readonly Pick<MappingInput, "mapping_id" | "source_column_id">[];
  /** Live label links (any label; the functions pick theirs). */
  links: readonly Pick<LabelLink, "label_id" | "entity_id" | "attribute_id" | "mapping_id" | "source_table_id" | "source_column_id">[];
}

export interface LiveMembership {
  /** Entities on the live canvas: full when the label is on the entity, context when only on its rows or mappings. */
  entities: Map<Uuid, LiveLevel>;
  /** Source tables, the same way (a combined mapping brings every input column's table). */
  tables: Map<Uuid, LiveLevel>;
  /** Attributes and columns that carry the label themselves or through one of their mappings (bold, `labeled` filter). */
  relevantRows: Set<Uuid>;
}

/** What label L brings onto its live canvas (PRD item 5). */
export function liveMembership(labelId: Uuid, model: LiveModel): LiveMembership {
  const entityOf = new Map(model.attributes.map((a) => [a.id, a.entity_id]));
  const tableOf = new Map(model.sourceColumns.map((c) => [c.id, c.source_table_id]));
  const mappingTarget = new Map(model.mappings.map((m) => [m.id, m.attribute_id]));
  const inputsOf = new Map<Uuid, Uuid[]>();
  for (const i of model.mappingInputs) inputsOf.set(i.mapping_id, [...(inputsOf.get(i.mapping_id) ?? []), i.source_column_id]);

  const entities = new Map<Uuid, LiveLevel>();
  const tables = new Map<Uuid, LiveLevel>();
  const relevantRows = new Set<Uuid>();
  const context = (map: Map<Uuid, LiveLevel>, id: Uuid | undefined) => {
    if (id !== undefined && !map.has(id)) map.set(id, "context");
  };
  for (const k of model.links) {
    if (k.label_id !== labelId) continue;
    if (k.entity_id) entities.set(k.entity_id, "full");
    else if (k.source_table_id) tables.set(k.source_table_id, "full");
  }
  for (const k of model.links) {
    if (k.label_id !== labelId) continue;
    if (k.attribute_id && entityOf.has(k.attribute_id)) {
      relevantRows.add(k.attribute_id);
      context(entities, entityOf.get(k.attribute_id));
    } else if (k.source_column_id && tableOf.has(k.source_column_id)) {
      relevantRows.add(k.source_column_id);
      context(tables, tableOf.get(k.source_column_id));
    } else if (k.mapping_id && mappingTarget.has(k.mapping_id)) {
      const attributeId = mappingTarget.get(k.mapping_id)!;
      if (entityOf.has(attributeId)) {
        relevantRows.add(attributeId);
        context(entities, entityOf.get(attributeId));
      }
      for (const columnId of inputsOf.get(k.mapping_id) ?? []) {
        if (!tableOf.has(columnId)) continue;
        relevantRows.add(columnId);
        context(tables, tableOf.get(columnId));
      }
    }
  }
  return { entities, tables, relevantRows };
}

// ---- keeping a live canvas in sync (PRD item 7) ----

/** A card a live canvas needs: its element, level and row filter. */
export interface LiveTarget {
  kind: "entity" | "source_table";
  id: Uuid;
  level: LiveLevel;
}

export interface LiveSync {
  /** Cards whose element no longer carries the label: they leave the canvas. */
  leave: CanvasItem[];
  /** Cards that change between full and context: their new level and row filter. */
  relevel: { item: CanvasItem; level: LiveLevel; rowFilter: RowFilter }[];
  /** Elements newly required: where their card goes (to the right of the content, one under another) and its filter. */
  add: (LiveTarget & { x: number; y: number; rowFilter: RowFilter })[];
}

/** Gaps of the cards a sync adds (prototype syncLive: 160 to the right of the content, 32 between cards). */
export const LIVE_ADD_GAP = { right: 160, between: 32 } as const;

const snap8 = (v: number) => Math.round(v / 8) * 8;

/** The row filter a card gets for its level: full cards show every row, context cards the relevant ones. */
export const liveRowFilter = (level: LiveLevel): RowFilter => (level === "full" ? "all" : "labeled");

/**
 * What a live canvas changes to show exactly what its label marks. `items` are the canvas's live cards, `boxes` the
 * places of everything on it (cards with their heights, frames) for where new cards go, `heightOf` the height a new
 * card will have. Layout the person made is never rearranged: staying cards keep their places; a card that changes
 * level switches its filter only from `labeled` to `all` or back, other filters stay. A box with an `itemId` is that
 * card's and does not count when the card leaves. New cards are ordered tables
 * first, then entities (as the prototype), by the order the caller gives.
 */
export function syncLiveCanvas(
  items: readonly CanvasItem[],
  membership: LiveMembership,
  boxes: readonly { x: number; y: number; w: number; itemId?: Uuid }[],
  heightOf: (target: LiveTarget, rowFilter: RowFilter) => number,
  order: { tables: readonly Uuid[]; entities: readonly Uuid[] } = { tables: [...membership.tables.keys()], entities: [...membership.entities.keys()] },
): LiveSync {
  const leave: CanvasItem[] = [];
  const relevel: LiveSync["relevel"] = [];
  const here = new Set<Uuid>();
  for (const item of items) {
    const level = item.entity_id ? membership.entities.get(item.entity_id) : item.source_table_id ? membership.tables.get(item.source_table_id) : undefined;
    if (!level) {
      leave.push(item);
      continue;
    }
    here.add((item.entity_id ?? item.source_table_id)!);
    if (item.live_level === level) continue;
    let rowFilter = item.row_filter;
    if (level === "full" && rowFilter === "labeled") rowFilter = "all";
    if (level === "context" && rowFilter === "all") rowFilter = "labeled";
    relevel.push({ item, level, rowFilter });
  }

  const missing: LiveTarget[] = [
    ...order.tables.filter((id) => membership.tables.has(id) && !here.has(id)).map((id) => ({ kind: "source_table" as const, id, level: membership.tables.get(id)! })),
    ...order.entities.filter((id) => membership.entities.has(id) && !here.has(id)).map((id) => ({ kind: "entity" as const, id, level: membership.entities.get(id)! })),
  ];
  const add: LiveSync["add"] = [];
  if (missing.length) {
    const gone = new Set(leave.map((i) => i.id));
    const staying = boxes.filter((b) => !b.itemId || !gone.has(b.itemId));
    let x1 = -Infinity, y0 = Infinity;
    for (const b of staying) {
      x1 = Math.max(x1, b.x + b.w);
      y0 = Math.min(y0, b.y);
    }
    const x = snap8(x1 > -Infinity ? x1 + LIVE_ADD_GAP.right : 0);
    let y = snap8(y0 < Infinity ? y0 : 0);
    for (const t of missing) {
      const rowFilter = liveRowFilter(t.level);
      add.push({ ...t, x, y, rowFilter });
      y = snap8(y + heightOf(t, rowFilter) + LIVE_ADD_GAP.between);
    }
  }
  return { leave, relevel, add };
}

/** The height of a card on a live canvas: all its rows when full, the relevant ones when context (`labeled`). */
export function liveCardHeight(rowIds: readonly Uuid[], rowFilter: RowFilter, membership: LiveMembership): number {
  if (rowFilter !== "labeled") return cardHeightFor(rowIds.length);
  let n = 0;
  for (const id of rowIds) if (membership.relevantRows.has(id)) n++;
  return cardHeightFor(n);
}

// ---- taking a card off a live canvas (PRD item 11) ----

type LinkLike = LiveModel["links"][number];

export interface LiveRemoveQuestion<K = LinkLike> {
  /** The label is on the element itself: taking it off keeps the card as context when rows or mappings carry it too. */
  direct: K | null;
  /** Links on its attributes or columns. */
  viaRows: K[];
  /** Links on mappings into its attributes (an entity) or from its columns (a table). */
  viaMappings: K[];
}

/** What brings an element onto label L's live canvas, so the question can name it and the command unlabel it. */
export function liveRemoveQuestion<K extends LinkLike>(
  labelId: Uuid,
  target: { kind: "entity" | "source_table"; id: Uuid },
  model: Omit<LiveModel, "links"> & { links: readonly K[] },
): LiveRemoveQuestion<K> {
  const rowsOf = new Set(
    target.kind === "entity"
      ? model.attributes.filter((a) => a.entity_id === target.id).map((a) => a.id)
      : model.sourceColumns.filter((c) => c.source_table_id === target.id).map((c) => c.id),
  );
  const mappingsHere = new Set(
    target.kind === "entity"
      ? model.mappings.filter((m) => rowsOf.has(m.attribute_id)).map((m) => m.id)
      : model.mappingInputs.filter((i) => rowsOf.has(i.source_column_id)).map((i) => i.mapping_id),
  );
  const mine = model.links.filter((k) => k.label_id === labelId);
  return {
    direct: mine.find((k) => (target.kind === "entity" ? k.entity_id : k.source_table_id) === target.id) ?? null,
    viaRows: mine.filter((k) => {
      const row = target.kind === "entity" ? k.attribute_id : k.source_column_id;
      return row !== null && rowsOf.has(row);
    }),
    viaMappings: mine.filter((k) => k.mapping_id !== null && mappingsHere.has(k.mapping_id)),
  };
}

/** “2 attributes and 1 mapping” (prototype liveRemove's `what`). */
export function liveRemoveWhat(q: LiveRemoveQuestion<unknown>, kind: "entity" | "source_table"): string {
  const row = kind === "entity" ? "attribute" : "column";
  const parts: string[] = [];
  if (q.viaRows.length) parts.push(`${q.viaRows.length} ${row}${q.viaRows.length > 1 ? "s" : ""}`);
  if (q.viaMappings.length) parts.push(`${q.viaMappings.length} mapping${q.viaMappings.length > 1 ? "s" : ""}`);
  return parts.join(" and ");
}

// ---- the active working context (D-26, PRD item 2) ----

/** Columns that are bookkeeping, not a change of the item (a version bump alone changes nothing). */
const BOOKKEEPING = new Set(["version", "updated_at", "updated_by"]);

const changedColumns = (before: object, after: object): string[] =>
  Object.keys(after).filter((k) => !BOOKKEEPING.has(k) && JSON.stringify((before as Record<string, unknown>)[k]) !== JSON.stringify((after as Record<string, unknown>)[k]));


/**
 * What an action created or changed that the active context labels: entities, attributes and mappings created or
 * changed, both entities of a relationship created or changed, the mapping whose inputs changed. Not deletions, not
 * layout, labels, concepts, source tables or columns. An attribute whose only change is its place in the order
 * (`sort_order`, renumbered when another attribute moves) is not labeled unless the action names it as its main
 * target (the attribute moved: Łukasz's answer to Q2). Items deleted by the same action are left out.
 */
export function contextTargets(writes: readonly Write[], mainTargets: readonly LabelTarget[] = []): LabelTarget[] {
  const out = new Map<string, LabelTarget>();
  const add = (kind: LabelTarget["kind"], id: Uuid) => out.set(`${kind}:${id}`, { kind, id });
  const deleted = new Set<string>();
  for (const w of writes) {
    if (w.kind === "remove") continue;
    if (w.kind === "update" && "deleted_at" in w.row && w.row.deleted_at !== null) {
      if (w.table === "entity" || w.table === "attribute" || w.table === "mapping") deleted.add(`${w.table}:${w.before.id}`);
      if (w.table !== "mapping_input") continue;
    }
    switch (w.table) {
      case "entity":
        add("entity", w.row.id);
        break;
      case "attribute":
        if (w.kind === "insert" || (w.kind === "update" && changedColumns(w.before, w.row).some((c) => c !== "sort_order"))) add("attribute", w.row.id);
        break;
      case "mapping":
        add("mapping", w.row.id);
        break;
      case "mapping_input":
        add("mapping", w.row.mapping_id);
        break;
      case "relationship":
        add("entity", w.row.from_entity_id);
        add("entity", w.row.to_entity_id);
        break;
    }
  }
  for (const t of mainTargets) add(t.kind, t.id);
  return [...out.values()].filter((t) => !deleted.has(`${t.kind}:${t.id}`));
}
