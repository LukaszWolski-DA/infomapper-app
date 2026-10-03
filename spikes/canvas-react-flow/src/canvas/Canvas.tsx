"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  SelectionMode,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  useStore,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getData } from "@/data/generate";
import CardNode, { type CardNodeT, type RowFilter } from "./CardNode";
import FrameNode, { BLOCK_W, blockH, type FrameNodeT } from "./FrameNode";
import LineLayer, { type BundleLine, type Line, type MapLine, type RelLine } from "./LineLayer";
import { CanvasCtx, type CanvasApi, type Notation } from "./context";
import FpsMeter from "./FpsMeter";
import { toggleSelectedRow, useFocusActive } from "./highlight";

const nodeTypes = { card: CardNode, frame: FrameNode };

type AppNode = CardNodeT | FrameNodeT;
type BaseLine = MapLine | RelLine;

/* Frames first (React Flow needs parents before children), cards nested with positions relative to their frame. */
function buildNodes(): AppNode[] {
  const data = getData();
  const mapped = new Set<string>();
  data.mappings.forEach(m => { mapped.add(m.column); mapped.add(m.attribute); });
  const byId = new Map(data.cards.map(c => [c.id, c]));
  const frames: FrameNodeT[] = data.frames.map(f => {
    const inF = new Set(f.cards);
    return {
      id: f.id,
      type: "frame",
      position: { x: f.x, y: f.y },
      width: f.w,
      height: f.h,
      zIndex: -1,
      data: {
        frame: f,
        members: f.cards.map(id => byId.get(id)!),
        collapsed: false,
        outside: {
          maps: data.mappings.filter(m => inF.has(m.srcCard) !== inF.has(m.entCard)).length,
          rels: data.relationships.filter(r => inF.has(r.from) !== inF.has(r.to)).length,
        },
      },
    };
  });
  const frameById = new Map(data.frames.map(f => [f.id, f]));
  const cards: CardNodeT[] = data.cards.map(c => {
    const f = c.frameId ? frameById.get(c.frameId) : undefined;
    return {
      id: c.id,
      type: "card",
      position: f ? { x: c.x - f.x, y: c.y - f.y } : { x: c.x, y: c.y },
      parentId: f?.id,
      width: c.w,
      data: { card: c, collapsed: false, filter: "all", mapped },
    };
  });
  return [...frames, ...cards];
}

/* Lines are not React Flow edges any more (follow-up step 3); LineLayer draws them all in one <svg>. */
function buildLines(): BaseLine[] {
  const data = getData();
  const maps: MapLine[] = data.mappings.map(m => ({
    id: m.id, kind: "map", source: m.srcCard, target: m.entCard, column: m.column, attribute: m.attribute,
  }));
  // parallel relationships between the same pair are offset by 16 px, as in the prototype
  const pairCount: Record<string, number> = {};
  const rels: RelLine[] = data.relationships.map(r => {
    const key = [r.from, r.to].sort().join("|");
    const n = (pairCount[key] = (pairCount[key] ?? 0) + 1);
    return { id: r.id, kind: "rel", source: r.from, target: r.to, rel: r, offset: (n - 1) * 16 };
  });
  return [...rels, ...maps];
}

/*
 * Lines for the current set of collapsed frames: ordinary lines where both ends are visible,
 * merged lines (one per frame ↔ target card, with a count) where an end sits in a collapsed frame.
 */
function linesFor(base: BaseLine[], collapsed: Set<string>): Line[] {
  if (collapsed.size === 0) return base;
  const frameOfCard = new Map(getData().cards.map(c => [c.id, c.frameId]));
  const endOf = (card: string) => {
    const f = frameOfCard.get(card);
    return f && collapsed.has(f) ? f : card;
  };
  const out: Line[] = [];
  const bundles = new Map<string, BundleLine>();
  for (const e of base) {
    const a = endOf(e.source), z = endOf(e.target);
    if (a === e.source && z === e.target) { out.push(e); continue; }
    if (a === z) continue; // both ends inside the same collapsed frame
    const isMap = e.kind === "map";
    const key = isMap ? `m|${a}|${z}` : `r|${[a, z].sort().join("|")}`;
    const sRow = isMap && a === e.source ? e.column : null;
    const tRow = isMap && z === e.target ? e.attribute : null;
    let b = bundles.get(key);
    if (!b) {
      b = { id: "b:" + key, kind: "bundle", source: a, target: z, lineKind: isMap ? "map" : "rel", ids: [], sourceRow: sRow, targetRow: tRow };
      bundles.set(key, b);
    }
    const d = b;
    d.ids.push(e.id);
    if (d.sourceRow !== sRow) d.sourceRow = null; // rows differ → anchor at the card header
    if (d.targetRow !== tRow) d.targetRow = null;
  }
  return [...out, ...bundles.values()];
}

/* Minimap colours follow the prototype overview: sources physical, entities logical, frames in their own colour. */
const miniColor = (n: Node) =>
  n.type === "frame" ? (n as FrameNodeT).data.frame.color : (n as CardNodeT).data.card.kind === "src" ? "#A0660F" : "#3346C4";

/* Toggles the focus class on the canvas; children are passed through, so they don't re-render. */
function FocusRoot({ children }: { children: React.ReactNode }) {
  const on = useFocusActive();
  return <div className={`focus-root${on ? " focus" : ""}`}>{children}</div>;
}

function ZoomReadout() {
  const zoom = useStore(s => s.transform[2]);
  return <div className="zoomr" data-testid="zoom">{Math.round(zoom * 100)}%</div>;
}

