"use client";

// The Overview in the bottom-right corner (prototype .mini, renderMini): a header with the zoom value and a toggle (M),
// and the whole canvas in miniature: entities in their concept colour, sources in the physical colour, mapping and
// relationship lines between card centres, and the visible area. Clicking moves the view there; dragging the visible
// area pans. While the view moves, the miniature stays as it is: it is drawn once per change of the cards or lines,
// and the visible area is a second SVG on top, so moving it repaints only that small layer (S1A-14: repainting the
// whole miniature on every frame cost a third of each frame). While cards are dragged it keeps the cards where they
// were and takes their new places on release, as the prototype's miniature does (slice 2a step 3b).

import { memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Panel, useReactFlow, useStore } from "@xyflow/react";
import type { CardNodeT } from "./CardNode";
import { CanvasUiCtx } from "./context";
import { cardHeight, cardWidth, type Rect } from "./geometry";
import type { CanvasLines } from "./line-data";

const W = 216, H = 140;

export function Overview({ lines }: { lines: CanvasLines }) {
  const ui = useContext(CanvasUiCtx);
  const rf = useReactFlow();
  const current = useStore((s) => s.nodes) as CardNodeT[];
  const dragging = current.some((n) => n.dragging);
  /** The cards as they were before the drag that is going on, if any. */
  const [settled, setSettled] = useState(current);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- remembers the cards between drags, for the next drag
    if (!dragging) setSettled(current);
  }, [current, dragging]);
  const nodes = dragging ? settled : current;
  const [tx, ty, zoom] = useStore((s) => s.transform);
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const svgRef = useRef<SVGSVGElement>(null);
  /** Where the pointer holds the visible area while dragging (used in handlers only). */
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  /** While dragging, the miniature keeps the bounds it had at the start, so it does not shift under the pointer. */
  const [frozen, setFrozen] = useState<Rect | null>(null);

  const view: Rect = { x: -tx / zoom, y: -ty / zoom, w: width / zoom, h: height / zoom };
  const rects = useMemo(
    () => new Map(nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y, w: cardWidth(n.data.card), h: cardHeight(n.data.card) }])),
    [nodes],
  );
  const content = useMemo(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of rects.values()) {
      x0 = Math.min(x0, r.x);
      y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w);
      y1 = Math.max(y1, r.y + r.h);
    }
    return { x0, y0, x1, y1 };
  }, [rects]);
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
            <Miniature nodes={nodes} rects={rects} lines={lines} />
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
const Miniature = memo(function Miniature({ nodes, rects, lines }: { nodes: CardNodeT[]; rects: Map<string, Rect>; lines: CanvasLines }) {
  const centre = (id: string) => {
    const r = rects.get(id);
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
      {nodes.map((n) => {
        const r = rects.get(n.id)!;
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
