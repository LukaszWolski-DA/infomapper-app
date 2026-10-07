"use client";

// The model canvas (AD-24): React Flow with one node per card, positions from data, all lines in one layer, and the
// report's CSS rules (no React Flow <Background>, no opacity on repeated elements, will-change on the viewport).
// Navigation as in the prototype: the wheel pans, Ctrl/pinch zooms, Space-drag or the middle/right button pans;
// F fits, M toggles the Overview, Esc clears the selection. The last view of each canvas is remembered in the
// browser (data model section 12). Cards are dragged by their header, snapped to 8 px, and saved when the drag ends.
// Items from the left panel are placed by a click (a free spot in the view) or dropped where the mouse is.
// After a write the server sends fresh cards; a card with a save still on its way keeps what the user did.
// Slice 1b: feeding sources and fed entities are placed beside a card in one change (B-08); Delete removes a selected
// line at once, with Undo in the toast.
// Slice 2a: several cards are selected with a lasso on the empty canvas, Shift+click or Ctrl+A (`selection.ts`); the
// marks are drawn in an overlay. H turns the Hand tool on, V or Esc off. Dragging a selected card moves the group,
// arrow keys nudge the selection, and the group's actions (toolbox, selection panel) are in `GroupActions.ts`.
// Each canvas has its look (`look.tsx`): the grid is one CSS background on the pane that follows the view, and the
// layer mode hides the relationship or the mapping lines. A card named in `focusCardId` is selected and shown on arrival
// (“On canvases” in the panels). The measurement-only build may switch off the line layer or draw every card as a block
// (`diagnosis`), to find what the frame time is spent on.

