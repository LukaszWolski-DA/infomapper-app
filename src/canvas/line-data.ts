// The lines of one canvas, as plain data: mappings (with all their inputs, D-49) and relationships between the cards
// on it, built on the server next to the cards. Which lines a selection emphasises is decided here too.

import type { Uuid } from "@/domain/ids";
import { checkMappingTypes } from "@/domain/model/type-check";
import type { CardinalityMax, CardinalityMin, MappingKind, MappingStatus, WorkspaceModel } from "@/domain/types";
import type { CardData } from "./card-data";
import type { SelectionKey } from "./selection";

export interface MapLineData {
  /** The mapping id. */
  id: Uuid;
  status: MappingStatus;
  kind: MappingKind;
  /** A transform with a rule (the ƒ chip on a one-input line). */
  ruled: boolean;
  /** A type problem (D-01): orange line and a "!" chip. */
  warn: boolean;
  /** Inputs whose source card is on this canvas, in rule order. */
  inputs: { columnId: Uuid; cardId: Uuid }[];
  /** How many inputs the mapping has in all; more than one draws the ƒ node (D-49). */
  inputCount: number;
  attributeId: Uuid;
  /** The entity card of the attribute. */
  cardId: Uuid;
}

export interface RelLineData {
  id: Uuid;
  fromCardId: Uuid;
  toCardId: Uuid;
  label: string | null;
  fromMin: CardinalityMin;
  fromMax: CardinalityMax;
  toMin: CardinalityMin;
  toMax: CardinalityMax;
  /** Parallel relationships between the same two entities are drawn 16 px apart, as in the prototype. */
  offset: number;
}

export interface CanvasLines {
  mappings: MapLineData[];
  relationships: RelLineData[];
}

/** Mapping lines need the attribute's card and at least one input card; relationships need both entity cards. */
export function buildLines(model: WorkspaceModel, cards: readonly CardData[]): CanvasLines {
  const entityCard = new Map(cards.filter((c) => c.kind === "ent").map((c) => [c.targetId, c.id]));
  const tableCard = new Map(cards.filter((c) => c.kind === "src").map((c) => [c.targetId, c.id]));
  const attributeById = new Map(model.attributes.map((a) => [a.id, a]));
  const columnById = new Map(model.sourceColumns.map((c) => [c.id, c]));
  const inputsOf = new Map<Uuid, Uuid[]>();
  for (const i of [...model.mappingInputs].sort((a, b) => a.sort_order - b.sort_order)) {
    inputsOf.set(i.mapping_id, [...(inputsOf.get(i.mapping_id) ?? []), i.source_column_id]);
  }

  const mappings: MapLineData[] = [];
  for (const m of model.mappings) {
    const attribute = attributeById.get(m.attribute_id);
    const cardId = attribute && entityCard.get(attribute.entity_id);
    if (!attribute || !cardId) continue;
    const columns = (inputsOf.get(m.id) ?? []).map((id) => columnById.get(id)).filter((c) => c !== undefined);
    const inputs = columns.flatMap((c) => {
      const source = tableCard.get(c.source_table_id);
      return source ? [{ columnId: c.id, cardId: source }] : [];
    });
    if (!inputs.length) continue;
    mappings.push({
      id: m.id,
      status: m.status,
      kind: m.kind,
      ruled: m.kind === "transform" && !!m.rule_expression?.trim(),
      warn: !checkMappingTypes(m, attribute, columns).ok,
      inputs,
      inputCount: columns.length,
      attributeId: attribute.id,
      cardId,
    });
  }

  const pairs = new Map<string, number>();
  const relationships: RelLineData[] = [];
  for (const r of model.relationships) {
    const from = entityCard.get(r.from_entity_id), to = entityCard.get(r.to_entity_id);
    if (!from || !to) continue;
    const key = [from, to].sort().join("|");
    const n = (pairs.get(key) ?? 0) + 1;
    pairs.set(key, n);
    relationships.push({
      id: r.id,
      fromCardId: from,
      toCardId: to,
      label: r.label,
      fromMin: r.from_min,
      fromMax: r.from_max,
      toMin: r.to_min,
      toMax: r.to_max,
      offset: (n - 1) * 16,
    });
  }
  return { mappings, relationships };
}

/** What is selected on the canvas; a hovered row or line uses the same shape (slice 1b, C-10). */
export type Selection =
  | { t: "card"; id: Uuid }
  /** Two or more cards (slice 2a): their keys, see `selection.ts`. */
  | { t: "multi"; keys: readonly SelectionKey[] }
  | { t: "row"; cardId: Uuid; id: Uuid }
  | { t: "map"; id: Uuid }
  | { t: "rel"; id: Uuid }
  /** A frame (slice 2b): its name or an empty spot inside it was clicked. */
  | { t: "frame"; id: Uuid }
  | null;

export interface Related {
  maps: Set<Uuid>;
  rels: Set<Uuid>;
}

/**
 * The lines a selection emphasises (prototype relatedOf); every other line fades. A row: its mappings. A line: itself.
 * A selected card fades nothing: in the prototype that belongs to Focus mode, a later slice.
 */
export function relatedLines(sel: Selection, lines: CanvasLines): Related | null {
  if (!sel || sel.t === "card" || sel.t === "multi" || sel.t === "frame") return null;
  const maps = new Set<Uuid>(), rels = new Set<Uuid>();
  switch (sel.t) {
    case "map":
      maps.add(sel.id);
      break;
    case "rel":
      rels.add(sel.id);
      break;
    case "row":
      for (const m of lines.mappings) {
        if (m.attributeId === sel.id || m.inputs.some((i) => i.columnId === sel.id)) maps.add(m.id);
      }
      break;
  }
  return { maps, rels };
}

/** The rows a hover marks: the hovered row and the rows at the other end of its mappings, or a mapping's rows. */
export function hoverRows(hover: Selection, lines: CanvasLines): { cardId: string; rowId: string }[] {
  if (!hover || (hover.t !== "row" && hover.t !== "map")) return [];
  const out = new Map<string, { cardId: string; rowId: string }>();
  const add = (cardId: string, rowId: string) => out.set(`${cardId}|${rowId}`, { cardId, rowId });
  if (hover.t === "row") add(hover.cardId, hover.id);
  for (const m of lines.mappings) {
    const hit = hover.t === "map" ? m.id === hover.id : m.attributeId === hover.id || m.inputs.some((i) => i.columnId === hover.id);
    if (!hit) continue;
    add(m.cardId, m.attributeId);
    for (const i of m.inputs) add(i.cardId, i.columnId);
  }
  return [...out.values()];
}
