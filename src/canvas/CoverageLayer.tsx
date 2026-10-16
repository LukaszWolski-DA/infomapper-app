"use client";

// Coverage colours on the canvas (slice 4b-1, PRD items 16–19; prototype applyHighlight, .row.rq, .row.gap): while a
// requirement is selected, its attribute rows blue or orange, its entity items' and linked tables' headers tinted, its
// linked columns' rows blue and its linked mappings' lines lit; nothing fades. Drawn in the overlay (its own compositing
// layer, with the hover and the selection marks) from positions computed from data (AD-24 rule 2): no card's own class
// or style changes. Below 40 % rows are not drawn; a card's summary stands for them (item 19: a header tint or a dot,
// `lodVariant`). Selecting anything else, a click on empty canvas or Escape clears the selection and with it the colours.

import { memo, useMemo } from "react";
import { useStore } from "@xyflow/react";
import type { Uuid } from "@/domain/ids";
import type { RequirementIndex } from "@/domain/model/requirement-index";
import type { CardNodeT } from "./CardNode";
import { coverageColours, lodVariant, type CoverageColour } from "./coverage-colours";
import { LitRows } from "./fade-canvas";
import { cardWidth, HEAD_H, LOD_ZOOM, type Rect } from "./geometry";
import { LitLines } from "./LineLayer";
import type { CanvasLines, MapLineData } from "./line-data";
import type { Bundle } from "./line-geometry";
import { useValue } from "./value-store";

const NO_RELS: ReadonlySet<string> = new Set();

export const CoverageLayer = memo(function CoverageLayer({
  index,
  requirementId,
  lines,
  bundles,
  blocks,
  mapsById,
}: {
  index: RequirementIndex | null;
  /** The selected requirement, or null. */
  requirementId: Uuid | null;
  lines: CanvasLines;
  bundles?: readonly Bundle[];
  blocks?: ReadonlyMap<string, Rect>;
  mapsById?: ReadonlyMap<string, MapLineData>;
}) {
  const nodes = useStore((s) => s.nodes); // follow drags, collapses and widths
  const lookup = useStore((s) => s.nodeLookup);
  const lod = useStore((s) => s.transform[2] < LOD_ZOOM);
  const variant = useValue(lodVariant);
  // an attribute's entity and a column's table, from the cards on this canvas
  const owners = useMemo(() => {
    const of = new Map<Uuid, Uuid>();
    for (const n of nodes) {
      if (n.type !== "card") continue;
      const card = (n as unknown as CardNodeT).data.card;
      for (const r of card.rows) of.set(r.id, card.targetId);
    }
    return of;
  }, [nodes]);
  const colours = useMemo(() => coverageColours(index, requirementId, (a) => owners.get(a), (c) => owners.get(c)), [index, requirementId, owners]);
  if (!requirementId) return null;

  // headers: entity items and linked tables; below 40 % with the tint variant, every card with something in scope
  const tints: { key: string; colour: CoverageColour; x: number; y: number; w: number; r: number }[] = [];
  const dots: { key: string; colour: CoverageColour; x: number; y: number }[] = [];
  const headerOf = lod && variant === "tint" ? colours.summary : colours.headers;
  for (const [id, n] of lookup) {
    if (n.type !== "card" || n.hidden) continue;
    const card = (n as unknown as CardNodeT).data.card;
    const { x, y } = n.internals.positionAbsolute;
    const w = cardWidth(card);
    const tint = headerOf.get(card.targetId);
    // the corners of an entity card and a source card (canvas.css)
    if (tint) tints.push({ key: id, colour: tint, x, y, w, r: card.kind === "src" ? 3 : 10 });
    const sum = lod && variant === "dot" ? colours.summary.get(card.targetId) : undefined;
    if (sum) dots.push({ key: id, colour: sum, x: x + w - 26, y: y + HEAD_H / 2 });
  }

  return (
    <>
      {colours.mappings.size > 0 && (
        <LitLines maps={colours.mappings} rels={NO_RELS} lines={lines} bundles={bundles} blocks={blocks} mapsById={mapsById} testId="layer-coverage-lines" />
      )}
      {(tints.length > 0 || dots.length > 0) && (
        <svg className="hover-layer lit-rows" width={1} height={1} data-testid="layer-coverage-headers" data-variant={lod ? variant : undefined}>
          {tints.map((t) => (
            <rect key={t.key} className={lod ? `lod ${t.colour}` : t.colour} data-testid={`coverage-header-${t.colour}`} data-card={t.key} x={t.x} y={t.y} width={t.w} height={HEAD_H} rx={t.r} />
          ))}
          {dots.map((d) => (
            <circle key={d.key} className={`dot ${d.colour}`} data-testid={`coverage-dot-${d.colour}`} data-card={d.key} cx={d.x} cy={d.y} r={18} />
          ))}
        </svg>
      )}
      <LitRows rows={colours.rows} testId="coverage-row" />
    </>
  );
});