import { useCallback, useContext, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
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
import { withClips, type CardData } from "./card-data";
import CardNode, { FILTER_ORDER, type CardNodeT } from "./CardNode";
import { RelateLine, useCanvasModes } from "./CanvasModes";
import { useCardResize } from "./CardResize";
import { DraftLine, useColumnDrag } from "./ColumnDrag";
import { NUDGE, useGroupActions, type GroupWrites } from "./GroupActions";
import HoverOverlay from "./HoverOverlay";
import { useLasso } from "./Lasso";
import SelectionOverlay from "./SelectionOverlay";
import { afterLasso, cardKey, fromKeys, lassoHits, toggleCard as toggledSelection, type CardBox } from "./selection";
import { fitWidth as fitWidthOf } from "./text-fit";
import { readPreference, writePreference } from "./CanvasProvider";
import { CanvasCardsCtx, CanvasUiCtx, CARD_DRAG_TYPE, DiagnosisCtx, type CanvasCardsApi, type CardTarget, type ColumnDrop, type Diagnosis } from "./context";
import {
  besideSpots,
  CARD_W,
  cardHeight,
  cardWidth,
  contentBounds,
  fitViewport,
  freeSpot,
  inside,
  MAX_ZOOM,
  MIN_ZOOM,
  newCardHeight,
  snap8,
  stackSpot,
  type Rect,
} from "./geometry";
import { relatedLines, type CanvasLines, type Selection } from "./line-data";
import { useCanvasLook } from "./look";
import { viewKey } from "./views";
import LineLayer from "./LineLayer";
import { Overview } from "./Overview";

const nodeTypes = { card: CardNode };
const NO_DIAGNOSIS: Diagnosis = {};

/** How far the grid layer reaches past the pane: the largest grid step (Lines at the highest zoom). Also in canvas.css. */
const GRID_BLEED = 32 * MAX_ZOOM;

export interface CardChange {
  canvasItemId: string;
  expectedVersion: number;
  collapsed?: boolean;
  rowFilter?: CardData["rowFilter"];
  x?: number;
  y?: number;
  width?: number | null;
}
/** What a canvas write returns: the value, or the domain's message for a toast. */
export type CanvasWriteResult<T> = { ok: true; value: T } | { ok: false; message: string };
export type SaveCardResult = CanvasWriteResult<{ version: number }>;

export interface ModelCanvasProps {
  canvasId: string;
  cards: CardData[];
  lines: CanvasLines;
  editable: boolean;
  /** Saves a card's position, collapse state or row filter (a server action). */
  saveCard: (change: CardChange) => Promise<SaveCardResult>;
  /** Places an entity or a source table on this canvas (a server action). */
  placeCard: (input: CardTarget & { x: number; y: number }) => Promise<CanvasWriteResult<{ canvasItemId: string }>>;
  /** Places several elements on this canvas in one change (a server action). */
  placeCards: (cards: (CardTarget & { x: number; y: number })[]) => Promise<CanvasWriteResult<{ canvasItemIds: string[] }>>;
  /** Takes a card off this canvas (a server action). */
  removeCard: (input: { canvasItemId: string; expectedVersion: number }) => Promise<CanvasWriteResult<unknown>>;
  /** A group of selected cards: moved, arranged, sized or removed in one change (slice 2a, server actions). */
  moveCards: GroupWrites["moveCards"];
  arrangeCards: GroupWrites["arrangeCards"];
  setCardWidths: GroupWrites["setCardWidths"];
  removeCards: GroupWrites["removeCards"];
  /** A card to select and bring into view once the canvas is ready (“On canvases”, slice 2a); then the address
   * loses its query, so a reload keeps the remembered view. */
  focusCardId?: string | null;
  /** Measurement-only switches (only the measurement-only production build passes them). */
  diagnosis?: Diagnosis;
}

type CardPatch = Partial<Pick<CardData, "collapsed" | "rowFilter" | "x" | "y" | "width">>;

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

const FAILED = { ok: false as const, message: "Something went wrong. Nothing was saved." };
const isEntity = (t: CardTarget): t is { entityId: string } => "entityId" in t;

export function ModelCanvas({
  canvasId,
  cards: initialCards,
  lines: allLines,
  editable,
  saveCard,
  placeCard,
  placeCards,
  removeCard,
  moveCards,
  arrangeCards,
  setCardWidths,
  removeCards,
  focusCardId,
  diagnosis = NO_DIAGNOSIS,
}: ModelCanvasProps) {
  const ui = useContext(CanvasUiCtx);
  const look = useCanvasLook()?.look;
  const layer = look?.layer ?? "all";
  const grid = look?.grid ?? "dots";
  // Layer mode (D-22): Mappings hides the relationship lines, Relationships the mapping lines; cards stay.
  const lines = useMemo<CanvasLines>(
    () =>
      diagnosis.noLines
        ? { mappings: [], relationships: [] }
        : layer === "all"
        ? allLines
        : { mappings: layer === "relationships" ? [] : allLines.mappings, relationships: layer === "mappings" ? [] : allLines.relationships },
    [allLines, layer, diagnosis.noLines],
  );
  const { selection, select, registerCanvas } = ui;
  const toast = useToast();
  const rf = useReactFlow();
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const [nodes, setNodes] = useState<CardNodeT[]>(() => initialCards.map((c) => toNode(c, editable)));
  const [ready, setReady] = useState(false);
  /** The row or line under the mouse (C-10); it takes over the emphasis from the selection while it lasts. */
  const [hover, setHover] = useState<Selection>(null);
  const related = useMemo(() => relatedLines(selection, lines), [selection, lines]);
  const hoverRelated = useMemo(() => relatedLines(hover, lines), [hover, lines]);
  const onColumnDrop = useCallback((drop: ColumnDrop) => ui.host()?.dropColumn(drop), [ui]);
  const { draft, onPointerDown } = useColumnDrag(editable, onColumnDrop);
  const modes = useCanvasModes(editable);

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

  // ---- the grid (D-12): one CSS background behind the pane, on its own layer. Panning moves that layer by less than
  // one grid step (no repaint); zooming changes the step. Set without a render. ----
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = gridRef.current;
    if (!el || grid === "none") return;
    const step = grid === "lines" ? 32 : 16; // prototype applyT
    let last: readonly number[] | null = null;
    let lastSize = 0;
    const follow = (t: readonly [number, number, number]) => {
      if (t === last) return;
      last = t;
      const size = step * t[2];
      if (size !== lastSize) el.style.backgroundSize = `${size}px ${size}px`;
      lastSize = size;
      // the layer reaches GRID_BLEED past every edge, so a shift of up to one step keeps the pane covered
      const shift = (v: number) => (((v + GRID_BLEED) % size) + size) % size;
      el.style.transform = `translate3d(${shift(t[0])}px, ${shift(t[1])}px, 0)`;
    };
    follow(storeApi.getState().transform);
    return storeApi.subscribe((s) => follow(s.transform));
  }, [grid, storeApi]);

  // ---- several cards (slice 2a): the cards as keys and rectangles, select all, Shift+click, lasso ----
  const boxes = useCallback(
    (): CardBox[] =>
      (rf.getNodes() as CardNodeT[]).map(({ id, position, data: { card } }) => ({
        id,
        key: cardKey(card),
        rect: { x: position.x, y: position.y, w: cardWidth(card), h: cardHeight(card) },
      })),
    [rf],
  );
  const selectAll = useCallback(() => select(fromKeys(boxes().map((b) => b.key), boxes())), [select, boxes]);
  const toggleCard = useCallback((cardId: string) => select(toggledSelection(selection, cardId, boxes())), [select, selection, boxes]);
  const onLasso = useCallback(
    (rect: Rect, add: boolean) => {
      const all = boxes();
      select(afterLasso(selection, lassoHits(all, rect), add, all));
    },
    [select, selection, boxes],
  );
  const lasso = useLasso(onLasso);

  // Cards that left the canvas (removed, undone) leave the selection too; checked when the set of cards changes, not on
  // every frame of a drag.
  const cardIds = useMemo(() => nodes.map((n) => n.id).join(","), [nodes]);
  useEffect(() => {
    if (selection?.t !== "multi") return;
    const next = fromKeys(selection.keys, boxes());
    if (next?.t !== "multi" || next.keys.length !== selection.keys.length) select(next);
  }, [cardIds, selection, select, boxes]);

  // ---- keyboard: F fits, M toggles the Overview, E the Entity tool; Esc ends a tool, else clears the selection ----
  const { toggleEntityTool, toggleHandTool } = modes;
  /** Space held: a left drag pans (React Flow), so it must not start a lasso. */
  const spaceDown = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === "Space") spaceDown.current = true;
      // Ctrl+A (⌘A) selects every card on the canvas
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll();
        return;
      }
      // Ctrl or Alt + up/down moves the selected attribute, with Shift to the top or bottom (D-36)
      if ((e.ctrlKey || e.altKey) && (e.key === "ArrowUp" || e.key === "ArrowDown") && editable && selection?.t === "row") {
        const card = (rf.getNode(selection.cardId) as CardNodeT | undefined)?.data.card;
        if (card?.kind !== "ent") return;
        e.preventDefault();
        const up = e.key === "ArrowUp";
        ui.host()?.moveAttribute(selection.id, e.shiftKey ? (up ? "top" : "bottom") : up ? "up" : "down");
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === "Delete" || e.key === "Backspace") && editable && (selection?.t === "map" || selection?.t === "rel")) {
        e.preventDefault();
        ui.host()?.deleteLine({ t: selection.t, id: selection.id });
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "f") fit();
      else if (k === "m") ui.toggleOverview();
      else if (k === "e") toggleEntityTool();
      else if (k === "h") toggleHandTool();
      else if (k === "v" && ui.mode?.kind === "hand") ui.setMode(null);
      else if (k === "escape") {
        if (ui.mode) ui.setMode(null);
        else select(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    const onBlur = () => (spaceDown.current = false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [fit, ui, select, toggleEntityTool, toggleHandTool, selectAll, editable, selection, rf]);

  // ---- card changes: applied at once, saved in order, undone on refusal ----
  const queue = useRef(new Map<string, Promise<void>>());
  const versions = useRef(new Map(initialCards.map((c) => [c.id, c.version])));
  /** Writes still on their way, per card. */
  const pending = useRef(new Map<string, number>());

  /** Runs a card's writes one after the other, so each one sends the version the previous one returned. */
  const enqueue = useCallback((id: string, write: () => Promise<void>) => {
    pending.current.set(id, (pending.current.get(id) ?? 0) + 1);
    const next = (queue.current.get(id) ?? Promise.resolve()).then(write).finally(() => {
      pending.current.set(id, (pending.current.get(id) ?? 1) - 1);
    });
    queue.current.set(id, next);
  }, []);

  /** Runs a write for several cards after every write still on its way for any of them (slice 2a). */
  const enqueueGroup = useCallback((ids: readonly string[], write: () => Promise<void>) => {
    for (const id of ids) pending.current.set(id, (pending.current.get(id) ?? 0) + 1);
    const next = Promise.all(ids.map((id) => queue.current.get(id) ?? Promise.resolve()))
      .then(write)
      .finally(() => {
        for (const id of ids) pending.current.set(id, (pending.current.get(id) ?? 1) - 1);
      });
    for (const id of ids) queue.current.set(id, next);
  }, []);

  // ---- fresh cards from the server (after a place, remove or rename): take them, except what is still saving ----
  useEffect(() => {
    // The server's cards arrive as props after each write.
    setNodes((ns) => {
      const local = new Map(ns.map((n) => [n.id, n]));
      return initialCards.map((c) => {
        const mine = local.get(c.id);
        if (!mine || (!(pending.current.get(c.id) ?? 0) && !mine.dragging)) return toNode(c, editable);
        const { x, y, collapsed, rowFilter, width } = mine.data.card;
        return { ...toNode({ ...c, x, y, collapsed, rowFilter, width }, editable), position: mine.position, dragging: mine.dragging };
      });
    });
    for (const c of initialCards) if (!(pending.current.get(c.id) ?? 0)) versions.current.set(c.id, c.version);
  }, [initialCards, editable]);

  const patchCard = useCallback((id: string, patch: CardPatch) => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== id) return n;
        const merged = { ...n.data.card, ...patch };
        const card = patch.width !== undefined ? withClips(merged) : merged;
        return { ...n, position: { x: card.x, y: card.y }, width: cardWidth(card), height: cardHeight(card), data: { card } };
      }),
    );
  }, []);

  const change = useCallback(
    (id: string, patch: CardPatch, undo: CardPatch) => {
      patchCard(id, patch);
      enqueue(id, async () => {
        let result: SaveCardResult;
        try {
          result = await saveCard({ canvasItemId: id, expectedVersion: versions.current.get(id) ?? 1, ...patch });
        } catch {
          result = FAILED;
        }
        if (result.ok) {
          versions.current.set(id, result.value.version);
          ui.undo()?.noteSaved();
        } else {
          patchCard(id, undo);
          toast(result.message, "refusal");
        }
      });
    },
    [patchCard, saveCard, toast, enqueue, ui],
  );

  // ---- card width (D-37, C-09) ----
  const resize = useCardResize(editable, change);
  const fitWidth = useCallback(
    (id: string) => {
      const card = (rf.getNode(id) as CardNodeT | undefined)?.data.card;
      if (!card) return;
      const width = fitWidthOf({ kind: card.kind, name: card.name, coverage: `${card.mapped}/${card.rows.length}`, rows: card.rows });
      if (width !== card.width) change(id, { width }, { width: card.width });
      toast("Fitted the card to its names.");
    },
    [rf, change, toast],
  );

  // ---- placing and removing cards (left and right panel) ----
  /** The part of the board the user sees, in canvas coordinates. */
  const viewRect = useCallback((): Rect => {
    const { width: w, height: h, transform: [tx, ty, z] } = storeApi.getState();
    return { x: -tx / z, y: -ty / z, w: w / z, h: h / z };
  }, [storeApi]);

  const occupied = useCallback(
    (): Rect[] =>
      (rf.getNodes() as CardNodeT[]).map((n) => ({
        x: n.position.x,
        y: n.position.y,
        w: cardWidth(n.data.card),
        h: cardHeight(n.data.card),
      })),
    [rf],
  );

  /** Moves the view so a box is in the middle (prototype centerOn); of a tall card the top part shows. */
  const centerOnRect = useCallback(
    (r: Rect) => {
      const { width: w, height: h, transform: [, , z] } = storeApi.getState();
      const x = w / 2 - (r.x + r.w / 2) * z;
      const y = h / 2 - (r.y + Math.min(r.h, (h / z) * 0.8) / 2) * z;
      void rf.setViewport({ x, y, zoom: z }, { duration: 250 });
    },
    [rf, storeApi],
  );

  const centerOn = useCallback(
    (cardId: string) => {
      const n = rf.getNode(cardId) as CardNodeT | undefined;
      if (n) centerOnRect({ x: n.position.x, y: n.position.y, w: cardWidth(n.data.card), h: cardHeight(n.data.card) });
    },
    [rf, centerOnRect],
  );

  // A card asked for on arrival (“On canvases”): selected and in view, once the view is set.
  const focused = useRef(false);
  useEffect(() => {
    if (!ready || !focusCardId || focused.current) return;
    focused.current = true;
    if (rf.getNode(focusCardId)) {
      select({ t: "card", id: focusCardId });
      centerOn(focusCardId);
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, [ready, focusCardId, rf, select, centerOn]);

  const cardOf = useCallback(
    (t: CardTarget) =>
      (rf.getNodes() as CardNodeT[]).find(({ data: { card } }) =>
        isEntity(t) ? card.kind === "ent" && card.targetId === t.entityId : card.kind === "src" && card.targetId === t.sourceTableId,
      ),
    [rf],
  );

  /** Places an element at a spot; an element already here is selected and shown instead (prototype addToCanvas). */
  const placeAt = useCallback(
    async (target: CardTarget, spot: { x: number; y: number }, h: number, clicked: boolean) => {
      const here = cardOf(target);
      if (here) {
        select({ t: "card", id: here.id });
        centerOn(here.id);
        return;
      }
      let result: CanvasWriteResult<{ canvasItemId: string }>;
      try {
        result = await placeCard({ ...target, ...spot });
      } catch {
        result = FAILED;
      }
      if (!result.ok) {
        toast(result.message, "refusal");
        return;
      }
      select({ t: "card", id: result.value.canvasItemId });
      const box = { ...spot, w: CARD_W, h };
      if (!inside(viewRect(), box)) centerOnRect(box);
      if (clicked) toast(`Added 1 ${isEntity(target) ? "entity" : "source table"} to the canvas.`);
    },
    [cardOf, select, centerOn, centerOnRect, placeCard, toast, viewRect],
  );

  const place = useCallback(
    (target: CardTarget, rows: number, options?: { quiet?: boolean }) => {
      const h = newCardHeight(rows);
      void placeAt(target, stackSpot(viewRect(), occupied(), h), h, !options?.quiet);
    },
    [placeAt, viewRect, occupied],
  );

  const remove = useCallback(
    (cardId: string) => {
      enqueue(cardId, async () => {
        let result: CanvasWriteResult<unknown>;
        try {
          result = await removeCard({ canvasItemId: cardId, expectedVersion: versions.current.get(cardId) ?? 1 });
        } catch {
          result = FAILED;
        }
        if (!result.ok) {
          toast(result.message, "refusal");
          return;
        }
        setNodes((ns) => ns.filter((n) => n.id !== cardId));
        select(null);
        const undo = ui.undo();
        toast("Removed from this canvas. It stays in the model, with its mappings and on other canvases.", "info", undo ? { label: "Undo", run: undo.undo } : undefined);
      });
    },
    [enqueue, removeCard, select, toast, ui],
  );

  /** Feeding sources (left) or fed entities (right) beside a card, in one change (prototype placeNear, B-08). */
  const placeBeside = useCallback(
    async (wanted: readonly { target: CardTarget; rows: number }[], anchorCardId: string, side: "left" | "right") => {
      const anchor = rf.getNode(anchorCardId) as CardNodeT | undefined;
      if (!anchor) return;
      const missing = wanted.filter((w) => !cardOf(w.target));
      if (!missing.length) {
        toast("Everything is already on this canvas.");
        return;
      }
      const a: Rect = { x: anchor.position.x, y: anchor.position.y, w: cardWidth(anchor.data.card), h: cardHeight(anchor.data.card) };
      const heights = missing.map((m) => newCardHeight(m.rows));
      const spots = besideSpots(a, side, heights, occupied());
      let result: CanvasWriteResult<{ canvasItemIds: string[] }>;
      try {
        result = await placeCards(missing.map((m, i) => ({ ...m.target, ...spots[i]! })));
      } catch {
        result = FAILED;
      }
      if (!result.ok) {
        toast(result.message, "refusal");
        return;
      }
      if (result.value.canvasItemIds.length === 1) select({ t: "card", id: result.value.canvasItemIds[0]! });
      // Bring the new cards into view if they landed outside it.
      const placed = spots.map((p, i) => ({ ...p, w: CARD_W, h: heights[i]! }));
      if (placed.some((r) => !inside(viewRect(), r))) {
        const all = [a, ...placed];
        const x0 = Math.min(...all.map((r) => r.x)), y0 = Math.min(...all.map((r) => r.y));
        const x1 = Math.max(...all.map((r) => r.x + r.w)), y1 = Math.max(...all.map((r) => r.y + r.h));
        void rf.fitBounds({ x: x0 - 40, y: y0 - 40, width: x1 - x0 + 80, height: y1 - y0 + 80 }, { duration: 250, padding: 0 });
      }
      const n = missing.length;
      const what = isEntity(missing[0]!.target) ? `entit${n === 1 ? "y" : "ies"}` : `source table${n === 1 ? "" : "s"}`;
      toast(`Added ${n} ${what} next to the selection.`);
    },
    [rf, cardOf, toast, occupied, placeCards, select, viewRect],
  );

  // ---- several selected cards (slice 2a): group drag, nudge and the group's actions ----
  const group = useGroupActions({
    editable,
    selection,
    select,
    setNodes,
    patchCard,
    enqueueGroup,
    versions,
    pending,
    occupied,
    viewRect,
    undo: ui.undo,
    moveCards,
    arrangeCards,
    setCardWidths,
    removeCards,
    placeCards,
  });

  // Arrow keys nudge the selected cards by 8 px, with Shift by 32 px (outside text fields).
  const { nudge } = group;
  useEffect(() => {
    const steps: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const onKey = (e: KeyboardEvent) => {
      const d = steps[e.key];
      if (!d || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const step = e.shiftKey ? NUDGE.big : NUDGE.step;
      if (nudge(d[0] * step, d[1] * step)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nudge]);

  /** Every card change still on its way, saved. */
  const settled = useCallback(async () => {
    await Promise.all([...queue.current.values()]);
  }, []);

  useEffect(() => {
    registerCanvas({
      fit,
      place,
      remove,
      centerOn,
      freeSpot: () => freeSpot(viewRect(), occupied()),
      fitWidth,
      placeBeside: (cards, anchorCardId, side) => void placeBeside(cards, anchorCardId, side),
      settled,
      cardView: (id) => {
        const card = (rf.getNode(id) as CardNodeT | undefined)?.data.card;
        return card ? { collapsed: card.collapsed, rowFilter: card.rowFilter } : null;
      },
      selectAll,
      arrangeSelection: group.arrangeSelection,
      fitSelectionWidths: group.fitSelectionWidths,
      removeSelection: group.removeSelection,
      placeSourcesOfSelection: group.placeSourcesOfSelection,
      placeAt: (target, rows, at) => void placeAt(target, { x: snap8(at.x - CARD_W / 2), y: snap8(at.y - 20) }, newCardHeight(rows), false),
      setCardView: (id, view) => {
        const card = (rf.getNode(id) as CardNodeT | undefined)?.data.card;
        if (!card) return;
        const undo: CardPatch = {};
        if (view.collapsed !== undefined) undo.collapsed = card.collapsed;
        if (view.rowFilter !== undefined) undo.rowFilter = card.rowFilter;
        change(id, view, undo);
      },
    });
    return () => registerCanvas(null);
  }, [registerCanvas, fit, place, remove, centerOn, viewRect, occupied, placeAt, change, rf, fitWidth, placeBeside, settled, selectAll, group.arrangeSelection, group.fitSelectionWidths, group.removeSelection, group.placeSourcesOfSelection]);

  // ---- an item dropped from the left panel: the top middle of its card goes where the mouse is ----
  const onDragOver = useCallback((e: DragEvent) => {
    if (!e.dataTransfer.types.includes(CARD_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      const raw = e.dataTransfer.getData(CARD_DRAG_TYPE);
      if (!raw) return;
      e.preventDefault();
      let data: { target: CardTarget; rows: number };
      try {
        data = JSON.parse(raw) as { target: CardTarget; rows: number };
      } catch {
        return;
      }
      const at = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      void placeAt(data.target, { x: snap8(at.x - CARD_W / 2), y: snap8(at.y - 20) }, newCardHeight(data.rows), false);
    },
    [rf, placeAt],
  );

  const cardsApi = useMemo<CanvasCardsApi>(
    () => ({
      editable,
      selection,
      select,
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
      startRelate: modes.startRelate,
      fitWidth,
      toggleCard,
    }),
    [editable, selection, select, change, rf, modes.startRelate, fitWidth, toggleCard],
  );

  // A selected card dragged in a group moves the others too, in the same update (slice 2a).
  const { withGroup, onNodeDragStart: groupDragStart, onGroupDragStop } = group;
  const onNodesChange = useCallback(
    (changes: NodeChange<CardNodeT>[]) => {
      const all = withGroup(changes);
      setNodes((ns) => applyNodeChanges(all, ns));
    },
    [withGroup],
  );
  /** A card (or a group) is being dragged: will-change is off on the viewport meanwhile, as for a resize (AD-24). */
  const [dragging, setDragging] = useState(false);
  const onNodeDragStart: OnNodeDrag<CardNodeT> = useCallback(
    (_, node) => {
      setDragging(true);
      groupDragStart(node);
    },
    [groupDragStart],
  );

  /** A drag ends: save the new position (S1A-05); a refusal puts the card back. */
  const onNodeDragStop: OnNodeDrag<CardNodeT> = useCallback(
    (_, node) => {
      setDragging(false);
      if (onGroupDragStop()) return;
      const card = node.data.card;
      const x = Math.round(node.position.x), y = Math.round(node.position.y);
      if (x === card.x && y === card.y) return;
      change(node.id, { x, y }, { x: card.x, y: card.y });
    },
    [change, onGroupDragStop],
  );

  // ---- hover (C-10): a row of a card or a mapping line; nothing while dragging or with a tool on ----
  const busy = !!draft || !!ui.mode || resize.resizing || !!lasso.lasso;
  const onHoverOver = useCallback((e: React.PointerEvent) => {
    if (e.buttons) return;
    const el = e.target as Element;
    const row = el.closest<HTMLElement>(".row[data-row]");
    const cardId = row?.closest<HTMLElement>("[data-card]")?.dataset.card;
    const mappingId = el.closest<SVGElement>("[data-mapping]")?.dataset.mapping;
    const next: Selection = row && cardId ? { t: "row", cardId, id: row.dataset.row! } : mappingId ? { t: "map", id: mappingId } : null;
    setHover((h) => (h?.t === next?.t && (h && "id" in h ? h.id : null) === (next && "id" in next ? next.id : null) ? h : next));
  }, []);

  return (
    <DiagnosisCtx.Provider value={diagnosis}>
    <CanvasCardsCtx.Provider value={cardsApi}>
      <div
        className={`im-canvas${ui.mode?.kind === "entity" ? " tool-entity" : ""}${ui.mode?.kind === "relate" ? " relating" : ""}${ui.mode?.kind === "hand" ? " tool-hand" : ""}${modes.panning ? " panning" : ""}${resize.resizing ? " resizing" : ""}${dragging ? " node-dragging" : ""}`}
        data-testid="area-canvas"
        data-grid={grid}
        data-layer={layer}
        data-mode={ui.mode?.kind}
        data-ready={ready || undefined}
        data-notation={ui.notation}
        style={{ visibility: ready ? "visible" : "hidden" }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onPointerDown={(e) => {
          if (!ui.mode && !spaceDown.current) lasso.onPointerDown(e);
          onPointerDown(e);
        }}
        onPointerDownCapture={(e) => {
          if (!resize.onPointerDown(e)) modes.onPointerDownCapture(e);
        }}
        onPointerOver={onHoverOver}
        onPointerLeave={() => setHover(null)}
        onContextMenu={modes.onContextMenu}
      >
        {grid !== "none" && <div className="im-grid" ref={gridRef} aria-hidden data-testid="canvas-grid" />}
        <ReactFlow
          nodes={nodes}
          onNodesChange={onNodesChange}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          // Shift+click on the empty canvas keeps the selection (prototype)
          onPaneClick={(e) => !e.shiftKey && select(null)}
          nodeTypes={nodeTypes}
          nodesDraggable={editable}
          nodesConnectable={false}
          elementsSelectable={false}
          snapToGrid
          snapGrid={[8, 8]}
          // React Flow takes the grab offset where the drag starts; with a threshold that is past the first mouse move,
          // so the card would trail the cursor by that move for the whole drag. 0 starts the drag on mouse down.
          // A click without a move still ends in onNodeDragStop, which saves nothing for an unchanged position.
          nodeDragThreshold={0}
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
          {!diagnosis.noLines && <LineLayer lines={lines} selection={selection} related={related} hover={busy ? null : hoverRelated} onSelect={select} />}
          <Overview lines={lines} />
          <HoverOverlay hover={busy ? null : hover} lines={lines} flash={ui.flash} outline={resize.outline} />
          <SelectionOverlay selection={selection} lasso={lasso.lasso} />
          {draft && <DraftLine draft={draft} />}
          {modes.relateFrom && modes.cursor && <RelateLine fromCardId={modes.relateFrom} cursor={modes.cursor} />}
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
    </DiagnosisCtx.Provider>
  );
}
