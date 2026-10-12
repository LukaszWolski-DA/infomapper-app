"use client";

// The Overview in the bottom-right corner (prototype .mini, renderMini): a header with the zoom value and a toggle (M),
// and the whole canvas in miniature: entities in their concept colour, sources in the physical colour, mapping and
// relationship lines between card centres, and the visible area. Clicking moves the view there; dragging the visible
// area pans. While the view moves, the miniature stays as it is: it is drawn once per change of the cards or lines,
// and the visible area is a second SVG on top, so moving it repaints only that small layer (S1A-14: repainting the
// whole miniature on every frame cost a third of each frame). While cards are dragged it keeps the cards where they
// were and takes their new places on release, as the prototype's miniature does (slice 2a step 3b).
// Slice 2c: a collapsed frame's block is drawn instead of its hidden cards, and their lines go to the block.
// Slice 3b: the notes shown on the canvas (not hidden resolved ones, not those in a collapsed frame) as small rounded
// rectangles in their paper colour, under the cards (prototype renderMini, NOTE_MINI). Like the cards they keep their
// places while anything is dragged, and the miniature takes them again only when they look different, so a note's
// drag redraws it once, on the drop. In development each commit of the miniature is counted in
// `window.__imMiniatureCommits` (S3B-13 checks that panning and zooming do not redraw it).

import { memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Panel, useReactFlow, useStore, type Node } from "@xyflow/react";
import { blockNodeId, type BlockNodeT } from "./BlockNode";
import { isCardNode, type CardNodeT } from "./CardNode";
import { CanvasUiCtx } from "./context";
import { cardHeight, cardWidth, type Rect } from "./geometry";
import type { CanvasLines } from "./line-data";
import type { NoteColor } from "@/domain/types";

const NO_NOTES: readonly MiniNote[] = [];

const W = 216, H = 140;

/** A note as the miniature draws it. */
export interface MiniNote {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: NoteColor;
}

/** The notes' paper colours in the miniature (prototype NOTE_MINI). */
const NOTE_MINI: Record<NoteColor, string> = { yellow: "#E9C94F", blue: "#7FA9E0", green: "#7CC197", pink: "#E59BB6", grey: "#A9B0BA" };

const sameNotes = (a: readonly MiniNote[], b: readonly MiniNote[]) =>
  a.length === b.length && a.every((n, i) => n.id === b[i]!.id && n.x === b[i]!.x && n.y === b[i]!.y && n.w === b[i]!.w && n.h === b[i]!.h && n.color === b[i]!.color);

