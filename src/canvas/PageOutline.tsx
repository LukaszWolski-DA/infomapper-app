"use client";

// The page outline for documentation (slice 27, step 4, Q6; the prototype's `pageArea`): the pages a whole canvas takes
// at the outline's paper, orientation and smallest names, as dashed rectangles behind the frames and cards, page 1
// labelled "{A4} {portrait} at {7} pt · fits on one page" or "… · needs {n} pages: move cards into page 1 to keep it
// whole", the others "page {n}". What it counts is what a figure "As on the canvas" draws (`figureBoxOf`): the cards
// shown, the expanded frames holding one with their name strip, the collapsed frames' blocks and the requirement cards;
// never notes. Its pages come from InfoMapper's document page geometry (`outlinePages`), so the outline and a figure
// cannot disagree.
//
// One layer in the viewport (`EdgeLabelRenderer`, as `FrameLayer`), mounted only while the outline is on: off, there is
// no element. On: the layer and one element per page, its label a `::before` (AD-24: no element per mark). It reads the
// cards' places from React Flow's store, not from `ModelCanvas`, and keeps its pages while a card is dragged, so it
// follows a drop and never re-renders the canvas (AD-24; slice 2c's commit counters).

import { memo, useMemo } from "react";
import { EdgeLabelRenderer, useStore, type Node } from "@xyflow/react";
import { figureBoxOf, FRAME_NAME_H } from "@/domain/document/figure";
import { outlineLabel, outlinePages, type OutlineSpec } from "@/domain/document/page";
import type { CardData } from "./card-data";
import type { FrameData } from "./frame-data";
import { cardHeight, cardWidth, type Rect } from "./geometry";

interface Props {
  outline: OutlineSpec;
  frames: readonly FrameData[];
}

type AnyNode = Node<{ card?: CardData }>;

/** What a figure would draw, from the nodes as the canvas shows them: one string, so equal places draw nothing new. */
function drawnKey(nodes: readonly AnyNode[], frames: readonly FrameData[]): string {
  const rects: Rect[] = [];
  const holding = new Set<string>();
  for (const n of nodes) {
    if (n.hidden) continue;
    const card = n.type === "card" ? n.data.card : undefined;
    if (card) {
      rects.push({ x: n.position.x, y: n.position.y, w: cardWidth(card), h: cardHeight(card) });
      if (card.frameId) holding.add(card.frameId);
    } else rects.push({ x: n.position.x, y: n.position.y, w: n.width ?? n.measured?.width ?? 0, h: n.height ?? n.measured?.height ?? 0 });
  }
  for (const f of frames) if (!f.collapsed && holding.has(f.id)) rects.push({ x: f.x, y: f.y - FRAME_NAME_H, w: f.width, h: f.height + FRAME_NAME_H });
  const box = figureBoxOf(rects);
  return box ? `${box.x},${box.y},${box.w},${box.h}` : "";
}

/** While a card is dragged: the pages stay where they were (they follow its drop, Q6). */
const DRAGGING = "dragging";
const keepWhileDragging = (before: string, next: string) => next === DRAGGING || before === next;

/** The box's key from the store's nodes, worked out again only when the nodes or the frames change (never on a pan). */
function boxSelector(frames: readonly FrameData[]) {
  let nodesSeen: readonly AnyNode[] | null = null;
  let key = "";
  return (s: { nodes: readonly Node[] }): string => {
    if (s.nodes === nodesSeen) return key;
    nodesSeen = s.nodes;
    key = s.nodes.some((n) => n.dragging) ? DRAGGING : drawnKey(s.nodes as AnyNode[], frames);
    return key;
  };
}

function PageOutline({ outline, frames }: Props) {
  const selector = useMemo(() => boxSelector(frames), [frames]);
  const box = useStore(selector, keepWhileDragging);
  const pages = useMemo(() => {
    if (!box || box === DRAGGING) return [];
    const [x, y, w, h] = box.split(",").map(Number) as [number, number, number, number];
    return outlinePages({ x, y, w, h }, outline).pages;
  }, [box, outline]);
  if (!pages.length) return null;
  const one = pages.length === 1;
  return (
    <EdgeLabelRenderer>
      <div className="page-outline" data-testid="layer-page-outline" data-pages={pages.length}>
        {pages.map((p) => (
          <div
            key={p.n}
            className={`pg${one ? " ok" : p.n > 1 ? " more" : ""}`}
            data-testid="page-outline-page"
            data-label={outlineLabel(outline, p.n, pages.length)}
            style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
          />
        ))}
      </div>
    </EdgeLabelRenderer>
  );
}

export default memo(PageOutline);
