"use client";

// The model canvas (AD-24): React Flow with one node per card, positions from data, all lines in one layer, and the
// report's CSS rules (no dotted background, no opacity on repeated elements, will-change on the viewport).
// Navigation as in the prototype: the wheel pans, Ctrl/pinch zooms, Space-drag or the middle/right button pans;
// F fits, M toggles the Overview, Esc clears the selection. The last view of each canvas is remembered in the
// browser (data model section 12). Cards are dragged by their header, snapped to 8 px, and saved when the drag ends.

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  applyNodeChanges,
  ReactFlow,
  useReactFlow,
  useStore,
  useStoreApi,
  type NodeChange,
  type OnNodeDrag,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./canvas.css";
import { useToast } from "@/ui/components/toast";
import type { CardData } from "./card-data";
import CardNode, { FILTER_ORDER, type CardNodeT } from "./CardNode";
import { readPreference, writePreference } from "./CanvasProvider";
import { CanvasCardsCtx, CanvasUiCtx, type CanvasCardsApi } from "./context";
import { cardHeight, cardWidth, contentBounds, fitViewport, MAX_ZOOM, MIN_ZOOM } from "./geometry";
import { relatedLines, type CanvasLines, type Selection } from "./line-data";
import LineLayer from "./LineLayer";
import { Overview } from "./Overview";

const nodeTypes = { card: CardNode };

export interface CardChange {
  canvasItemId: string;
  expectedVersion: number;
  collapsed?: boolean;
  rowFilter?: CardData["rowFilter"];
  x?: number;
  y?: number;
}
export type SaveCardResult = { ok: true; value: { version: number } } | { ok: false; message: string };

export interface ModelCanvasProps {
  canvasId: string;
  cards: CardData[];
  lines: CanvasLines;
  editable: boolean;
  /** Saves a card's position, collapse state or row filter (a server action). */
  saveCard: (change: CardChange) => Promise<SaveCardResult>;
}

type CardPatch = Partial<Pick<CardData, "collapsed" | "rowFilter" | "x" | "y">>;

const toNode = (card: CardData, editable: boolean): CardNodeT => ({
  id: card.id,
  type: "card",
  position: { x: card.x, y: card.y },
  width: cardWidth(card),
  height: cardHeight(card),
  data: { card },
  draggable: editable,
  dragHandle: ".c-head",
  selectable: false,
  connectable: false,
  // React Flow lets clicks through nodes that are neither draggable nor selectable; cards have their own clicks.
  style: { pointerEvents: "all" },
});

const viewKey = (canvasId: string) => `infomapper:view:${canvasId}`;

function readView(canvasId: string): Viewport | null {
  const raw = readPreference(viewKey(canvasId));
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Viewport;
    return [v.x, v.y, v.zoom].every(Number.isFinite) && v.zoom >= MIN_ZOOM && v.zoom <= MAX_ZOOM ? v : null;
  } catch {
    return null;
  }
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