export function Overview({ lines, notes = NO_NOTES, notesDragging = false }: { lines: CanvasLines; notes?: readonly MiniNote[]; notesDragging?: boolean }) {
  const ui = useContext(CanvasUiCtx);
  const rf = useReactFlow();
  const current = useStore((s) => s.nodes) as Node[];
  const dragging = current.some((n) => n.dragging);
  /** The cards as they were before the drag that is going on, if any. */
  const [settled, setSettled] = useState(current);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- remembers the cards between drags, for the next drag
    if (!dragging) setSettled(current);
  }, [current, dragging]);
  const nodes = dragging ? settled : current;
  /** The notes as last drawn: kept while anything is dragged, taken again only when they look different. */
  const [miniNotes, setMiniNotes] = useState(notes);
  const busy = dragging || notesDragging;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the notes as drawn change only after a drag and only when they differ
    if (!busy && !sameNotes(miniNotes, notes)) setMiniNotes(notes);
  }, [notes, busy, miniNotes]);
  const [tx, ty, zoom] = useStore((s) => s.transform);
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const svgRef = useRef<SVGSVGElement>(null);
  /** Where the pointer holds the visible area while dragging (used in handlers only). */
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  /** While dragging, the miniature keeps the bounds it had at the start, so it does not shift under the pointer. */
  const [frozen, setFrozen] = useState<Rect | null>(null);

  const view: Rect = { x: -tx / zoom, y: -ty / zoom, w: width / zoom, h: height / zoom };
  /** The cards drawn and the blocks (slice 2c); a hidden card's lines go to its block. */
  const shown = useMemo(() => nodes.filter((n) => !n.hidden) as (CardNodeT | BlockNodeT)[], [nodes]);
  const rects = useMemo(
    () =>
      new Map(
        shown.map((n) => [
          n.id,
          isCardNode(n) ? { x: n.position.x, y: n.position.y, w: cardWidth(n.data.card), h: cardHeight(n.data.card) } : { x: n.position.x, y: n.position.y, w: n.width ?? 0, h: n.height ?? 0 },
        ]),
      ),
    [shown],
  );
  const blockOf = useMemo(() => new Map(nodes.filter((n) => n.hidden && isCardNode(n)).map((n) => [n.id, blockNodeId((n as CardNodeT).data.card.frameId ?? "")])), [nodes]);
  const content = useMemo(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of [...rects.values(), ...miniNotes]) {
      x0 = Math.min(x0, r.x);
      y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w);
      y1 = Math.max(y1, r.y + r.h);
    }
    return { x0, y0, x1, y1 };
  }, [rects, miniNotes]);
  const x0 = Math.min(content.x0, view.x), y0 = Math.min(content.y0, view.y);
  const x1 = Math.max(content.x1, view.x + view.w), y1 = Math.max(content.y1, view.y + view.h);
  const pad = Math.max(x1 - x0, y1 - y0) * 0.05;
  const live: Rect = { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
  const b = frozen ?? live;
  const viewBox = `${b.x} ${b.y} ${b.w} ${b.h}`;
  const toWorld = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
  };
  const moveTo = (p: { x: number; y: number }, off: { x: number; y: number }, duration = 0) =>
    void rf.setViewport({ x: -(p.x - off.x) * zoom, y: -(p.y - off.y) * zoom, zoom }, { duration });

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toWorld(e);
    const inside = p.x >= view.x && p.x <= view.x + view.w && p.y >= view.y && p.y <= view.y + view.h;
    const off = inside ? { x: p.x - view.x, y: p.y - view.y } : { x: view.w / 2, y: view.h / 2 };
    dragOffset.current = off;
    setFrozen(live);
    if (!inside) moveTo(p, off, 250);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragOffset.current) moveTo(toWorld(e), dragOffset.current);
  };
  const onPointerUp = () => {
    dragOffset.current = null;
    setFrozen(null);
  };

  return (
    <Panel position="bottom-right" className={`overview${ui.overviewOpen ? "" : " closed"}`} data-testid="panel-overview">
      <div className="overview-h" onDoubleClick={ui.toggleOverview}>
        <span>Overview</span>
        <span className="overview-z">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="ib"
          data-testid="button-overview-toggle"
          aria-expanded={ui.overviewOpen}
          title={ui.overviewOpen ? "Hide the overview (M)" : "Show the overview (M)"}
          onClick={ui.toggleOverview}
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M4.5 6.5L8 10l3.5-3.5" />
          </svg>
        </button>
      </div>
      {ui.overviewOpen && (
        <div className="overview-box">
          <svg className="overview-svg" width={W} height={H} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden>
            <Miniature nodes={shown} rects={rects} blockOf={blockOf} lines={lines} notes={miniNotes} />
          </svg>
          <svg
            ref={svgRef}
            className="overview-view"
            width={W}
            height={H}
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid meet"
            aria-label="Overview of the whole canvas"
            data-testid="svg-overview"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <rect className="mv" x={view.x} y={view.y} width={view.w} height={view.h} />
          </svg>
        </div>
      )}
    </Panel>
  );
}

/** The cards and lines in miniature: lines between card centres, entities in their concept colour. */
const Miniature = memo(function Miniature({
  nodes,
  rects,
  blockOf,
  lines,
  notes,
}: {
  nodes: (CardNodeT | BlockNodeT)[];
  rects: Map<string, Rect>;
  blockOf: Map<string, string>;
  lines: CanvasLines;
  notes: readonly MiniNote[];
}) {
  // Development only (slice 3b, S3B-13): every commit of the miniature is counted
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as { __imMiniatureCommits?: number };
      w.__imMiniatureCommits = (w.__imMiniatureCommits ?? 0) + 1;
    }
  });
  const centre = (id: string) => {
    const r = rects.get(id) ?? rects.get(blockOf.get(id) ?? "");
    return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null;
  };
  const pairs = new Set<string>();
  for (const m of lines.mappings) for (const i of m.inputs) pairs.add(`${i.cardId}|${m.cardId}`);
  return (
    <>
      {[...pairs].map((pair) => {
        const [s, t] = pair.split("|") as [string, string];
        const a = centre(s), z = centre(t);
        return a && z ? <line key={pair} className="mm" x1={a.x} y1={a.y} x2={z.x} y2={z.y} /> : null;
      })}
      {lines.relationships.map((r) => {
        const a = centre(r.fromCardId), z = centre(r.toCardId);
        return a && z ? <line key={r.id} className="mr" x1={a.x} y1={a.y} x2={z.x} y2={z.y} /> : null;
      })}
      {notes.map((n) => (
        <rect key={n.id} className="mn" x={n.x} y={n.y} width={n.w} height={n.h} rx={6} style={{ fill: NOTE_MINI[n.color] }} data-testid="mini-note" data-color={n.color} />
      ))}
      {nodes.map((n) => {
        const r = rects.get(n.id)!;
        if (!isCardNode(n)) return <rect key={n.id} className="mb" x={r.x} y={r.y} width={r.w} height={r.h} rx={12} style={{ fill: n.data.color }} />;
        const card = n.data.card;
        return card.kind === "ent" ? (
          <rect key={n.id} className="me" x={r.x} y={r.y} width={r.w} height={r.h} rx={12} style={{ fill: card.color ?? "#888899" }} />
        ) : (
          <rect key={n.id} className="ms" x={r.x} y={r.y} width={r.w} height={r.h} />
        );
      })}
    </>
  );
});