function Flow() {
  const data = getData();
  const [nodes, setNodes] = useState<AppNode[]>(buildNodes);
  const [baseLines] = useState(buildLines);
  const [collapsedFrames, setCollapsedFrames] = useState<Set<string>>(() => new Set());
  const lines = useMemo(() => linesFor(baseLines, collapsedFrames), [baseLines, collapsedFrames]);
  const [notation, setNotation] = useState<Notation>("ie");
  // ?visibleOnly → React Flow renders only nodes/edges in the viewport (compared in REPORT.md, C-01)
  const [visibleOnly] = useState(() => new URLSearchParams(window.location.search).has("visibleOnly"));
  /*
   * C-01 workaround: will-change: transform on the viewport, so Chrome pans/zooms one GPU layer instead of repainting
   * every card and line each frame. Default "always"; ?wc=move only while moving, ?wc=off to measure without it.
   */
  const [wc] = useState(() => new URLSearchParams(window.location.search).get("wc") ?? "always");
  // React Flow's dotted <Background> is repainted on every pan frame; off by default, ?bg=dots to show it
  const [bg] = useState(() => new URLSearchParams(window.location.search).get("bg") ?? "none");
  const setWillChange = useCallback((on: boolean) => {
    const vp = document.querySelector<HTMLElement>(".react-flow__viewport");
    if (vp) vp.style.willChange = on ? "transform" : "";
  }, []);
  useEffect(() => { if (wc === "always") setWillChange(true); }, [wc, setWillChange]);

  const onNodesChange = useCallback(
    (changes: NodeChange<AppNode>[]) => setNodes(ns => applyNodeChanges(changes, ns)),
    [],
  );

  const patch = useCallback(
    (id: string, f: (d: CardNodeT["data"]) => Partial<CardNodeT["data"]>) =>
      setNodes(ns => ns.map(n => (n.id === id && n.type === "card" ? { ...n, data: { ...n.data, ...f(n.data) } } : n))),
    [],
  );

  /* Collapse: the frame node becomes the block and its cards are hidden. Card positions are untouched, so expand restores them. */
  const toggleFrame = useCallback((frameId: string) => {
    setNodes(ns => {
      const fr = ns.find(n => n.id === frameId) as FrameNodeT;
      const collapsed = !fr.data.collapsed;
      const f = fr.data.frame;
      return ns.map(n => {
        if (n.id === frameId) {
          return {
            ...fr,
            width: collapsed ? BLOCK_W : f.w,
            height: collapsed ? blockH(f.cards.length) : f.h,
            zIndex: collapsed ? 0 : -1,
            data: { ...fr.data, collapsed },
          };
        }
        return n.parentId === frameId ? { ...n, hidden: collapsed, selected: false } : n;
      });
    });
    setCollapsedFrames(prev => {
      const next = new Set(prev);
      if (next.has(frameId)) next.delete(frameId);
      else next.add(frameId);
      return next;
    });
  }, []);

  // debug / test hook: data set + React Flow instance, used by the Playwright scripts
  const rf = useReactFlow();
  useEffect(() => {
    (window as unknown as { __spike: unknown }).__spike = { data, rf, toggleFrame };
  }, [data, rf, toggleFrame]);

  const api = useMemo<CanvasApi>(
    () => ({
      notation,
      toggleCollapse: id => patch(id, d => ({ collapsed: !d.collapsed })),
      setFilter: (id, filter: RowFilter) => patch(id, () => ({ filter })),
      toggleFrame,
    }),
    [patch, notation, toggleFrame],
  );

  return (
    <div className="shell">
      <header className="bar">
        <b>Canvas spike</b>
        <span>React Flow · seed {data.seed}</span>
        <span className="seg" role="group" aria-label="Relationship notation">
          {(["ie", "uml"] as const).map(n => (
            <button key={n} aria-pressed={notation === n} onClick={() => setNotation(n)} data-notation={n}>
              {n === "ie" ? "Crow's foot" : "UML"}
            </button>
          ))}
        </span>
        <span className="stats">
          {data.cards.length} cards · {data.mappings.length} mappings · {data.relationships.length} relationships · {data.frames.length} frames
        </span>
      </header>
      <main className="stage" onContextMenu={e => e.preventDefault()}>
        <CanvasCtx.Provider value={api}>
          <FocusRoot>
          <ReactFlow
            nodes={nodes}
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes}
            nodesConnectable={false}
            // D-15/D-16: drag on empty canvas = lasso that takes only fully enclosed nodes; Shift-click adds
            selectionOnDrag
            selectionMode={SelectionMode.Full}
            multiSelectionKeyCode="Shift"
            // navigation: wheel pans, Ctrl/pinch zooms, Space-drag and right-drag (or middle) pan
            panOnScroll
            panOnDrag={[1, 2]}
            panActivationKeyCode="Space"
            onPaneClick={() => toggleSelectedRow(null)}
            onlyRenderVisibleElements={visibleOnly}
            onMoveStart={wc === "move" ? () => setWillChange(true) : undefined}
            onMoveEnd={wc === "move" ? () => setWillChange(false) : undefined}
            fitView
            minZoom={0.1}
            maxZoom={3}
          >
            <LineLayer lines={lines} />
            {bg === "dots" && <Background gap={24} />}
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={miniColor}
              nodeStrokeWidth={0}
              nodeBorderRadius={2}
              maskColor="rgba(232,236,240,.6)"
              style={{ width: 216, height: 140 }}
            />
            <Panel position="bottom-right" className="zoom-panel">
              <ZoomReadout />
            </Panel>
          </ReactFlow>
          </FocusRoot>
        </CanvasCtx.Provider>
        <FpsMeter />
      </main>
    </div>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
