// What a canvas card shows (slice 4b-2): an element (an entity or a source table) or a requirement. Requirement cards
// are layout only: they are never frame members, carry no label on a live canvas and hold no pinned notes (PRD items
// 6, G, N), so the rules for element cards filter them out with these.

import type { CanvasItem } from "../types";

/** A requirement's card (`requirement_id` set). */
export const isRequirementCard = (item: Pick<CanvasItem, "requirement_id">): boolean => item.requirement_id !== null;

/** An entity's or a source table's card. */
export const isElementCard = (item: Pick<CanvasItem, "requirement_id">): boolean => item.requirement_id === null;

/** The width a requirement card is drawn at (D-41, prototype `.rq-card`); it is not resizable and stores no width. */
export const REQUIREMENT_CARD_WIDTH = 230;
