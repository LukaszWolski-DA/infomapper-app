"use client";

// Fading on the canvas (slice 4p; slice 4b-1): what a request (`fade.ts`) lights on this canvas (the domain's `focusLit`
// / `requirementFocusLit`, or a lit set given directly, mapped onto cards, blocks, notes, rows and lines), and rows tinted
// covered or gap in the overlay above the cards (`LitRows`). The veil is `FadeLayer.tsx`'s. Slice 4b-2, step 6: the
// requirement cards a Focus lights (the domain's `litRequirements`, PRD item 21, C) and the trace lines with both ends lit.

import { memo, useMemo } from "react";
import { useStore, type InternalNode } from "@xyflow/react";
import type { Uuid } from "@/domain/ids";
import { litRequirements, mergeLit, requirementFocusLit, targetLit, type Lit, type LitModel, type LitRowColour } from "@/domain/model/lit";
import { buildRequirementIndex } from "@/domain/model/requirement-index";
import type { ScopeModel } from "@/domain/model/requirements";
import type { Requirement, RequirementLink, SourceChange, WorkspaceModel } from "@/domain/types";
import type { BlockNodeT } from "./BlockNode";
import type { CardNodeT } from "./CardNode";
import type { ReqNodeT } from "./RequirementCardNode";
import type { TraceData } from "./trace-data";
import { fadeKey, focusTarget, useFadeRequest } from "./fade";
import { cardWidth, LOD_ZOOM, ROW_H, rowEnd, type Rect } from "./geometry";

/**
 * What the canvas needs to work out a lit set: the live model and the requirements (the page has them). The source
 * systems tell a history place of a system that is gone (slice 7a).
 */
export interface FadeData {
  model: LitModel & ScopeModel & Pick<WorkspaceModel, "sourceSystems">;
  requirements: readonly Requirement[];
  requirementLinks: readonly RequirementLink[];
  /** The workspace's changes to resolve, for the Changes view (slice 7b, `ChangesDriver`). */
  changes?: readonly SourceChange[];
}

/** A note as fading sees it: where it is drawn and the card it is pinned to. */
export interface FadeNote {
  id: Uuid;
  rect: Rect;
  pinCardId: Uuid | null;
}

/**
 * The request asked for now, its key, and what it lights in the model; null with fading off. A Focus request also says
 * which requirement cards stay lit (slice 4b-2, PRD item 21); a multi-selection's requirements light their scopes too.
 */
export function useLit(data: FadeData | undefined): { key: string; lit: Lit } | null {
  const request = useFadeRequest();
  const index = useRequirementIndex(data);
  return useMemo(() => {
    if (!request) return null;
    if ("lit" in request) return { key: fadeKey(request), lit: request.lit };
    if (!data) return null;
    const target = focusTarget(request.focus);
    let lit: Lit;
    if (target.t === "requirement") {
      if (!index?.byId.has(target.id)) return null;
      lit = requirementFocusLit(data.model, index.scope(target.id));
    } else {
      lit = targetLit(data.model, target);
      if (target.t === "several" && index) for (const r of target.requirements ?? []) if (index.byId.has(r)) mergeLit(lit, requirementFocusLit(data.model, index.scope(r)));
    }
    if (index) lit.requirements = litRequirements(data.model, target, index.byId.keys(), index.scope);
    return { key: fadeKey(request), lit };
  }, [request, data, index]);
}

/**
 * The canvas's requirement index (slice 4b-1, step 4): built once per data version (the page's model, requirements and
 * links), not per Focus request. The inspector builds its own from the same data; the canvas cannot read the app
 * layer's context (AD-19).
 */
export function useRequirementIndex(data: FadeData | undefined) {
  const model = data?.model, requirements = data?.requirements, links = data?.requirementLinks;
  return useMemo(() => (model && requirements && links ? buildRequirementIndex([...requirements], [...links], model) : null), [model, requirements, links]);
}

type AnyNode = InternalNode;

/** Whether a card node shows a lit entity or table. */
export const isLitCard = (n: AnyNode, lit: Lit): boolean => {
  if (n.type !== "card") return false;
  const c = (n as unknown as CardNodeT).data.card;
  return c.kind === "ent" ? lit.entities.has(c.targetId) : lit.tables.has(c.targetId);
};

