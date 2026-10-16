"use client";

// Coverage colours on the canvas (slice 4b-1, PRD items 16–19; prototype applyHighlight, .row.rq, .row.gap): while a
// requirement is selected, its attribute rows blue or orange, its entity items' and linked tables' headers marked, its
// linked columns' rows blue and its linked mappings' lines lit; nothing fades. Drawn in the overlay (its own compositing
// layer, with the hover and the selection marks) from positions computed from data (AD-24 rule 2): no card's own class
// or style changes. The overlay lies above the text, so a mark is a faint fill (the text keeps 4.5:1) and a bar in the
// full colour where no text is (`LitRows`; a header's bar along its bottom edge). Below 40 % rows are not drawn; a dot
// at the header's right end carries the card's summary (item 19), and a collapsed frame's block the same dot on each
// member's row (the members past the sixth one dot on the “and N more” row). Selecting anything else, a click on empty canvas or Escape clears the selection and with it the colours.

import { memo, useMemo } from "react";
import { useStore } from "@xyflow/react";
import { BLOCK } from "@/domain/model/frames";
import type { Uuid } from "@/domain/ids";
import type { RequirementIndex } from "@/domain/model/requirement-index";
import type { BlockNodeT } from "./BlockNode";
import type { CardNodeT } from "./CardNode";
import { coverageColours, type CoverageColour } from "./coverage-colours";
import { LitRows } from "./fade-canvas";
import { cardWidth, HEAD_H, LOD_ZOOM } from "./geometry";
import type { Rect } from "./geometry";
import { LitLines } from "./LineLayer";
import type { CanvasLines, MapLineData } from "./line-data";
import type { Bundle } from "./line-geometry";

const NO_RELS: ReadonlySet<string> = new Set();
/** A header's bar: its height at and above 40 %, and below (where it must still show at 10–40 %). */
const BAR = 3;
const BAR_LOD = 10;

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
  // an attribute's entity and a column's table, from the cards on this canvas (hidden ones too: a collapsed frame's)
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

  // headers: entity items and linked tables, at every zoom; below 40 % the summary dot as well
  const headers: { key: string; colour: CoverageColour; x: number; y: number; w: number; r: number; bar: Rect }[] = [];
  const dots: { key: string; colour: CoverageColour; x: number; y: number; r: number; block?: string; member?: string }[] = [];
  for (const [id, n] of lookup) {
    if (n.hidden) continue;
    const { x, y } = n.internals.positionAbsolute;
    if (n.type === "card") {
      const card = (n as unknown as CardNodeT).data.card;
      const w = cardWidth(card);
      const h = n.measured.height ?? HEAD_H;
      const colour = colours.headers.get(card.targetId);
      if (colour) {
        // the bar along the header's bottom edge, clear of its text; below 40 % taller, over the plain block below it
        const bh = lod ? BAR_LOD : BAR;
        const top = Math.min(y + HEAD_H - (lod ? 4 : BAR + 2), y + h - bh);
        // an entity card's own concept bar is its left 4 px (canvas.css); a source card's corners are 3 px, an entity's 10
        const left = card.kind === "src" ? 0 : 4;
        headers.push({ key: id, colour, x, y, w, r: card.kind === "src" ? 3 : 10, bar: { x: x + left, y: top, w: w - left, h: bh } });
      }
      const sum = lod ? colours.summary.get(card.targetId) : undefined;
      if (sum) dots.push({ key: id, colour: sum, x: x + w - 26, y: y + HEAD_H / 2, r: 18 });
    } else if (n.type === "block") {
      // a collapsed frame's block: the summary dot on each shown member's row (BlockNode, .brow), at its right end, in
      // the 12 px padding after the count (on the left it would sit beside the kind marker, an entity's a blue dot too);
      // below 40 %, larger, where the card header's dot is (the rows are a plain block then)
      const { frame, members } = (n as unknown as BlockNodeT).data;
      const summaryOf = (cardId: string) => {
        const card = lookup.get(cardId) as unknown as CardNodeT | undefined;
        return card ? colours.summary.get(card.data.card.targetId) : undefined;
      };
      const dot = (i: number, colour: CoverageColour, member: string) =>
        dots.push({ key: `${id}|${member}`, colour, x: x + BLOCK.width - (lod ? 26 : 6), y: y + HEAD_H + BLOCK.bodyPad + (i + 0.5) * BLOCK.rowHeight, r: lod ? 9 : 3.5, block: frame.id, member });
      members.slice(0, BLOCK.maxRows).forEach((m, i) => {
        const sum = summaryOf(m.id);
        if (sum) dot(i, sum, m.id);
      });
      // the members past the sixth share the “and N more” row (Łukasz's answer after step 6): one dot for them, orange
      // when any of them is a gap
      let more: CoverageColour | undefined;
      for (const m of members.slice(BLOCK.maxRows)) {
        const sum = summaryOf(m.id);
        if (sum && more !== "gap") more = sum;
      }
      if (more) dot(BLOCK.maxRows, more, "more");
    }
  }

  return (
    <>
      {colours.mappings.size > 0 && (
        <LitLines maps={colours.mappings} rels={NO_RELS} lines={lines} bundles={bundles} blocks={blocks} mapsById={mapsById} testId="layer-coverage-lines" />
      )}
      {(headers.length > 0 || dots.length > 0) && (
        <svg className="hover-layer lit-rows" width={1} height={1} data-testid="layer-coverage-headers">
          {headers.map((t) => (
            <g key={t.key} data-testid={`coverage-header-${t.colour}`} data-card={t.key}>
              <rect className={t.colour} x={t.x} y={t.y} width={t.w} height={HEAD_H} rx={t.r} />
              <rect className={`bar ${t.colour}`} x={t.bar.x} y={t.bar.y} width={t.bar.w} height={t.bar.h} />
            </g>
          ))}
          {dots.map((d) =>
            d.block ? (
              <circle key={d.key} className={`dot ${d.colour}`} data-testid={`coverage-block-dot-${d.colour}`} data-block={d.block} data-member={d.member} cx={d.x} cy={d.y} r={d.r} />
            ) : (
              <circle key={d.key} className={`dot ${d.colour}`} data-testid={`coverage-dot-${d.colour}`} data-card={d.key} cx={d.x} cy={d.y} r={d.r} />
            ),
          )}
        </svg>
      )}
      <LitRows rows={colours.rows} testId="coverage-row" />
    </>
  );
});
