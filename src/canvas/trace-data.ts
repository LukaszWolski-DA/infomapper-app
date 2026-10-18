// Trace lines (slice 4b-2, PRD item 8; prototype reqTraces): from each requirement card on the canvas to each element its
// requirement is linked to (direct links only), as plain data: the card and what the line ends at. An entity or table
// ends at its card, an attribute or column at its row of its card, a mapping at its line. An element whose card is not on
// the canvas gets no line. Where the line runs is worked out from the nodes (`traceGeom`, line-geometry.ts).

import type { Uuid } from "@/domain/ids";
import type { RequirementLink } from "@/domain/types";

export type TraceTarget = { t: "card"; cardId: Uuid } | { t: "row"; cardId: Uuid; rowId: Uuid } | { t: "map"; mappingId: Uuid };

export interface TraceData {
  /** `{requirement card id}|{link id}`: stable while the card and the link stay. */
  id: string;
  /** The requirement card's node id. */
  reqCardId: Uuid;
  target: TraceTarget;
}

export interface TraceLookup {
  /** The card of an entity or a source table on this canvas, if it has one. */
  cardOf: (kind: "ent" | "src", targetId: Uuid) => Uuid | undefined;
  /** An attribute's entity, a column's table. */
  entityOf: (attributeId: Uuid) => Uuid | undefined;
  tableOf: (columnId: Uuid) => Uuid | undefined;
  /** Whether a mapping is drawn on this canvas (its line data exists). */
  hasMapping: (mappingId: Uuid) => boolean;
}

/** The trace lines of the requirement cards on this canvas, in card order, then in link order. */
export function buildTraces(cards: readonly { id: Uuid; requirementId: Uuid }[], linksOf: (requirementId: Uuid) => readonly RequirementLink[], o: TraceLookup): TraceData[] {
  const out: TraceData[] = [];
  for (const card of cards) {
    for (const k of linksOf(card.requirementId)) {
      if (k.deleted_at !== null) continue;
      let target: TraceTarget | null = null;
      if (k.entity_id) {
        const cardId = o.cardOf("ent", k.entity_id);
        if (cardId) target = { t: "card", cardId };
      } else if (k.source_table_id) {
        const cardId = o.cardOf("src", k.source_table_id);
        if (cardId) target = { t: "card", cardId };
      } else if (k.attribute_id) {
        const entity = o.entityOf(k.attribute_id);
        const cardId = entity ? o.cardOf("ent", entity) : undefined;
        if (cardId) target = { t: "row", cardId, rowId: k.attribute_id };
      } else if (k.source_column_id) {
        const table = o.tableOf(k.source_column_id);
        const cardId = table ? o.cardOf("src", table) : undefined;
        if (cardId) target = { t: "row", cardId, rowId: k.source_column_id };
      } else if (k.mapping_id && o.hasMapping(k.mapping_id)) {
        target = { t: "map", mappingId: k.mapping_id };
      }
      if (target) out.push({ id: `${card.id}|${k.id}`, reqCardId: card.id, target });
    }
  }
  return out;
}