/** Whether a node is a requirement card whose requirement is lit (slice 4b-2, PRD item 20). */
export const isLitReqCard = (n: AnyNode, lit: Lit): boolean => n.type === "req" && !!lit.requirements?.has((n as unknown as ReqNodeT).data.card.requirementId);

/**
 * The React Flow nodes that stay lit: the cards of lit entities and tables that are drawn, the block of a collapsed
 * frame when one of its hidden cards is lit (prototype: a frame stays lit when a member is), and the lit requirement
 * cards (slice 4b-2; never in a block).
 */
export function litNodeIds(lookup: Map<string, AnyNode>, lit: Lit): Set<string> {
  const out = new Set<string>();
  const litFrames = new Set<string>();
  for (const [id, n] of lookup) {
    if (isLitReqCard(n, lit)) out.add(id);
    if (!isLitCard(n, lit)) continue;
    if (!n.hidden) out.add(id);
    else {
      const frameId = (n as unknown as CardNodeT).data.card.frameId;
      if (frameId) litFrames.add(frameId);
    }
  }
  for (const [id, n] of lookup) if (n.type === "block" && litFrames.has((n as unknown as BlockNodeT).data.frame.id)) out.add(id);
  return out;
}

/**
 * The trace lines that stay lit (slice 4b-2, PRD item 21): both ends lit, the requirement card and the element (an
 * entity's or table's card, also hidden in a collapsed frame; a row's card; a mapping). The rest fade with the veil.
 */
export function litTraces(traces: readonly TraceData[], lookup: Map<string, AnyNode>, lit: Lit): TraceData[] {
  if (!lit.requirements?.size) return [];
  return traces.filter((t) => {
    const req = lookup.get(t.reqCardId);
    if (!req || !isLitReqCard(req, lit)) return false;
    if (t.target.t === "map") return lit.mappings.has(t.target.mappingId);
    const card = lookup.get(t.target.cardId);
    return !!card && isLitCard(card, lit);
  });
}

/** A node's rectangle as React Flow measured it. */
export const nodeRect = (n: AnyNode): Rect => ({ x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w: n.measured.width ?? 0, h: n.measured.height ?? 0 });

/** The bar's width: inside the row's 12 px left padding (canvas.css `.row`). */
const ROW_BAR = 4;

/**
 * Rows marked covered (blue) or gap (orange) above the cards (prototype `.row.rq`, `.row.gap`); none below 40 %. The
 * overlay lies above the text, so each row gets a faint fill that keeps its text at 4.5:1 (canvas.css) and a bar in the
 * full colour in the row's left padding, where no text is.
 */
export const LitRows = memo(function LitRows({ rows, testId = "lit-row" }: { rows: ReadonlyMap<Uuid, LitRowColour>; testId?: string }) {
  useStore((s) => s.nodes); // follow drags, collapses and widths
  const lod = useStore((s) => s.transform[2] < LOD_ZOOM);
  const lookup = useStore((s) => s.nodeLookup);
  if (lod || rows.size === 0) return null;
  const marks: { key: string; colour: LitRowColour; x: number; y: number; w: number }[] = [];
  for (const [id, n] of lookup) {
    if (n.type !== "card" || n.hidden) continue;
    const card = (n as unknown as CardNodeT).data.card;
    const { x, y } = n.internals.positionAbsolute;
    for (const r of card.rows) {
      const colour = rows.get(r.id);
      if (!colour) continue;
      const end = rowEnd({ x, y, card }, r.id);
      if (!end.hidden) marks.push({ key: `${id}|${r.id}`, colour, x, y: end.y - ROW_H / 2, w: cardWidth(card) });
    }
  }
  if (!marks.length) return null;
  return (
    <svg className="hover-layer lit-rows" width={1} height={1} data-testid={`layer-${testId}s`}>
      {marks.map((m) => (
        <g key={m.key} data-testid={`${testId}-${m.colour}`} data-row={m.key.split("|")[1]}>
          <rect className={m.colour} x={m.x} y={m.y} width={m.w} height={ROW_H} />
          <rect className={`bar ${m.colour}`} x={m.x} y={m.y} width={ROW_BAR} height={ROW_H} />
        </g>
      ))}
    </svg>
  );
});
