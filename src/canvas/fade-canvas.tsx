"use client";

// Fading on the canvas (slice 4p, step 2), what every candidate shares: the request (`fade.ts`), what it lights on this
// canvas (the domain's `focusLit` / `lensLit` mapped onto cards, blocks, notes, rows and lines), and the lens's row
// colours drawn in the overlay above the cards. How the rest is faded is the candidate's own (`FadeLayer.tsx`).

import { memo, useMemo } from "react";
import { useStore, type InternalNode } from "@xyflow/react";
import type { Uuid } from "@/domain/ids";
import { focusLit, lensLit, type Lit, type LitModel, type LitRowColour } from "@/domain/model/lit";
import { buildRequirementIndex } from "@/domain/model/requirement-index";
import type { ScopeModel } from "@/domain/model/requirements";
import type { Requirement, RequirementLink } from "@/domain/types";
import type { BlockNodeT } from "./BlockNode";
import type { CardNodeT } from "./CardNode";
import { fadeKey, useFadeRequest } from "./fade";
import { cardWidth, LOD_ZOOM, ROW_H, rowEnd, type Rect } from "./geometry";

/** What the canvas needs to work out a lit set: the live model and the requirements (the page has them). */
export interface FadeData {
  model: LitModel & ScopeModel;
  requirements: readonly Requirement[];
  requirementLinks: readonly RequirementLink[];
}

/** A note as fading sees it: where it is drawn and the card it is pinned to. */
export interface FadeNote {
  id: Uuid;
  rect: Rect;
  pinCardId: Uuid | null;
}

/** The request asked for now, its key, and what it lights in the model; null with fading off. */
export function useLit(data: FadeData | undefined): { key: string; lit: Lit } | null {
  const request = useFadeRequest();
  return useMemo(() => {
    if (!request || !data) return null;
    if ("focus" in request) return { key: fadeKey(request), lit: focusLit(data.model, request.focus) };
    const index = buildRequirementIndex([...data.requirements], [...data.requirementLinks], data.model);
    if (!index.byId.has(request.lens)) return null;
    return { key: fadeKey(request), lit: lensLit(data.model, index.scope(request.lens), index.coverage(request.lens)) };
  }, [request, data]);
}

type AnyNode = InternalNode;

/** Whether a card node shows a lit entity or table. */
export const isLitCard = (n: AnyNode, lit: Lit): boolean => {
  if (n.type !== "card") return false;
  const c = (n as unknown as CardNodeT).data.card;
  return c.kind === "ent" ? lit.entities.has(c.targetId) : lit.tables.has(c.targetId);
};

/**
 * The React Flow nodes that stay lit: the cards of lit entities and tables that are drawn, and the block of a collapsed
 * frame when one of its hidden cards is lit (prototype: a frame stays lit when a member is).
 */
export function litNodeIds(lookup: Map<string, AnyNode>, lit: Lit): Set<string> {
  const out = new Set<string>();
  const litFrames = new Set<string>();
  for (const [id, n] of lookup) {
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

/** A node's rectangle as React Flow measured it. */
export const nodeRect = (n: AnyNode): Rect => ({ x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w: n.measured.width ?? 0, h: n.measured.height ?? 0 });

/** The lens's rows, tinted covered (blue) or gap (orange) above the cards (prototype `.row.rq`, `.row.gap`); none below 40 %. */
export const LitRows = memo(function LitRows({ rows }: { rows: ReadonlyMap<Uuid, LitRowColour> }) {
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
    <svg className="hover-layer lit-rows" width={1} height={1} data-testid="layer-lit-rows">
      {marks.map((m) => (
        <rect key={m.key} className={m.colour} data-testid={`lit-row-${m.colour}`} x={m.x} y={m.y} width={m.w} height={ROW_H} />
      ))}
    </svg>
  );
});