export function ModelCanvas({ canvasId, cards: initialCards, lines, editable, saveCard }: ModelCanvasProps) {
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  const rf = useReactFlow();
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const [nodes, setNodes] = useState<CardNodeT[]>(() => initialCards.map((c) => toNode(c, editable)));
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const related = useMemo(() => relatedLines(selection, lines), [selection, lines]);

  // ---- view: the remembered one, else fit everything ----
  const storeApi = useStoreApi();
  const cardsNow = useCallback(() => (rf.getNodes() as CardNodeT[]).map((n) => n.data.card), [rf]);
  const fitView = useCallback(
    (w: number, h: number) => fitViewport(contentBounds(cardsNow()), { width: w, height: h }, ui.overviewOpen),
    [cardsNow, ui.overviewOpen],
  );

  const fit = useCallback(() => {
    const { width: w, height: h } = storeApi.getState();
    void rf.setViewport(fitView(w, h), { duration: 250 });
  }, [rf, storeApi, fitView]);

  useEffect(() => ui.registerFit(fit), [ui, fit]);

  useEffect(() => {
    if (ready || width === 0 || height === 0) return;
    void rf.setViewport(readView(canvasId) ?? fitView(width, height));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the view can only be set once the pane has a size
    setReady(true);
  }, [ready, width, height, canvasId, rf, fitView]);

  const onMoveEnd = useCallback(
    (_: unknown, v: Viewport) => writePreference(viewKey(canvasId), JSON.stringify(v)),
    [canvasId],
  );

  // ---- keyboard: F fits, M toggles the Overview, Esc clears the selection ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "f") fit();
      else if (k === "m") ui.toggleOverview();
      else if (k === "escape") setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fit, ui]);

  // ---- card changes: applied at once, saved in order, undone on refusal ----
  const queue = useRef(new Map<string, Promise<void>>());
  const versions = useRef(new Map(initialCards.map((c) => [c.id, c.version])));

  const patchCard = useCallback((id: string, patch: CardPatch) => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== id) return n;
        const card = { ...n.data.card, ...patch };
        return { ...n, position: { x: card.x, y: card.y }, height: cardHeight(card), data: { card } };
      }),
    );
  }, []);

  const change = useCallback(
    (id: string, patch: CardPatch, undo: CardPatch) => {
      patchCard(id, patch);
      const previous = queue.current.get(id) ?? Promise.resolve();
      const next = previous.then(async () => {
        let result: SaveCardResult;
        try {
          result = await saveCard({ canvasItemId: id, expectedVersion: versions.current.get(id) ?? 1, ...patch });
        } catch {
          result = { ok: false, message: "Something went wrong. Nothing was saved." };
        }
        if (result.ok) versions.current.set(id, result.value.version);
        else {
          patchCard(id, undo);
          toast(result.message, "refusal");
        }
      });
      queue.current.set(id, next);
    },
    [patchCard, saveCard, toast],
  );

  const cardsApi = useMemo<CanvasCardsApi>(
    () => ({
      editable,
      selection,
      select: setSelection,
      toggleCollapse: (id) => {
        const card = (rf.getNode(id) as CardNodeT | undefined)?.data.card;
        if (card) change(id, { collapsed: !card.collapsed }, { collapsed: card.collapsed });
      },
      cycleFilter: (id) => {
        const card = (rf.getNode(id) as CardNodeT | undefined)?.data.card;
        if (!card) return;
        const next = FILTER_ORDER[(FILTER_ORDER.indexOf(card.rowFilter) + 1) % FILTER_ORDER.length]!;
        change(id, { rowFilter: next }, { rowFilter: card.rowFilter });
      },
    }),
    [editable, selection, change, rf],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<CardNodeT>[]) => setNodes((ns) => applyNodeChanges(changes, ns)),
    [],
  );

  /** A drag ends: save the new position (S1A-05); a refusal puts the card back. */
  const onNodeDragStop: OnNodeDrag<CardNodeT> = useCallback(
    (_, node) => {
      const card = node.data.card;
      const x = Math.round(node.position.x), y = Math.round(node.position.y);
      if (x === card.x && y === card.y) return;
      change(node.id, { x, y }, { x: card.x, y: card.y });
    },
    [change],
  );

  return (
    <CanvasCardsCtx.Provider value={cardsApi}>
      <div
        className="im-canvas"
        data-testid="area-canvas"
        data-ready={ready || undefined}
        data-notation={ui.notation}
        style={{ visibility: ready ? "visible" : "hidden" }}
      >
        <ReactFlow
          nodes={nodes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={() => setSelection(null)}
          nodeTypes={nodeTypes}
          nodesDraggable={editable}
          nodesConnectable={false}
          elementsSelectable={false}
          snapToGrid
          snapGrid={[8, 8]}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          panOnDrag={[1, 2]}
          panActivationKeyCode="Space"
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onMoveEnd={onMoveEnd}
          attributionPosition="bottom-left"
          aria-label="Model canvas"
        >
          <LineLayer lines={lines} selection={selection} related={related} onSelect={setSelection} />
          <Overview lines={lines} />
        </ReactFlow>
        {nodes.length === 0 && (
          <div className="im-empty" data-testid="canvas-empty">
            <div>
              <b>The canvas is empty</b>
              Drag entities and source tables here from the left panel.
            </div>
          </div>
        )}
      </div>
    </CanvasCardsCtx.Provider>
  );
}
