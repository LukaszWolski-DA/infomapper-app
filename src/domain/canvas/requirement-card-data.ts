// Requirement cards (slice 4b-2, D-41; prototype renderReqCards, .rq-card): what the canvas draws for a requirement's
// card, as plain serialisable data built on the server from the canvas's cards and the requirement index. Pure
// TypeScript, so it is tested without a browser.

import type { Uuid } from "@/domain/ids";
import { REQUIREMENT_CARD_WIDTH } from "@/domain/model/card-kinds";
import type { RequirementIndex } from "@/domain/model/requirement-index";
import { coverageBar, KIND_NAMES, STATUS_NAMES } from "@/domain/model/requirements";
import type { CanvasItem, RequirementKind, RequirementStatus } from "@/domain/types";
import { requirementNameLines } from "./text-fit";

export interface RequirementCardData {
  /** The canvas_item id; also the React Flow node id. */
  id: Uuid;
  version: number;
  requirementId: Uuid;
  key: string;
  kind: RequirementKind;
  kindName: string;
  name: string;
  status: RequirementStatus;
  statusName: string;
  /** The first 300 characters of the description as plain text: the card's tooltip (PRD item 1). */
  title: string;
  /** The bar's three parts over the items (PRD item 2), and how many items there are. */
  bar: { covered: number; mapped: number; notMapped: number };
  total: number;
  /** How many lines the name wraps to (`requirementNameLines`): the card's height follows from it. */
  nameLines: number;
  x: number;
  y: number;
  /** When the card was placed (server time; `mergeFresh`). */
  createdAt: string;
}

/** The parts of a requirement card, in px (canvas.css `.rq-card`): header, name padding and line, bar, footer. */
export const REQ_CARD = { width: REQUIREMENT_CARD_WIDTH, headH: 26, namePad: 14, nameLine: 17, barH: 11, footH: 26 } as const;

/** A requirement card's height: from its name's lines (the card is drawn at this height at every zoom). */
export const requirementCardHeight = (nameLines: number): number =>
  REQ_CARD.headH + REQ_CARD.namePad + Math.max(1, nameLines) * REQ_CARD.nameLine + REQ_CARD.barH + REQ_CARD.footH;

/** The height a requirement card of this name will have, before it is drawn (placing, PRD item 15). */
export const requirementCardHeightOf = (name: string): number => requirementCardHeight(requirementNameLines(name));

/** “{m} of {n} covered”, or “nothing traced yet” without items (PRD item 1). */
export const coverageText = (c: Pick<RequirementCardData, "bar" | "total">): string => (c.total ? `${c.bar.covered} of ${c.total} covered` : "nothing traced yet");

/** The bar's tooltip (PRD item 2). */
export const barTitle = (c: Pick<RequirementCardData, "bar">): string =>
  `${c.bar.covered} covered, ${c.bar.mapped} mapped but not approved, ${c.bar.notMapped} not mapped`;

/** The requirement cards of one canvas (its live cards with a requirement); a card whose requirement is gone is left out. */
export function buildRequirementCards(items: readonly CanvasItem[], index: RequirementIndex): RequirementCardData[] {
  const out: RequirementCardData[] = [];
  for (const item of items) {
    if (item.deleted_at !== null || item.requirement_id === null) continue;
    const r = index.byId.get(item.requirement_id);
    if (!r) continue;
    const c = index.coverage(r.id);
    out.push({
      id: item.id,
      version: item.version,
      requirementId: r.id,
      key: r.key,
      kind: r.kind,
      kindName: KIND_NAMES[r.kind],
      name: r.name,
      status: r.status,
      statusName: STATUS_NAMES[r.status],
      title: (r.description_text ?? "").slice(0, 300),
      bar: coverageBar(c),
      total: c.total,
      nameLines: requirementNameLines(r.name),
      x: item.x,
      y: item.y,
      createdAt: item.created_at,
    });
  }
  return out;
}
