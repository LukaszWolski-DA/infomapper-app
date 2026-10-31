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
// Each canvas has its look (`look.tsx`): the grid is one CSS background on its own element behind the pane, following
// the view, and the layer mode hides the relationship or the mapping lines. A card named in `focusCardId` is selected and shown on arrival
// (“On canvases” in the panels). The measurement-only build may switch off the line layer or draw every card as a block
// (`diagnosis`), to find what the frame time is spent on; slice 2c: or show every frame collapsed (S2C-12).
// Slice 2b: frames in their own layer under the lines and cards (`FrameLayer`, `useFrames`); every change of positions
// and widths goes through `saveLayout`, which also decides the cards' frames. A draws a frame (the Frame tool); Delete
// removes a selected frame. Step 4: frames take part in the selection of several (`frame:` keys): a lasso around a
// whole frame, Shift+click on its name, Ctrl+A (every frame and the cards in no frame); the group moves and arranges
// frames with their cards.
// Slice 2c (D-07): a collapsed frame is drawn as a block, a node of its own kind (`BlockNode`); its cards stay in
// React Flow's store, hidden, with their places kept. The block stands for the frame (selection key frame:<id>). A card
// dragged onto a block, from the canvas or the left panel, is filed into the frame. Lines touching a collapsed frame are
// bundled per pair of ends (`bundleLines`), drawn by the line layer; a bundle can be selected (its panel, its toolbox).
// Slice 3a: notes in their own layer above the cards (`NoteLayer`, `useNotes`), placed from data; a pinned note's dashed
// tether is drawn by the line layer. N (or the toolbar) is the Note tool; Delete removes a selected note. Reviewers
// write notes too (`canNote`); the free notes of a moved frame move with it (`noteAt`, moveOnCanvas on the server).
// Step 4: notes take part in the selection (`note:` keys: click, Shift+click, lasso, Ctrl+A for free notes in no frame,
// group drag and nudge, each note moved once); a card's header and a collapsed block show the number of their notes
// shown (open, and resolved unless hidden); Fit everything counts the notes shown; resolved notes are hidden when the person chose so (`hideResolved`);
// `focusNoteId` selects a note on arrival (the project home's open notes).

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
import type { Uuid } from "@/domain/ids";
import { useToast } from "@/ui/components/toast";
import { rowSaves } from "@/ui/row-saves";
import { applyNames, shownText, withClips, type CanvasNames, type CardData } from "./card-data";
import { canvasMode, cardMode, NAMES_COLUMN, namesControl, type NameDimension } from "@/domain/model/aliases";
import type { NameMode } from "@/domain/types";
import { namesState } from "./names-state";
import CardNode, { cardNodesOf, filtersOf, type CardNodeT } from "./CardNode";
import BlockNode, { blockNodeId, type BlockNodeT } from "./BlockNode";
import RequirementCardNode, { reqNodesOf, type ReqNodeT } from "./RequirementCardNode";
import { REQ_CARD, requirementCardHeight, requirementCardHeightOf, type RequirementCardData } from "./requirement-card-data";
import { requirementCardSpots } from "@/domain/model/requirement-placement";
import type { TraceTarget } from "@/domain/model/requirements";
import { buildTraces, type TraceData } from "./trace-data";
import { DROP_TOAST, dropTargetAt, requirementDrag, sameDropTarget, type DropTarget } from "./requirement-drop";
import { DropHint, DropTargetMark, moveDropHint } from "./RequirementDrop";
import type { LabelTarget } from "@/domain/model/labels";
import { NOTE_TOOL_HINT, RelateLine, useCanvasModes } from "./CanvasModes";
import { useCardResize } from "./CardResize";
import { DraftLine, useColumnDrag } from "./ColumnDrag";
import { NUDGE, useGroupActions, type GroupWrites } from "./GroupActions";
import { conceptAsk, frameChips, frameColor, frameShape, frameStats, memberCounts, type FrameData } from "./frame-data";
import { conceptQuestions, frameAt as smallestFrameAt } from "@/domain/model/frames";
import { ConceptQuestion, type CanvasQuestion } from "./ConceptQuestion";
import { LIVE_ONE_AT_A_TIME } from "@/domain/model/live";
import FrameLayer, { type FramePart } from "./FrameLayer";
import { useFrames, type CardPatch, type FrameWrites, type ReqMover } from "./useFrames";
import HoverOverlay from "./HoverOverlay";
import { CoverageLayer } from "./CoverageLayer";
import { ChangesBar, ChangesDriver } from "./Changes";
import type { ChangesImport } from "./changes-import";
import { FocusDriver, focusTargetOf } from "./Focus";
import FadeLayer from "./FadeLayer";
import { useRequirementIndex, type FadeData, type FadeNote } from "./fade-canvas";
import { requirementMarks, sameMark } from "./requirement-marks";
import { useLasso } from "./Lasso";
import SelectionOverlay from "./SelectionOverlay";
import { afterLasso, allKeys, cardKey, frameKey, fromKeys, lassoHits, noteKey, reqKey, toggleCard as toggledSelection, toggleItem, unitsOf, type ItemBox } from "./selection";
import { fitWidth as fitWidthOf } from "./text-fit";
import { readPreference, writePreference } from "./CanvasProvider";
import { CanvasCardsCtx, CanvasUiCtx, CARD_DRAG_TYPE, DiagnosisCtx, REQ_CARD_DRAG_TYPE, REQ_DRAG_TYPE, type CanvasCardsApi, type CardTarget, type ColumnDrop, type Diagnosis, type NoteListItem } from "./context";
import {
  besideAnchor,
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
  HEAD_H,
  rowEnd,
  snap8,
  stackSpot,
  type Placed,
  type Rect,
} from "./geometry";
import { relatedLines, type CanvasLines, type Selection } from "./line-data";
import { useCanvasLook } from "./look";
import { viewKey } from "./views";
import type { PlaceGone } from "./context";
import { viewCounts } from "./view-counts";
import { canvasReady } from "./canvas-ready";
import LineLayer, { HoverLines } from "./LineLayer";
import { OverlayLayer } from "./OverlayLayer";
import { createValueStore } from "./value-store";
import { bundleLines, mapGeom, type Bundle } from "./line-geometry";
import { Overview, type MiniNote } from "./Overview";
import NoteLayer, { type ShownNote } from "./NoteLayer";
import { grownVersions, mergeFresh } from "./fresh";
import { countsKey, countsOf, frameNoteCounts, noteAt, noteShown, cardNoteCounts, placesOf, tether, type NoteData } from "./note-data";
import { DRAFT_NOTE, NO_NOTE_WRITES, useNotes, type NoteMover, type NoteWrites } from "./useNotes";

const nodeTypes = { card: CardNode, block: BlockNode, req: RequirementCardNode };
const NO_REQ_CARDS: RequirementCardData[] = [];
const NO_BLOCK_NODES: BlockNodeT[] = [];
const NO_TRACES: TraceData[] = [];
const NO_DIAGNOSIS: Diagnosis = {};
const NO_FRAMES: FrameData[] = [];
const NO_CONCEPTS: Record<string, string> = {};
const NO_NOTES: NoteData[] = [];
const NO_IMPORTS: ChangesImport[] = [];

/** How far the grid layer reaches past the pane: the largest grid step (Lines at the highest zoom). Also in canvas.css. */
const GRID_BLEED = 32 * MAX_ZOOM;

export interface CardChange {
  canvasItemId: string;
  expectedVersion: number;
  collapsed?: boolean;
  rowFilter?: CardData["rowFilter"];
  /** A card's names or aliases (slice 11): the choice; the server stores none when it equals the canvas's mode. */
  entityNames?: NameMode;
  attributeNames?: NameMode;
}
type CardChangeFields = Omit<CardChange, "canvasItemId" | "expectedVersion">;
/** What a canvas write returns: the value, or the domain's message for a toast. */
/** `versions`: the model rows a write wrote (a drop's concept change, slice 10a), for the panels' save chains. */
export type CanvasWriteResult<T> = { ok: true; value: T; versions?: Record<string, number> } | { ok: false; code?: string; message: string };
export type SaveCardResult = CanvasWriteResult<{ version: number }>;

export interface ModelCanvasProps {
  canvasId: string;
  cards: CardData[];
  /** The canvas's names or aliases (slice 11, D-64): what its entity cards show, fresh with every page. */
  names?: CanvasNames & { version: number };
  lines: CanvasLines;
  editable: boolean;
  /** Saves a card's collapse state or row filter (a server action). */
  saveCard: (change: CardChange) => Promise<SaveCardResult>;
  /** Places an entity or a source table on this canvas (a server action); with its height it joins the frame it lands in. */
  placeCard: (input: CardTarget & PlaceSpot & { frames: FrameRef[] }) => Promise<CanvasWriteResult<{ canvasItemId: string }>>;
  /** Places several elements on this canvas in one change (a server action). */
  placeCards: (cards: (CardTarget & PlaceSpot)[], frames: FrameRef[]) => Promise<CanvasWriteResult<{ canvasItemIds: string[] }>>;
  /** Takes a card off this canvas (a server action). */
  removeCard: (input: { canvasItemId: string; expectedVersion: number }) => Promise<CanvasWriteResult<unknown>>;
  /** Selected cards taken off the canvas in one change (slice 2a, a server action). */
  removeCards: GroupWrites["removeCards"];
  /** The canvas's frames (slice 2b), and the concepts' names and colours (concept frames, the drop's question). */
  frames: FrameData[];
  concepts: Record<string, { name: string; color: string }>;
  /** Frame writes and every change of positions and widths (slice 2b, server actions). */
  frameWrites: FrameWrites;
  /** Each entity's concept: a card dropped from the left panel on a concept frame's block may ask about it (slice 2c). */
  entityConcepts?: Record<string, string>;
  /** A card to select and bring into view once the canvas is ready (“On canvases”, slice 2a); then the address
   * loses its query, so a reload keeps the remembered view. */
  focusCardId?: string | null;
  /** A working label asked for on arrival (the project home's labels, slice 3a): its panel opens. */
  focusLabelId?: string | null;
  /** `?req=<id>` (slice 4a): open this requirement's panel on arrival. */
  focusRequirementId?: string | null;
  /** A note asked for on arrival (the project home's open notes, slice 3a): selected and in view. */
  focusNoteId?: string | null;
  /**
   * `?map=`, `?row=`, `?system=` (slice 7b, F15; the project home's model consistency): a mapping, a row (or the
   * element when its card is not here) or a source system, selected on arrival; a mapping and a row are brought into
   * view by their card (a mapping by its source's card, else its entity's; prototype `goTo`).
   */
  focusSelection?: Selection;
  /** The imports the Changes view's select offers, newest first (slice 7b, item 26). */
  changeImports?: readonly ChangesImport[];
  /** Measurement-only switches (only the measurement-only production build passes them). */
  diagnosis?: Diagnosis;
  /** What fading needs to work out what it lights (slice 4p): the live model and the requirements. */
  fadeData?: FadeData;
  /** The canvas's notes and their writes (slice 3a). */
  notes?: NoteData[];
  /** When the page read the data (server time): a fresh page may be older than the canvas (`mergeFresh`). */
  readAt?: string | null;
  noteWrites?: NoteWrites;
  /** May write notes: editors and reviewers, not archived (Łukasz's step 0 answer 1). */
  canNote?: boolean;
  /** The signed-in person's name (a new note's “by”). */
  userName?: string;
  /** A live label canvas (slice 3b): its label and what adding and removing a card does there. */
  live?: LiveCanvas | null;
  /** The canvas's requirement cards (slice 4b-2). */
  requirementCards?: RequirementCardData[];
  /** Links a requirement to an element (a requirement dropped from the left panel; a server action). */
  linkRequirement?: (input: { requirementId: string; target: LabelTarget }) => Promise<CanvasWriteResult<unknown>>;
  /** Places requirements' cards on this canvas in one change (a server action). */
  placeRequirementCards?: (cards: { requirementId: string; x: number; y: number }[]) => Promise<CanvasWriteResult<{ canvasItemIds: string[] }>>;
}

/** What a change of a live canvas left behind for its toast (“Added from …”, “No longer labeled …”; Q7). */
export interface LiveNotice {
  id: number;
  added: string[];
  removed: string[];
}

/** A live canvas (D-10, D-11, slice 3b): adding a card labels its element, taking one off unlabels it, after a question. */
export interface LiveCanvas {
  labelId: string;
  labelName: string;
  /** The names of the workspace's entities and source tables, for the questions. */
  names: Record<string, string>;
  /** Puts the label on an element (a click in the left panel, a feeding source): the sync places its card. */
  labelElement: (target: CardTarget) => Promise<CanvasWriteResult<unknown>>;
  /** “Remove from this canvas (unlabel)…” (a server action). */
  removeCard: (input: { canvasItemId: string; expectedVersion: number }) => Promise<CanvasWriteResult<{ name: string; label: string; mode: "direct" | "context"; what: string }>>;
  /** What this person's writes changed here, newest last (from the server; shown once, Q7). */
  notices: readonly LiveNotice[];
}

type PlaceSpot = { x: number; y: number; height: number };
type FrameRef = { frameId: string; expectedVersion: number };

/** A card's node; `keep` carries what the canvas added to its data (the pinned notes' number, the requirement marker). */
const toNode = (card: CardData, editable: boolean, keep?: Omit<CardNodeT["data"], "card">): CardNodeT => ({
  id: card.id,
  type: "card",
  position: { x: card.x, y: card.y },
  width: cardWidth(card),
  height: cardHeight(card),
  data: {
    card,
    ...(keep?.pinnedNotes ? { pinnedNotes: keep.pinnedNotes } : {}),
    ...(keep?.reqMark ? { reqMark: keep.reqMark } : {}),
  },
  draggable: editable,
  dragHandle: ".c-head",
  selectable: false,
  connectable: false,
  // React Flow lets clicks through nodes that are neither draggable nor selectable; cards have their own clicks.
  style: { pointerEvents: "all" },
});


/** A requirement card's node (slice 4b-2): 230 px, its height from its name; dragged anywhere on it. */
const toReqNode = (card: RequirementCardData, editable: boolean): ReqNodeT => ({
  id: card.id,
  type: "req",
  position: { x: card.x, y: card.y },
  width: REQ_CARD.width,
  height: requirementCardHeight(card.nameLines),
  data: { card },
  draggable: editable,
  selectable: false,
  connectable: false,
  style: { pointerEvents: "all" },
});

/**
 * A remembered view: the canvas's coordinates, and since slice 6a where the canvas's left edge was on the screen when it
 * was saved (`left`: the left panel's width, 0 when hidden or up to 1000 px wide). A view without it (saved before) is
 * read as it is.
 */
type SavedView = Viewport & { left?: number };

function readView(canvasId: string): SavedView | null {
  const raw = readPreference(viewKey(canvasId));
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as SavedView;
    if (!([v.x, v.y, v.zoom].every(Number.isFinite) && v.zoom >= MIN_ZOOM && v.zoom <= MAX_ZOOM)) return null;
    return Number.isFinite(v.left) ? v : { x: v.x, y: v.y, zoom: v.zoom };
  } catch {
    return null;
  }
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

const FAILED = { ok: false as const, message: "Something went wrong. Nothing was saved." };
const NO_NAMES: CanvasNames & { version: number } = { entity_names: null, attribute_names: null, version: 0 };
const CARD_KEY = { entity: "entityNames", attribute: "attributeNames" } as const satisfies Record<NameDimension, keyof CardData>;
/** A card without its exception in one dimension. */
const withoutException = (card: CardData, dimension: NameDimension): CardData => {
  const { [CARD_KEY[dimension]]: _gone, ...rest } = card;
  void _gone;
  return rest;
};
const isEntity = (t: CardTarget): t is { entityId: string } => "entityId" in t;

export function ModelCanvas({
  canvasId,
  cards: initialCards,
  names: pageNames = NO_NAMES,
  lines: allLines,
  editable,
  saveCard,
  placeCard,
  placeCards,
  removeCard,
  removeCards,
  frames: initialFrames,
  concepts,
  frameWrites,
  entityConcepts = NO_CONCEPTS,
  focusCardId,
  focusLabelId,
  focusRequirementId,
  focusNoteId,
  focusSelection,
  changeImports,
  diagnosis = NO_DIAGNOSIS,
  fadeData,
  notes: initialNotes = NO_NOTES,
  readAt = null,
  noteWrites,
  canNote = false,
  userName = "",
  live = null,
  requirementCards: initialReqCards = NO_REQ_CARDS,
  placeRequirementCards,
  linkRequirement,
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
        : layer === "relationships"
        ? { ...allLines, mappings: [] }
        : // Mappings also hides the relationships between source tables (slice 10b, D-62)
          { mappings: allLines.mappings, relationships: [] },
    [allLines, layer, diagnosis.noLines],
  );
  const { selection, select, registerCanvas } = ui;
  const toast = useToast();
  const rf = useReactFlow();
  // Whether the pane has a size yet; the size itself is read from the store where needed, so a resize of the pane
  // (a side panel shown, hidden or resized, slice 5a) never re-renders the canvas.
  const sized = useStore((s) => s.width > 0 && s.height > 0);
  // the canvas's names or aliases (slice 11): state, so a switch redraws the cards in one commit with the new texts
  const [names, setNamesState] = useState<CanvasNames>(() => ({ entity_names: pageNames.entity_names, attribute_names: pageNames.attribute_names }));
  const namesRef = useRef(names);
  /** Writes of the canvas's names still on their way: a fresh page keeps the names shown until they are saved. */
  const namesPending = useRef(0);
  const [nodes, setNodes] = useState<CardNodeT[]>(() => initialCards.map((c) => toNode(applyNames(c, pageNames), editable)));
  // Development only (slice 2c, S2C-12): every commit of the canvas is counted, so a spec can check that nothing
  // re-renders the canvas while nobody touches it (a render loop once cost a collapsed canvas a third of its frames).
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const w = window as unknown as { __imCanvasCommits?: number };
      w.__imCanvasCommits = (w.__imCanvasCommits ?? 0) + 1;
    }
  });
  const [ready, setReady] = useState(false);
  /**
   * The row or line under the mouse (C-10). A store, not state (slice 4p, trial A): a hover re-renders only the overlay
   * that draws it, never the canvas.
   */
  const [hoverStore] = useState(() =>
    createValueStore<Selection>(null, (a, b) => a?.t === b?.t && (a && "id" in a ? a.id : null) === (b && "id" in b ? b.id : null)),
  );
  const related = useMemo(() => relatedLines(selection, lines), [selection, lines]);
  const onColumnDrop = useCallback((drop: ColumnDrop) => ui.host()?.dropColumn(drop), [ui]);
  const { draft, onPointerDown } = useColumnDrag(editable, onColumnDrop);
  const modes = useCanvasModes(editable);

  // ---- view: the remembered one, else fit everything ----
  const storeApi = useStoreApi();
  /** Everything on the canvas: the cards and the frames with their labels (slice 2b). */
  const framesNowRef = useRef<() => readonly FrameData[]>(() => initialFrames);
  /**
   * The notes drawn now (slice 3a): their rectangles, and for the selection a free note's frame or what a pinned note
   * hangs on. A new card does not go under one (prototype freeSpot); Fit everything counts them.
   */
  const noteBoxesRef = useRef<{ id: string; rect: Rect; frameId: string | null; pinnedTo: string | null }[]>([]);
  /** The cards drawn now: not those of a collapsed frame (slice 2c). */
  const cardsNow = useCallback(() => {
    const collapsed = new Set(framesNowRef.current().filter((f) => f.collapsed).map((f) => f.id));
    return cardNodesOf(rf).map((n) => n.data.card).filter((c) => !c.frameId || !collapsed.has(c.frameId));
  }, [rf]);
  /** What stands for each frame now: the frame with its label, or its block when collapsed (slice 2c). */
  const frameRectsNow = useCallback((): { f: FrameData; r: Rect }[] => {
    const counts = memberCounts(cardNodesOf(rf).map((n) => n.data.card));
    return framesNowRef.current().map((f) => ({ f, r: frameShape(f, counts) }));
  }, [rf]);
  const fitView = useCallback(
    (w: number, h: number) => {
      // the notes shown count too (slice 3a, item 14; prototype contentBounds)
      const boxes = [
        contentBounds(cardsNow()),
        ...frameRectsNow().map(({ f, r }) => (f.collapsed ? r : { x: r.x, y: r.y - 30, w: r.w, h: r.h + 30 })),
        ...noteBoxesRef.current.map((b) => b.rect),
        // requirement cards count too (slice 4b-2, I; prototype fit)
        ...reqNodesOf(rf).map(({ position, data: { card } }) => ({ x: position.x, y: position.y, w: REQ_CARD.width, h: requirementCardHeight(card.nameLines) })),
      ].filter((r) => r !== null);
      const bounds = boxes.length
        ? (() => {
            const x0 = Math.min(...boxes.map((r) => r.x)), y0 = Math.min(...boxes.map((r) => r.y));
            return { x: x0, y: y0, w: Math.max(...boxes.map((r) => r.x + r.w)) - x0, h: Math.max(...boxes.map((r) => r.y + r.h)) - y0 };
          })()
        : null;
      return fitViewport(bounds, { width: w, height: h }, ui.overviewOpen);
    },
    [cardsNow, frameRectsNow, ui.overviewOpen, rf],
  );

  const fit = useCallback(() => {
    const { width: w, height: h } = storeApi.getState();
    void rf.setViewport(fitView(w, h), { duration: 250 });
  }, [rf, storeApi, fitView]);
  /** No duration: React Flow sets the transform at once, so it reaches the screen with the panel's change (slice 5a). */
  const shiftView = useCallback(
    (dx: number) => {
      const [x, y, zoom] = storeApi.getState().transform;
      if (dx) void rf.setViewport({ x: x + dx, y, zoom });
    },
    [rf, storeApi],
  );

  // saved with the canvas's left edge on the screen (slice 6a, D-54): opened beside another left panel, the view is
  // moved by the difference, so the model stands where it stood
  const onMoveEnd = useCallback(
    (_: unknown, v: Viewport) => {
      const left = rootRef.current?.getBoundingClientRect().left;
      writePreference(viewKey(canvasId), JSON.stringify(left === undefined ? v : { ...v, left: Math.round(left) }));
    },
    [canvasId],
  );

  // ---- the grid (D-12): one CSS background behind the pane, on its own layer. Panning moves that layer by less than
  // one grid step (no repaint); zooming changes the step. Set without a render. ----
  const gridRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
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

  // ---- several cards (slice 2a) and frames (2b): their keys and rectangles, select all, Shift+click, lasso ----
  const boxes = useCallback(
    (): ItemBox[] => [
      // a collapsed frame by its block; its cards are hidden: a lasso does not catch them (slice 2c)
      ...frameRectsNow().map(({ f, r }) => ({ id: f.id, key: frameKey(f.id), rect: r })),
      ...cardNodesOf(rf).map(({ id, position, data: { card } }) => ({
        id,
        key: cardKey(card),
        rect: { x: position.x, y: position.y, w: cardWidth(card), h: cardHeight(card) },
        frameId: card.frameId,
        hidden: !!card.frameId && !!framesNowRef.current().find((f) => f.id === card.frameId)?.collapsed,
      })),
      // the notes shown, not a new one being written (slice 3a, item 13)
      ...noteBoxesRef.current.filter((b) => b.id !== DRAFT_NOTE).map((b) => ({ id: b.id, key: noteKey(b.id), rect: b.rect, frameId: b.frameId, pinnedTo: b.pinnedTo })),
      // requirement cards (slice 4b-2, L): in no frame
      ...reqNodesOf(rf).map(({ id, position, data: { card } }) => ({ id, key: reqKey(card.requirementId), rect: { x: position.x, y: position.y, w: REQ_CARD.width, h: requirementCardHeight(card.nameLines) } })),
    ],
    [rf, frameRectsNow],
  );
  const selectAll = useCallback(() => {
    const all = boxes();
    select(fromKeys(allKeys(all), all));
  }, [select, boxes]);
  const toggleCard = useCallback((cardId: string) => select(toggledSelection(selection, cardId, boxes())), [select, selection, boxes]);
  const onLasso = useCallback(
    (rect: Rect, add: boolean) => {
      const all = boxes();
      select(afterLasso(selection, lassoHits(all, rect), add, all));
    },
    [select, selection, boxes],
  );
  const lasso = useLasso(onLasso);

  // ---- keyboard: F fits, M toggles the Overview, E the Entity tool; Esc ends a tool, else clears the selection ----
  const { toggleEntityTool, toggleHandTool, toggleFrameTool } = modes;
  const deleteFrameRef = useRef<(id: string) => void>(() => {});
  const deleteNoteRef = useRef<(id: string) => void>(() => {});
  /** Delete on a requirement whose card is here takes the card off, never the requirement (slice 4b-2, item 7). */
  const removeReqRef = useRef<(requirementId: string) => boolean>(() => false);
  /** On a live canvas: Delete on a card asks to take its label off (slice 3b; set once the canvas has it). */
  const removeLiveRef = useRef<(cardId: string) => void>(() => {});
  /** N, the toolbar button: the Note tool on or off (editors and reviewers, slice 3a). */
  const toggleNoteTool = useCallback(() => {
    if (!canNote) return;
    if (ui.mode?.kind === "note") ui.setMode(null);
    else {
      ui.setMode({ kind: "note" });
      toast(NOTE_TOOL_HINT);
    }
  }, [canNote, ui, toast]);
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
      if ((e.key === "Delete" || e.key === "Backspace") && editable && selection?.t === "frame") {
        e.preventDefault();
        deleteFrameRef.current(selection.id);
        return;
      }
      // on a live canvas Delete on a card asks to take its label off (PRD item 11)
      if ((e.key === "Delete" || e.key === "Backspace") && editable && live && selection?.t === "card") {
        e.preventDefault();
        removeLiveRef.current(selection.id);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && editable && selection?.t === "req" && removeReqRef.current(selection.id)) {
        e.preventDefault();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && canNote && selection?.t === "note") {
        e.preventDefault();
        deleteNoteRef.current(selection.id);
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "f") fit();
      else if (k === "m") ui.toggleOverview();
      else if (k === "e") toggleEntityTool();
      else if (k === "h") toggleHandTool();
      else if (k === "a") toggleFrameTool();
      else if (k === "n") toggleNoteTool();
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
  }, [fit, ui, select, toggleEntityTool, toggleHandTool, toggleFrameTool, toggleNoteTool, selectAll, editable, canNote, selection, rf, live]);

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

  /** Cards removed here, at the version they had then (a late fresh page must not put them back; `mergeFresh`). */
  const removedHere = useRef(new Map<Uuid, number>());
  // ---- fresh cards from the server (after a place, remove or rename): take them, except the layout of what is still
  // saving, being dragged or newer here (a page started by an earlier write may arrive after a later move: `mergeFresh`) ----
  useEffect(() => {
    const pendingOf = (id: Uuid) => pending.current.get(id) ?? 0;
    // The server's cards arrive as props after each write.
    setNodes((ns) => {
      const local = new Map(ns.map((n) => [n.id, n]));
      const merged = mergeFresh(
        ns.map((n) => n.data.card),
        initialCards,
        {
          readAt,
          pendingOf: (id) => pendingOf(id) + (local.get(id)?.dragging ? 1 : 0),
          deletedHere: removedHere.current,
          versionOf: (c) => Math.max(c.version, versions.current.get(c.id) ?? 0),
          // the model's content from the page, the layout as the canvas has it
          keep: (here, page) => ({
            ...page,
            x: here.x,
            y: here.y,
            collapsed: here.collapsed,
            rowFilter: here.rowFilter,
            width: here.width,
            frameId: here.frameId,
            entityNames: here.entityNames,
            attributeNames: here.attributeNames,
          }),
        },
      );
      const page = new Set(initialCards);
      return merged.map((c) => {
        const mine = local.get(c.id);
        // the number of notes and the requirement marker stay as they were last given (slices 3a, 4b-1); the texts
        // follow the names the canvas shows now (slice 11)
        if (!mine || page.has(c)) return toNode(applyNames(c, namesRef.current), editable, mine?.data);
        if (c === mine.data.card) return mine;
        return { ...toNode(applyNames(c, namesRef.current), editable, mine.data), position: mine.position, dragging: mine.dragging };
      });
    });
    for (const [id, v] of grownVersions(initialCards, (id) => versions.current.get(id), pendingOf)) versions.current.set(id, v);
  }, [initialCards, editable, readAt]);

  // ---- requirement cards (slice 4b-2): nodes of their own beside the cards; they move with the selection and leave as
  // cards do, but join no frame (item 6). Fresh ones from the server are merged as the cards are. ----
  const [reqNodes, setReqNodes] = useState<ReqNodeT[]>(() => initialReqCards.map((c) => toReqNode(c, editable)));
  const reqNodesRef = useRef(reqNodes);
  useEffect(() => {
    reqNodesRef.current = reqNodes;
  }, [reqNodes]);
  useEffect(() => {
    const pendingOf = (id: Uuid) => pending.current.get(id) ?? 0;
    setReqNodes((ns) => {
      const local = new Map(ns.map((n) => [n.id, n]));
      const merged = mergeFresh(
        ns.map((n) => n.data.card),
        initialReqCards,
        {
          readAt,
          pendingOf: (id) => pendingOf(id) + (local.get(id)?.dragging ? 1 : 0),
          deletedHere: removedHere.current,
          versionOf: (c) => Math.max(c.version, versions.current.get(c.id) ?? 0),
          keep: (here, page) => ({ ...page, x: here.x, y: here.y }),
        },
      );
      return merged.map((c) => {
        const mine = local.get(c.id);
        if (mine && c === mine.data.card) return mine;
        const node = toReqNode(c, editable);
        return mine?.dragging ? { ...node, position: mine.position, dragging: true } : node;
      });
    });
    for (const [id, v] of grownVersions(initialReqCards, (id) => versions.current.get(id), pendingOf)) versions.current.set(id, v);
  }, [initialReqCards, editable, readAt]);
  /** Shows requirement cards at new places (data and node), not saved. */
  const showReqs = useCallback((places: ReadonlyMap<string, { x: number; y: number }>) => {
    setReqNodes((ns) =>
      ns.map((n) => {
        const p = places.get(n.id);
        return p ? { ...n, position: { x: p.x, y: p.y }, data: { card: { ...n.data.card, x: p.x, y: p.y } } } : n;
      }),
    );
  }, []);
  const reqMoverRef = useRef<ReqMover | null>(null);
  useEffect(() => {
    reqMoverRef.current = {
      has: (id) => reqNodesRef.current.some((n) => n.id === id),
      at: (id) => {
        const card = reqNodesRef.current.find((n) => n.id === id)?.data.card;
        return card ? { x: card.x, y: card.y } : null;
      },
      show: showReqs,
      drop: (ids) => {
        for (const id of ids) removedHere.current.set(id, versions.current.get(id) ?? 1);
        setReqNodes((ns) => ns.filter((n) => !ids.includes(n.id)));
      },
    };
  }, [showReqs]);
  /** The node of a requirement's card on this canvas, if it has one. */
  const reqNodeOf = useCallback((requirementId: string) => reqNodesRef.current.find((n) => n.data.card.requirementId === requirementId) ?? null, []);

  const patchCard = useCallback((id: string, patch: CardPatch) => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== id) return n;
        const merged = { ...n.data.card, ...patch };
        const card = applyNames(patch.width !== undefined ? withClips(merged) : merged, namesRef.current);
        return { ...n, position: { x: card.x, y: card.y }, width: cardWidth(card), height: cardHeight(card), data: { ...n.data, card } };
      }),
    );
  }, []);

  const change = useCallback(
    /** `send`: what the server is asked for when it is not the patch shown (a card's names, slice 11). */
    (id: string, patch: CardPatch, undo: CardPatch, send: CardChangeFields = patch as CardChangeFields) => {
      patchCard(id, patch);
      enqueue(id, async () => {
        let result: SaveCardResult;
        try {
          result = await saveCard({ canvasItemId: id, expectedVersion: versions.current.get(id) ?? 1, ...send });
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

  // ---- names or aliases (slice 11, D-64): the canvas's two modes, applied to every entity card in one commit ----
  /** Shows the canvas's names as given; `card` changes each card first (its exceptions cleared or put back). */
  const showNames = useCallback((next: CanvasNames, card: (c: CardData) => CardData = (c) => c) => {
    namesRef.current = next;
    setNamesState(next);
    setNodes((ns) =>
      ns.map((n) => {
        const c = applyNames(card(n.data.card), next);
        return c === n.data.card ? n : { ...n, data: { ...n.data, card: c } };
      }),
    );
  }, []);
  // a fresh page brings the saved names (an undo or another editor's change); a switch still on its way keeps its own.
  // Keyed on the canvas row's version too: the page of the switch itself may never arrive (a later page replaces it),
  // so the names a page brings may equal the last page's while the canvas shows others; an older page is ignored
  const namesVersion = useRef(pageNames.version);
  useEffect(() => {
    if (namesPending.current || pageNames.version < namesVersion.current) return;
    namesVersion.current = pageNames.version;
    const now = namesRef.current;
    if (now.entity_names === pageNames.entity_names && now.attribute_names === pageNames.attribute_names) return;
    showNames({ entity_names: pageNames.entity_names, attribute_names: pageNames.attribute_names });
  }, [pageNames.entity_names, pageNames.attribute_names, pageNames.version, showNames]);

  const noteCanvasVersion = useCanvasLook()?.noteVersion;
  /**
   * “Entity aliases” or “Attribute aliases” clicked (item 8): the canvas's mode at once and every card's exception in
   * that dimension cleared, saved as one change after every card write on its way (F2); a refusal puts both back.
   */
  const setNames = useCallback(
    (dimension: NameDimension, mode: NameMode): Promise<boolean> =>
      new Promise((resolve) => {
        if (!editable) {
          resolve(false);
          return;
        }
        const before = namesRef.current;
        const key = CARD_KEY[dimension];
        const cards = cardsNow();
        const exceptions = new Map(cards.filter((c) => c[key]).map((c) => [c.id, c[key]!]));
        const next: CanvasNames = { ...before, [NAMES_COLUMN[dimension]]: mode === "name" ? null : mode };
        if (canvasMode(before, dimension) === mode && !exceptions.size) {
          resolve(false);
          return;
        }
        namesPending.current += 1;
        showNames(next, (c) => (exceptions.has(c.id) ? withoutException(c, dimension) : c));
        const ids = cards.map((c) => c.id);
        enqueueGroup(ids, async () => {
          let result: Awaited<ReturnType<FrameWrites["setCanvasNames"]>>;
          try {
            result = await frameWrites.setCanvasNames({ dimension, mode, cards: ids.map((id) => ({ canvasItemId: id, expectedVersion: versions.current.get(id) ?? 1 })) });
          } catch {
            result = FAILED;
          }
          namesPending.current -= 1;
          if (!result.ok) {
            showNames(before, (c) => (exceptions.has(c.id) ? { ...c, [key]: exceptions.get(c.id) } : c));
            toast(result.message, "refusal");
            resolve(false);
            return;
          }
          for (const [id, v] of Object.entries(result.value.versions)) {
            if (id !== canvasId) versions.current.set(id, v);
            else {
              noteCanvasVersion?.(v);
              namesVersion.current = Math.max(namesVersion.current, v);
            }
          }
          ui.undo()?.noteSaved();
          resolve(true);
        });
      }),
    [editable, cardsNow, showNames, enqueueGroup, frameWrites, toast, canvasId, noteCanvasVersion, ui],
  );

  // ---- card width (D-37, C-09): saved like every change of positions and widths, frames decided again ----
  const saveLayoutRef = useRef<ReturnType<typeof useFrames>["saveLayout"]>(() => {});
  const setWidth = useCallback((id: string, patch: { width: number | null }) => saveLayoutRef.current({ cards: [{ id, width: patch.width }] }), []);
  const resize = useCardResize(editable, setWidth);
  const fitWidth = useCallback(
    (id: string) => {
      const card = (rf.getNode(id) as CardNodeT | undefined)?.data.card;
      if (!card) return;
      // the names as the card shows them (slice 11, F8)
      const width = fitWidthOf({ kind: card.kind, name: shownText(card), coverage: `${card.mapped}/${card.rows.length}`, rows: card.rows.map((r) => ({ ...r, name: shownText(r) })) });
      if (width !== card.width) setWidth(id, { width });
      toast("Fitted the card to its names.");
    },
    [rf, setWidth, toast],
  );

  // ---- placing and removing cards (left and right panel) ----
  /** The part of the board the user sees, in canvas coordinates. */
  const viewRect = useCallback((): Rect => {
    const { width: w, height: h, transform: [tx, ty, z] } = storeApi.getState();
    return { x: -tx / z, y: -ty / z, w: w / z, h: h / z };
  }, [storeApi]);

  /** What a new card must not cover: the cards drawn, the blocks of collapsed frames (slice 2c, item 9) and the notes. */
  const occupied = useCallback(
    (): Rect[] => [
      ...cardsNow().map((c) => {
        const n = rf.getNode(c.id)!;
        return { x: n.position.x, y: n.position.y, w: cardWidth(c), h: cardHeight(c) };
      }),
      ...frameRectsNow().filter(({ f }) => f.collapsed).map(({ r }) => r),
      ...noteBoxesRef.current.map((b) => b.rect),
      ...reqNodesOf(rf).map(({ position, data: { card } }) => ({ x: position.x, y: position.y, w: REQ_CARD.width, h: requirementCardHeight(card.nameLines) })),
    ],
    [rf, cardsNow, frameRectsNow],
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
      if (!n) return;
      // a card in a collapsed frame: its block (slice 2c, item 3)
      const block = frameRectsNow().find(({ f }) => f.collapsed && f.id === n.data.card.frameId);
      centerOnRect(block ? block.r : { x: n.position.x, y: n.position.y, w: cardWidth(n.data.card), h: cardHeight(n.data.card) });
    },
    [rf, centerOnRect, frameRectsNow],
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
  const focusedLabel = useRef(false);
  useEffect(() => {
    if (!ready || !focusLabelId || focusedLabel.current) return;
    focusedLabel.current = true;
    select({ t: "label", id: focusLabelId });
    window.history.replaceState(null, "", window.location.pathname);
  }, [ready, focusLabelId, select]);
  const focusedRequirement = useRef(false);
  useEffect(() => {
    if (!ready || !focusRequirementId || focusedRequirement.current) return;
    focusedRequirement.current = true;
    select({ t: "req", id: focusRequirementId });
    window.history.replaceState(null, "", window.location.pathname);
  }, [ready, focusRequirementId, select]);

  const focusedSelection = useRef(false);
  useEffect(() => {
    if (!ready || !focusSelection || focusedSelection.current) return;
    focusedSelection.current = true;
    select(focusSelection);
    const cardId =
      focusSelection.t === "row"
        ? focusSelection.cardId
        : focusSelection.t === "map"
          ? (() => {
              const model = fadeData?.model;
              const m = model?.mappings.find((x) => x.id === focusSelection.id);
              if (!model || !m) return undefined;
              const columns = new Set(model.mappingInputs.filter((i) => i.mapping_id === m.id && i.deleted_at === null).map((i) => i.source_column_id));
              const tables = new Set(model.sourceColumns.filter((c) => columns.has(c.id)).map((c) => c.source_table_id));
              const entity = model.attributes.find((a) => a.id === m.attribute_id)?.entity_id;
              const cards = cardNodesOf(rf).map((n) => n.data.card);
              return (cards.find((c) => c.kind === "src" && tables.has(c.targetId)) ?? cards.find((c) => c.kind === "ent" && c.targetId === entity))?.id;
            })()
          : undefined;
    if (cardId) centerOn(cardId);
    window.history.replaceState(null, "", window.location.pathname);
  }, [ready, focusSelection, fadeData, rf, select, centerOn]);

  const cardOf = useCallback(
    (t: CardTarget) =>
      cardNodesOf(rf).find(({ data: { card } }) =>
        isEntity(t) ? card.kind === "ent" && card.targetId === t.entityId : card.kind === "src" && card.targetId === t.sourceTableId,
      ),
    [rf],
  );

  /** Every frame at the version the canvas knows (a placed card may make one grow, slice 2b). */
  const frameRefs = useCallback(
    (): FrameRef[] => framesNowRef.current().map((f) => ({ frameId: f.id, expectedVersion: versions.current.get(f.id) ?? f.version })),
    [],
  );

  /** The drop's question (D-05), shown by the canvas further down; read when a drop needs it. */
  const askRef = useRef<(q: CanvasQuestion, kind?: "concept" | "live") => Promise<boolean>>(() => Promise.resolve(false));
  /** A live canvas's toasts about the sync are left out right after this person's own add or remove (it has its toast). */
  const quietUntil = useRef(0);
  // what this person's writes changed here comes with the fresh page (PRD item 7, Q7): shown once; a canvas opened
  // afterwards shows nothing (it starts from the notices it found)
  const seenNotice = useRef<number | null>(null);
  if (seenNotice.current === null) seenNotice.current = Math.max(0, ...(live?.notices ?? []).map((n) => n.id));
  const notices = live?.notices;
  const liveName = live?.labelName;
  useEffect(() => {
    if (!notices?.length) return;
    const fresh = notices.filter((n) => n.id > (seenNotice.current ?? 0));
    if (!fresh.length) return;
    seenNotice.current = Math.max(...fresh.map((n) => n.id));
    if (Date.now() < quietUntil.current) return;
    const added = fresh.flatMap((n) => n.added), removed = fresh.flatMap((n) => n.removed);
    const parts = [added.length ? `Added from ${liveName}: ${added.join(", ")}` : "", removed.length ? `No longer labeled: ${removed.join(", ")}` : ""].filter(Boolean);
    if (parts.length) toast(`${parts.join(". ")}.`);
  }, [notices, liveName, toast]);

  /**
   * Places an element at a spot; an element already here is selected and shown instead (prototype addToCanvas).
   * `dropped` (slice 2c): dragged from the left panel; landing with the middle of its header on a collapsed frame's
   * block files it into that frame, asking first about an entity of another concept (Łukasz's step 1 answer 2).
   */
  const placeAt = useCallback(
    async (target: CardTarget, spot: { x: number; y: number }, h: number, clicked: boolean, dropped?: { name: string }) => {
      const here = cardOf(target);
      if (here) {
        select({ t: "card", id: here.id });
        centerOn(here.id);
        return;
      }
      // on a live canvas, adding a card labels its element, after the question (D-11, PRD item 10); reviewers and
      // readers get no add there (PRD item 16)
      if (live && !editable) return;
      const liveName = live ? (dropped?.name ?? live.names[isEntity(target) ? target.entityId : target.sourceTableId] ?? "it") : "";
      if (live) {
        const yes = await askRef.current({ message: `Label ${liveName} with ${live.labelName}? It then appears on this live canvas.`, yes: `Add ${live.labelName}`, no: "Cancel" }, "live");
        if (!yes) return;
        quietUntil.current = Date.now() + 8000;
        if (!dropped) {
          let labeled: CanvasWriteResult<unknown>;
          try {
            labeled = await live.labelElement(target);
          } catch {
            labeled = FAILED;
          }
          if (!labeled.ok) toast(labeled.message, "refusal");
          else {
            const u = ui.undo();
            toast(`${liveName} is now labeled ${live.labelName}.`, "info", u ? { label: "Undo", run: u.undo } : undefined);
          }
          return;
        }
      }
      const counts = memberCounts(cardNodesOf(rf).map((n) => n.data.card));
      const block = dropped
        ? smallestFrameAt(
            framesNowRef.current().map((f) => ({ ...f, members: counts.get(f.id) ?? 0 })),
            { x: spot.x + CARD_W / 2, y: spot.y + HEAD_H / 2 },
          )
        : null;
      const filedInto = block?.collapsed ? block : null;
      let moveToConcepts = false;
      if (filedInto && isEntity(target)) {
        const own = entityConcepts[target.entityId] ?? null;
        const q = conceptQuestions([{ id: filedInto.id, kind: filedInto.kind, concept_id: filedInto.conceptId }], [
          { cardId: "new", entityId: target.entityId, conceptId: own, frameBefore: null, frameAfter: filedInto.id },
        ]);
        if (q.length) {
          moveToConcepts = await askRef.current(conceptAsk([{ name: dropped!.name, from: concepts[own ?? ""]?.name ?? "–", to: concepts[q[0]!.conceptId]?.name ?? "–" }]));
        }
      }
      let result: CanvasWriteResult<{ canvasItemId: string }>;
      try {
        const write = () => placeCard({ ...target, ...spot, height: h, frames: frameRefs(), ...(dropped ? { dragDrop: true } : {}), ...(moveToConcepts ? { moveToConcepts: true } : {}) });
        // moving the entity to the frame's concept writes its row: on its save chain, held (slice 10a, D-05)
        result = moveToConcepts && isEntity(target) ? (await rowSaves.saveRows([{ id: target.entityId }], write))! /* held only: never cut */ : await write();
      } catch {
        result = FAILED;
      }
      if (!result.ok) {
        toast(result.message, "refusal");
        return;
      }
      select({ t: "card", id: result.value.canvasItemId });
      if (live) {
        const u = ui.undo();
        toast(`${liveName} is now labeled ${live.labelName}.`, "info", u ? { label: "Undo", run: u.undo } : undefined);
        return;
      }
      if (filedInto) {
        toast(`${dropped!.name} added to the collapsed frame ${filedInto.name}.`);
        return;
      }
      const box = { ...spot, w: CARD_W, h };
      if (!inside(viewRect(), box)) centerOnRect(box);
      if (clicked) toast(`Added 1 ${isEntity(target) ? "entity" : "source table"} to the canvas.`);
    },
    [cardOf, select, centerOn, centerOnRect, placeCard, toast, viewRect, frameRefs, rf, entityConcepts, concepts, live, ui, editable],
  );

  const place = useCallback(
    (target: CardTarget, rows: number, options?: { quiet?: boolean }) => {
      const h = newCardHeight(rows);
      void placeAt(target, stackSpot(viewRect(), occupied(), h), h, !options?.quiet);
    },
    [placeAt, viewRect, occupied],
  );

  /** “Remove from this canvas (unlabel)…” on a live canvas: the question, then the label comes off (PRD item 11). */
  const removeLive = useCallback(
    async (cardId: string) => {
      const card = (rf.getNode(cardId) as CardNodeT | undefined)?.data.card;
      if (!live || !editable || !card?.liveRemove) return;
      const L = live.labelName;
      const { direct, what, others } = card.liveRemove;
      const verb = others === 1 ? "carries" : "carry";
      const question: CanvasQuestion = direct
        ? { message: `Take the label ${L} off ${card.name}?${others ? ` It stays here as context, because ${what} of it ${verb} ${L}.` : ""}`, yes: `Remove ${L}`, no: "Cancel" }
        : { message: `${card.name} is here because ${what} ${verb} ${L}. Take the label off ${others === 1 ? "it" : "them"}?`, yes: `Remove from ${what}`, no: "Cancel" };
      if (!(await askRef.current(question, "live"))) return;
      quietUntil.current = Date.now() + 8000;
      enqueue(cardId, async () => {
        let result: Awaited<ReturnType<LiveCanvas["removeCard"]>>;
        try {
          result = await live.removeCard({ canvasItemId: cardId, expectedVersion: versions.current.get(cardId) ?? 1 });
        } catch {
          result = FAILED;
        }
        if (!result.ok) {
          toast(result.message, "refusal");
          return;
        }
        const { name, label, mode } = result.value;
        const u = ui.undo();
        toast(mode === "direct" ? `${name} is no longer labeled ${label}.` : `Label ${label} removed from ${result.value.what} of ${name}.`, "info", u ? { label: "Undo", run: u.undo } : undefined);
      });
    },
    [live, editable, rf, enqueue, toast, ui],
  );

  const remove = useCallback(
    (cardId: string) => {
      if (live) return void removeLive(cardId);
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
        removedHere.current.set(cardId, versions.current.get(cardId) ?? 1);
        setNodes((ns) => ns.filter((n) => n.id !== cardId));
        select(null);
        const undo = ui.undo();
        toast("Removed from this canvas. It stays in the model, with its mappings and on other canvases.", "info", undo ? { label: "Undo", run: undo.undo } : undefined);
      });
    },
    [enqueue, removeCard, select, toast, ui, live, removeLive],
  );

  // ---- requirement cards: placing and removing (slice 4b-2, items 7 and 13) ----
  /** Places requirements' cards at these points in one change; the page brings the new cards. */
  const placeReqCards = useCallback(
    async (cards: { requirementId: string; x: number; y: number }[]): Promise<string[] | null> => {
      if (!placeRequirementCards || !cards.length) return null;
      let result: CanvasWriteResult<{ canvasItemIds: string[] }>;
      try {
        result = await placeRequirementCards(cards);
      } catch {
        result = FAILED;
      }
      if (!result.ok) {
        toast(result.message, "refusal");
        return null;
      }
      ui.undo()?.noteSaved();
      return result.value.canvasItemIds;
    },
    [placeRequirementCards, toast, ui],
  );
  /** “Place its card on this canvas” (item 13; prototype req-card): at the top centre of the view, on the grid. */
  const placeRequirementCard = useCallback(
    (requirementId: string) => {
      if (reqNodeOf(requirementId)) return;
      const v = viewRect();
      void placeReqCards([{ requirementId, x: snap8(v.x + v.w / 2 - REQ_CARD.width / 2), y: snap8(v.y + 60) }]);
    },
    [reqNodeOf, viewRect, placeReqCards],
  );
  /** Takes a requirement's card off this canvas; the requirement stays (item 7). */
  const removeRequirementCard = useCallback(
    (requirementId: string, options: { deselect?: boolean } = {}) => {
      const node = reqNodeOf(requirementId);
      if (!node || !editable) return;
      const cardId = node.id;
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
        reqMoverRef.current?.drop([cardId]);
        if (options.deselect) select(null);
        const undo = ui.undo();
        toast(`Removed ${node.data.card.key}'s card from this canvas. The requirement stays.`, "info", undo ? { label: "Undo", run: undo.undo } : undefined);
      });
    },
    [reqNodeOf, editable, enqueue, removeCard, toast, select, ui],
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
      // a live canvas adds one card at a time, each after its question (PRD item 12)
      if (live) {
        if (missing.length > 1) toast(LIVE_ONE_AT_A_TIME);
        else void placeAt(missing[0]!.target, { x: 0, y: 0 }, newCardHeight(missing[0]!.rows), true);
        return;
      }
      // a card hidden in a collapsed frame: beside its block (slice 2c), never on it (occupied)
      const block = frameRectsNow().find(({ f }) => f.collapsed && f.id === anchor.data.card.frameId)?.r ?? null;
      const a = besideAnchor({ x: anchor.position.x, y: anchor.position.y, w: cardWidth(anchor.data.card), h: cardHeight(anchor.data.card) }, block);
      const heights = missing.map((m) => newCardHeight(m.rows));
      const spots = besideSpots(a, side, heights, occupied());
      let result: CanvasWriteResult<{ canvasItemIds: string[] }>;
      try {
        result = await placeCards(missing.map((m, i) => ({ ...m.target, ...spots[i]!, height: heights[i]! })), frameRefs());
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
    [rf, cardOf, toast, occupied, placeCards, select, viewRect, frameRefs, frameRectsNow, live, placeAt],
  );

  // ---- frames (slice 2b) ----
  const selectCards = useCallback(
    (ids: readonly string[]) => {
      const all = boxes();
      select(fromKeys(all.filter((b) => ids.includes(b.id)).map((b) => b.key), all));
    },
    [boxes, select],
  );
  const endFrameTool = useCallback(() => ui.setMode(null), [ui]);
  const conceptColors = useMemo(() => Object.fromEntries(Object.entries(concepts).map(([id, c]) => [id, c.color])), [concepts]);
  const conceptName = useCallback((id: string) => concepts[id]?.name ?? "–", [concepts]);
  // the drop's question (D-05): one at a time, answered in the bar
  const [asking, setAsking] = useState<{ question: CanvasQuestion; kind: "concept" | "live"; answer: (move: boolean) => void } | null>(null);
  const ask = useCallback(
    (question: CanvasQuestion, kind: "concept" | "live" = "concept") =>
      new Promise<boolean>((resolve) =>
        setAsking({
          question,
          kind,
          answer: (move) => {
            setAsking(null);
            resolve(move);
          },
        }),
      ),
    [],
  );
  const onFrameCreated = useCallback((id: string) => ui.host()?.frameCreated(id), [ui]);
  /** The notes, for the frames and the selection that move them (slice 3a); set once the notes are there. */
  const noteMoverRef = useRef<NoteMover | null>(null);
  const frameState = useFrames({
    editable,
    showAllCollapsed: diagnosis.collapsed,
    initialFrames,
    readAt,
    setNodes,
    patchCard,
    enqueueGroup,
    versions,
    pending,
    select,
    undo: ui.undo,
    writes: frameWrites,
    spaceDown,
    frameTool: ui.mode?.kind === "frame",
    endFrameTool,
    onCreated: onFrameCreated,
    selectCards,
    conceptName,
    ask,
    groupOf: (frameId) => (selection?.t === "multi" && selection.keys.includes(frameKey(frameId)) ? unitsOf(selection.keys, boxes()) : null),
    notes: noteMoverRef,
    reqs: reqMoverRef,
  });
  const { frames, saveLayout, arrangeIntoFrames } = frameState;

  // ---- notes (slice 3a) ----
  /** The cards and frames as the canvas shows them now, for where notes go (a dragged card at its node's place). */
  const placesNow = useCallback(
    () => placesOf(cardNodesOf(rf).map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, width: n.data.card.width, frameId: n.data.card.frameId })), framesNowRef.current()),
    [rf],
  );
  const nameOf = useCallback(
    (kind: "card" | "frame", id: string) =>
      kind === "card" ? ((rf.getNode(id) as CardNodeT | undefined)?.data.card.name ?? "") : (framesNowRef.current().find((f) => f.id === id)?.name ?? ""),
    [rf],
  );
  const noteTargets = useCallback(
    () => [
      ...cardsNow().map((c) => ({ kind: "card" as const, id: c.id, label: c.name })),
      ...framesNowRef.current().map((f) => ({ kind: "frame" as const, id: f.id, label: `Frame: ${f.name}` })),
    ],
    [cardsNow],
  );
  const endNoteTool = useCallback(() => ui.setMode(null), [ui]);
  /** Shift+click on a note: in or out of the selection of several (slice 3a, item 13). */
  const toggleNote = useCallback((id: string) => select(toggleItem(selection, noteKey(id), boxes())), [select, selection, boxes]);
  /** A note of a selection of several pressed: the selection's drag (set once the group's actions are there). */
  const groupDragRef = useRef<(e: React.PointerEvent, onClick: () => void) => boolean>(() => false);
  const noteGroupDrag = useCallback(
    (e: React.PointerEvent, id: string) =>
      selection?.t === "multi" && selection.keys.includes(noteKey(id)) ? groupDragRef.current(e, () => select({ t: "note", id })) : false,
    [selection, select],
  );
  const noteState = useNotes({
    canNote,
    initialNotes,
    readAt,
    versions,
    pending,
    enqueue,
    enqueueGroup,
    select,
    undo: ui.undo,
    writes: noteWrites ?? NO_NOTE_WRITES,
    placesNow,
    nameOf,
    targets: noteTargets,
    noteTool: ui.mode?.kind === "note",
    endNoteTool,
    userName,
    toggleInSelection: toggleNote,
    groupDrag: noteGroupDrag,
  });
  useEffect(() => {
    askRef.current = ask;
    removeLiveRef.current = (id) => void removeLive(id);
    saveLayoutRef.current = saveLayout;
    deleteFrameRef.current = frameState.deleteFrame;
    deleteNoteRef.current = noteState.remove;
    removeReqRef.current = (requirementId) => {
      if (!reqNodeOf(requirementId)) return false;
      removeRequirementCard(requirementId, { deselect: true });
      return true;
    };
    framesNowRef.current = frameState.framesNow;
    noteMoverRef.current = { noteOf: noteState.noteOf, show: noteState.show };
  });
  const cardData = useMemo(() => nodes.map((n) => n.data.card), [nodes]);
  // what Focus is on for this selection (slice 4b-1, item 21); Focus itself is a store of its own (`FocusDriver`)
  const focusTarget = useMemo(() => focusTargetOf(selection, cardData), [selection, cardData]);
  const reqIdsKey = useMemo(() => reqNodes.map((n) => n.data.card.requirementId).join(","), [reqNodes]);
  // The panels that show frames draw again when frames, their cards or the cards' numbers change; not on a move.
  const layoutKey = useMemo(
    () =>
      JSON.stringify([
        frames.map((f) => [f.id, f.name, f.kind, f.conceptId, f.sourceSystemId, f.color, f.version, f.collapsed]),
        cardData.map((c) => [c.id, c.frameId, c.mapped, c.links.length, c.subject.entityConceptId ?? c.subject.sourceSystemId]),
        // which requirements have a card here (slice 4b-2): their panels offer to place or remove it
        reqIdsKey,
      ]),
    [frames, cardData, reqIdsKey],
  );
  const selectedFrameId = selection?.t === "frame" ? selection.id : null;

  // ---- collapsed frames (slice 2c, D-07): their cards hidden, a block standing for each ----
  const collapsedIds = useMemo(() => new Set(frames.filter((f) => f.collapsed).map((f) => f.id)), [frames]);
  // the numbers of notes (slice 3a, item 12), as strings first: a note that only moves changes none of them
  const savedNotes = useMemo(() => noteState.notes.filter((n) => n.id !== DRAFT_NOTE), [noteState.notes]);
  const cardNotesKey = useMemo(() => countsKey(cardNoteCounts(savedNotes, ui.hideResolved)), [savedNotes, ui.hideResolved]);
  const cardNotes = useMemo(() => countsOf(cardNotesKey), [cardNotesKey]);
  const frameNotesKey = useMemo(() => countsKey(frameNoteCounts(savedNotes, ui.hideResolved)), [savedNotes, ui.hideResolved]);
  const frameNotes = useMemo(() => countsOf(frameNotesKey), [frameNotesKey]);
  // what the view-state bar and the status bar count (slice 6a): published as numbers, so the canvas never re-renders
  // for them and they draw only when a number changes
  const filteredCards = useMemo(() => cardData.filter((c) => c.rowFilter !== "all" && c.rowFilter !== "labeled").length, [cardData]);
  const collapsedCards = useMemo(() => cardData.filter((c) => c.collapsed).length, [cardData]);
  const resolvedNotes = useMemo(() => savedNotes.filter((n) => n.status === "resolved").length, [savedNotes]);
  const openNotes = savedNotes.length - resolvedNotes;
  useEffect(() => {
    viewCounts.set({ filtered: filteredCards, collapsedCards, collapsedFrames: collapsedIds.size, resolvedNotes, openNotes });
  }, [filteredCards, collapsedCards, collapsedIds.size, resolvedNotes, openNotes]);
  useEffect(() => () => viewCounts.set(null), []);
  // the top bar's names check boxes (slice 11): the canvas's modes, or mixed while a card has an exception (from data)
  const namesItems = useMemo(
    () => cardData.map((c) => ({ canvas_id: canvasId, deleted_at: null, entity_names: c.entityNames ?? null, attribute_names: c.attributeNames ?? null })),
    [cardData, canvasId],
  );
  useEffect(() => {
    const canvas = { id: canvasId, ...names };
    namesState.set({ entity: namesControl(canvas, namesItems, "entity"), attribute: namesControl(canvas, namesItems, "attribute") });
  }, [names, namesItems, canvasId]);
  useEffect(() => () => namesState.set(null), []);
  // ready for a place to be selected (slice 6b, `SelectionHistory`)
  useEffect(() => {
    canvasReady.set(ready);
  }, [ready]);
  useEffect(() => () => canvasReady.set(false), []);
  const counts = useMemo(() => memberCounts(cardData), [cardData]);
  /** What stands for each frame on the canvas: the frame, or its block (selection marks, slice 2c). */
  const frameRects = useMemo(() => new Map(frames.map((f) => [f.id, frameShape(f, counts)])), [frames, counts]);
  const blockNodes = useMemo((): BlockNodeT[] => {
    // the same empty list each time: a new one would rebuild the nodes React Flow gets on every selection (S4P-06)
    if (!collapsedIds.size) return NO_BLOCK_NODES;
    const selectedKeys = selection?.t === "multi" ? new Set(selection.keys) : null;
    return frames
      .filter((f) => f.collapsed)
      .map((f) => {
        const members = cardData.filter((c) => c.frameId === f.id);
        const r = frameRects.get(f.id)!;
        return {
          id: blockNodeId(f.id),
          type: "block" as const,
          position: { x: f.x, y: f.y },
          width: r.w,
          height: r.h,
          // its size is known from its frame: React Flow need not measure it again and again (S2C-12)
          measured: { width: r.w, height: r.h },
          data: {
            frame: f,
            color: frameColor(f, (id) => conceptColors[id]),
            members: members.map((c) => ({ id: c.id, kind: c.kind, name: shownText(c), mapped: c.mapped, total: c.rows.length })),
            // the block's footer: mapped, used, type and drafts; not “misplaced”; its notes (prototype blockCard)
            chips: [
              ...frameChips(frameStats(f, members), f.kind).filter((c) => c.tone !== "misplaced"),
              ...(frameNotes.get(f.id) ? [{ text: `${frameNotes.get(f.id)} note${frameNotes.get(f.id)! > 1 ? "s" : ""}`, title: "Notes pinned to the frame or inside it that are shown" }] : []),
            ],
            selected: selectedFrameId === f.id || !!selectedKeys?.has(frameKey(f.id)),
          },
          draggable: false,
          selectable: false,
          connectable: false,
          style: { pointerEvents: "all" as const },
        };
      });
  }, [collapsedIds, frames, cardData, frameRects, conceptColors, selection, selectedFrameId, frameNotes]);
  // A card with pinned notes shown has their number in its data (slice 3a): changed only when a number changes, so no
  // other card draws again.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the numbers follow the notes, which live beside the cards
    setNodes((ns) => {
      let changed = false;
      const next = ns.map((n) => {
        const count = cardNotes.get(n.id) ?? 0;
        if ((n.data.pinnedNotes ?? 0) === count) return n;
        changed = true;
        const { pinnedNotes: _drop, ...rest } = n.data;
        void _drop;
        return { ...n, data: count ? { ...n.data, pinnedNotes: count } : rest };
      });
      return changed ? next : ns;
    });
  }, [cardNotes]);
  // The requirement markers (slice 4b-1, PRD item 14): from the canvas's requirement index, once per data version and
  // per set of cards; a card's data changes only when its marker does, so no other card draws again.
  const requirementIndex = useRequirementIndex(fadeData);
  const cardTargets = nodes.map((n) => `${n.id}|${n.data.card.kind}|${n.data.card.targetId}`).join(",");
  // ---- trace lines (slice 4b-2, items 8–11): which elements each requirement card's links reach on this canvas; once per
  // set of cards and data version, not per move (the line layer works out where they run) ----
  const reqCardsKey = reqNodes.map((n) => `${n.id}|${n.data.card.requirementId}`).join(",");
  const fadeModel = fadeData?.model;
  const allMappings = allLines.mappings;
  const traces = useMemo((): TraceData[] => {
    if (!requirementIndex || !reqCardsKey || !fadeModel) return NO_TRACES;
    const cardIdOf = new Map(cardTargets.split(",").filter(Boolean).map((t) => { const [id, kind, targetId] = t.split("|") as [string, string, string]; return [`${kind}:${targetId}`, id] as const; }));
    const entityOf = new Map(fadeModel.attributes.map((a) => [a.id, a.entity_id]));
    const tableOf = new Map(fadeModel.sourceColumns.map((c) => [c.id, c.source_table_id]));
    const mappingIds = new Set(allMappings.map((m) => m.id));
    const cards = reqCardsKey.split(",").map((t) => { const [id, requirementId] = t.split("|") as [string, string]; return { id, requirementId }; });
    return buildTraces(cards, requirementIndex.linksOf, {
      cardOf: (kind, targetId) => cardIdOf.get(`${kind}:${targetId}`),
      entityOf: (id) => entityOf.get(id),
      tableOf: (id) => tableOf.get(id),
      hasMapping: (id) => mappingIds.has(id),
    });
  }, [requirementIndex, reqCardsKey, cardTargets, fadeModel, allMappings]);

  // ---- requirement cards next to an element (slice 4b-2, items 14–16; prototype elemAnchor, placeReqCards) ----
  /** Where an element is for placing its requirements' cards beside it: its card (its block when in a collapsed frame),
   * its row (from 20 px above it), or a 20 × 40 box around its mapping's middle; null when it is not on the canvas. */
  const elementAnchor = useCallback(
    (target: TraceTarget): Rect | null => {
      const cardPlace = (kind: "ent" | "src", id: string): { rect: Rect; placed: Placed | null } | null => {
        const n = cardNodesOf(rf).find((c) => c.data.card.kind === kind && c.data.card.targetId === id);
        if (!n) return null;
        const block = n.data.card.frameId ? frameRectsNow().find(({ f }) => f.collapsed && f.id === n.data.card.frameId)?.r : undefined;
        if (block) return { rect: block, placed: null };
        return { rect: { x: n.position.x, y: n.position.y, w: cardWidth(n.data.card), h: cardHeight(n.data.card) }, placed: { x: n.position.x, y: n.position.y, card: n.data.card } };
      };
      if (target.kind === "entity" || target.kind === "source_table") return cardPlace(target.kind === "entity" ? "ent" : "src", target.id)?.rect ?? null;
      if (target.kind === "attribute" || target.kind === "source_column") {
        const owner = target.kind === "attribute" ? fadeModel?.attributes.find((a) => a.id === target.id)?.entity_id : fadeModel?.sourceColumns.find((c) => c.id === target.id)?.source_table_id;
        const c = owner ? cardPlace(target.kind === "attribute" ? "ent" : "src", owner) : null;
        if (!c) return null;
        if (!c.placed) return c.rect;
        return { x: c.rect.x, y: rowEnd(c.placed, target.id).y - 20, w: c.rect.w, h: 40 };
      }
      const l = allMappings.find((m) => m.id === target.id);
      const g = l ? mapGeom(l, storeApi.getState().nodeLookup) : null;
      return g ? { x: g.mid.x - 10, y: g.mid.y - 20, w: 20, h: 40 } : null;
    },
    [rf, frameRectsNow, fadeModel, allMappings, storeApi],
  );
  /** “Place card”, “Add all to this canvas” (item 15): beside the element, each in the first free place going down; the
   * view fits them when one falls outside it; one card placed is selected. Cards already here are skipped. */
  const placeRequirementCardsBeside = useCallback(
    async (requirementIds: readonly string[], target: TraceTarget) => {
      if (!editable || !requirementIndex) return;
      const missing = requirementIds.filter((id, i) => requirementIds.indexOf(id) === i && !reqNodeOf(id) && requirementIndex.byId.has(id));
      if (!missing.length) return;
      const anchor = elementAnchor(target);
      const heights = missing.map((id) => requirementCardHeightOf(requirementIndex.byId.get(id)!.name));
      // expanded frames are kept clear too (Łukasz after step 7): with their name strip, as fitting counts them
      const frames = frameRectsNow()
        .filter(({ f }) => !f.collapsed)
        .map(({ r }) => ({ x: r.x, y: r.y - 30, w: r.w, h: r.h + 30 }));
      const spots = requirementCardSpots(anchor, viewRect(), heights, occupied(), frames);
      const ids = await placeReqCards(missing.map((id, i) => ({ requirementId: id, ...spots[i]! })));
      if (!ids) return;
      if (ids.length === 1) select({ t: "req", id: missing[0]! });
      const placed = spots.map((s, i) => ({ ...s, w: REQ_CARD.width, h: heights[i]! }));
      if (placed.some((r) => !inside(viewRect(), r))) {
        const all = anchor ? [anchor, ...placed] : placed;
        const x0 = Math.min(...all.map((r) => r.x)), y0 = Math.min(...all.map((r) => r.y));
        const x1 = Math.max(...all.map((r) => r.x + r.w)), y1 = Math.max(...all.map((r) => r.y + r.h));
        void rf.fitBounds({ x: x0 - 40, y: y0 - 40, width: x1 - x0 + 80, height: y1 - y0 + 80 }, { duration: 250, padding: 0 });
      }
      const n = ids.length;
      toast(`Placed ${n} requirement card${n === 1 ? "" : "s"} on this canvas.`);
    },
    [editable, requirementIndex, reqNodeOf, elementAnchor, viewRect, occupied, frameRectsNow, placeReqCards, select, rf, toast],
  );
  /** A requirement's card already here (the row's “Place card”): selected and brought into view (prototype showReqCard). */
  const showRequirementCard = useCallback(
    (requirementId: string) => {
      const n = reqNodeOf(requirementId);
      if (!n) return;
      select({ t: "req", id: requirementId });
      void rf.fitBounds({ x: n.position.x - 200, y: n.position.y - 150, width: 630, height: 400 }, { duration: 250, padding: 0 });
    },
    [reqNodeOf, select, rf],
  );
  /** “Add to this canvas” on an entity or table panel without its card (item 16): the view's centre, upper third. */
  const addToCanvas = useCallback(
    (target: CardTarget, rows: number) => {
      const v = viewRect();
      void placeAt(target, { x: snap8(v.x + v.w / 2 - CARD_W / 2), y: snap8(v.y + v.h / 3) }, newCardHeight(rows), false);
    },
    [viewRect, placeAt],
  );
  const reqMarks = useMemo(
    () =>
      requirementMarks(
        requirementIndex,
        cardTargets ? cardTargets.split(",").map((t) => { const [id, kind, targetId] = t.split("|") as [string, "ent" | "src", string]; return { id, kind, targetId }; }) : [],
      ),
    [requirementIndex, cardTargets],
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the markers follow the requirements, which live beside the cards
    setNodes((ns) => {
      let changed = false;
      const next = ns.map((n) => {
        const mark = reqMarks.get(n.id);
        if (sameMark(n.data.reqMark, mark)) return n;
        changed = true;
        const { reqMark: _drop, ...rest } = n.data;
        void _drop;
        return { ...n, data: mark ? { ...rest, reqMark: mark } : rest };
      });
      return changed ? next : ns;
    });
  }, [reqMarks]);
  /** The nodes React Flow draws: the cards, those of a collapsed frame hidden, and the blocks. */
  const flowNodes = useMemo(() => {
    const cards = collapsedIds.size
      ? nodes.map((n) => (n.data.card.frameId && collapsedIds.has(n.data.card.frameId) ? { ...n, hidden: true } : n))
      : nodes;
    const withBlocks = blockNodes.length ? [...cards, ...blockNodes] : cards;
    // requirement cards last: above the cards, as in the prototype (step 2's LayerTree read: drawing them first changed
    // no layer count)
    return reqNodes.length ? [...withBlocks, ...reqNodes] : withBlocks;
  }, [nodes, blockNodes, collapsedIds, reqNodes]);
  // ---- bundled lines (slice 2c, items 6 and 7): the lines touching a collapsed frame, grouped per pair of ends ----
  /** Which collapsed frame each hidden card is in, as one string: the bundles change only when it does. */
  const hiddenIn = useMemo(
    () => (collapsedIds.size ? cardData.filter((c) => c.frameId && collapsedIds.has(c.frameId)).map((c) => `${c.id}:${c.frameId}`).join(",") : ""),
    [cardData, collapsedIds],
  );
  const bundled = useMemo(() => {
    if (!hiddenIn) return null;
    const frameOf = new Map(hiddenIn.split(",").map((s) => s.split(":") as [string, string]));
    return bundleLines(lines, (id) => frameOf.get(id) ?? null);
  }, [lines, hiddenIn]);
  const blocks = useMemo(() => new Map([...frameRects].filter(([id]) => collapsedIds.has(id))), [frameRects, collapsedIds]);
  const mapsById = useMemo(() => new Map(lines.mappings.map((m) => [m.id, m])), [lines]);
  /** A selected bundle emphasises its lines, as a selected line does (prototype relatedOf). */
  const selectedBundle = selection?.t === "bundle" ? (bundled?.bundles.find((b) => b.key === selection.id) ?? null) : null;
  const bundleRelated = useMemo(
    () => (selectedBundle ? { maps: new Set(selectedBundle.t === "map" ? selectedBundle.ids : []), rels: new Set(selectedBundle.t === "rel" ? selectedBundle.ids : []) } : null),
    [selectedBundle],
  );
  // a bundle that is gone (its frame expanded) is no longer selected
  useEffect(() => {
    if (selection?.t === "bundle" && !selectedBundle) select(null);
  }, [selection, selectedBundle, select]);
  // the bundle panel reads the bundles; it draws again when they change (with the frames, through the layout key)
  const bundlesRef = useRef<readonly Bundle[]>([]);
  const bundleKey = useMemo(() => (bundled ? bundled.bundles.map((b) => `${b.key}=${b.ids.join(",")}`).join(";") : ""), [bundled]);
  useEffect(() => {
    bundlesRef.current = bundled?.bundles ?? [];
  });
  // ---- notes as drawn now: where each shows (a pinned one follows its card or frame while it moves), and the tethers ----
  const { notes: noteList, heights: noteHeights, notesNow } = noteState;
  const shownPlaces = useMemo(
    () => placesOf(nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, width: n.data.card.width, frameId: n.data.card.frameId })), frames),
    [nodes, frames],
  );
  const shownNotes = useMemo((): ShownNote[] => {
    const cardName = new Map(nodes.map((n) => [n.id, n.data.card.name]));
    const frameName = new Map(frames.map((f) => [f.id, f.name]));
    return noteList
      .filter((n) => noteShown(n, shownPlaces, ui.hideResolved))
      .map((n) => ({
        note: n,
        ...noteAt(n, shownPlaces),
        pinName: n.pinCardId ? (cardName.get(n.pinCardId) ?? "?") : n.pinFrameId ? (frameName.get(n.pinFrameId) ?? "?") : null,
        height: noteHeights.get(n.id),
      }));
  }, [noteList, shownPlaces, nodes, frames, noteHeights, ui.hideResolved]);
  const tethers = useMemo(() => {
    const out: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const s of shownNotes) {
      const n = s.note;
      let target: Rect | null = null;
      if (n.pinCardId) {
        const node = nodes.find((x) => x.id === n.pinCardId);
        if (node) target = { x: node.position.x, y: node.position.y, w: cardWidth(node.data.card), h: cardHeight(node.data.card) };
      } else if (n.pinFrameId) target = frameRects.get(n.pinFrameId) ?? null;
      if (!target) continue;
      const t = tether({ x: s.x, y: s.y, w: n.width, h: s.height ?? 80 }, target);
      if (t) out.push({ id: n.id, ...t });
    }
    return out;
  }, [shownNotes, nodes, frameRects]);
  useEffect(() => {
    noteBoxesRef.current = shownNotes.map((s) => ({
      id: s.note.id,
      rect: { x: s.x, y: s.y, w: s.note.width, h: s.height ?? 80 },
      frameId: s.note.pinCardId || s.note.pinFrameId ? null : s.note.frameId,
      pinnedTo: s.note.pinCardId ?? s.note.pinFrameId,
    }));
  }, [shownNotes]);
  /** The notes as fading sees them (slice 4p): where they are drawn and the card they are pinned to. */
  const fadeNotes = useMemo<FadeNote[]>(
    () => shownNotes.map((s) => ({ id: s.note.id, rect: { x: s.x, y: s.y, w: s.note.width, h: s.height ?? 80 }, pinCardId: s.note.pinCardId })),
    [shownNotes],
  );
  /** The notes as the Overview's miniature draws them (slice 3b). */
  const miniNotes = useMemo<MiniNote[]>(
    () => shownNotes.map((s) => ({ id: s.note.id, x: s.x, y: s.y, w: s.note.width, h: s.height ?? 80, color: s.note.color })),
    [shownNotes],
  );
  /** The notes as the selection marks them. */
  const noteRects = useMemo(() => new Map(shownNotes.map((s) => [s.note.id, { x: s.x, y: s.y, w: s.note.width, h: s.height ?? 80 }])), [shownNotes]);

  useEffect(() => {
    if (ready || !sized) return;
    const { width, height } = storeApi.getState();
    const saved = readView(canvasId);
    // the one view set on open: a view saved beside another left panel moves by the difference in the same call, so
    // there is no second commit and no visible jump (slice 6a, item 13)
    const left = Math.round(rootRef.current?.getBoundingClientRect().left ?? 0);
    const view = saved ? { x: saved.x + (saved.left === undefined ? 0 : saved.left - left), y: saved.y, zoom: saved.zoom } : fitView(width, height);
    void rf.setViewport(view);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the view can only be set once the pane has a size
    setReady(true);
  }, [ready, sized, storeApi, canvasId, rf, fitView]);

  // Cards, frames and notes that left the canvas (removed, deleted, undone, hidden) leave the selection too, and so do
  // the cards of a frame that was collapsed (slice 2c, prototype pruneMulti); checked when the set of cards, frames or
  // notes shown or the collapsed frames change, not on every frame of a drag.
  const itemIds = useMemo(
    () => [...frames.map((f) => `${f.id}${f.collapsed ? "c" : ""}`), ...nodes.map((n) => n.id), ...shownNotes.map((s) => s.note.id)].join(","),
    [frames, nodes, shownNotes],
  );
  useEffect(() => {
    if (selection?.t !== "multi") return;
    const next = fromKeys(selection.keys, boxes().filter((b) => !b.hidden));
    if (next?.t !== "multi" || next.keys.length !== selection.keys.length) select(next);
  }, [itemIds, selection, select, boxes]);

  // A note asked for on arrival (the project home): selected and in view, at 100 % (prototype data-hnote).
  const focusedNote = useRef(false);
  useEffect(() => {
    if (!ready || !focusNoteId || focusedNote.current) return;
    focusedNote.current = true;
    if (noteList.some((n) => n.id === focusNoteId)) {
      select({ t: "note", id: focusNoteId });
      const r = noteBoxesRef.current.find((b) => b.id === focusNoteId)?.rect;
      const { width: w, height: h } = storeApi.getState();
      if (r) void rf.setViewport({ x: w / 2 - (r.x + r.w / 2), y: h / 2 - (r.y + r.h / 2), zoom: 1 });
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, [ready, focusNoteId, noteList, select, rf, storeApi]);
  // the note panel reads the notes through the canvas: it draws again when a note changes, not when one moves
  const notesKey = useMemo(
    () => noteList.map((n) => `${n.id}:${n.version}:${n.status}:${n.color}:${n.pinCardId ?? ""}:${n.pinFrameId ?? ""}:${n.frameId ?? ""}:${n.text.length}:${n.text.slice(0, 40)}`).join(","),
    [noteList],
  );

  const { publishLayout } = ui;
  useEffect(() => publishLayout(`${layoutKey}|${bundleKey}|${notesKey}`), [publishLayout, layoutKey, bundleKey, notesKey]);

  /** A card row of a block: expand the frame, then select the card and bring it into view. */
  const openMember = useCallback(
    (frameId: string, cardId: string) => {
      frameState.setCollapsed(frameId, false);
      select({ t: "card", id: cardId });
      setTimeout(() => centerOn(cardId), 0);
    },
    [frameState, select, centerOn],
  );
  const onFramePointerDown = useCallback(
    (e: React.PointerEvent, frameId: string, part: FramePart) => {
      const toggle = () => select(toggleItem(selection, frameKey(frameId), boxes()));
      // Shift + drag inside a frame draws a lasso that adds to the selection (D-15); a Shift+click there without moving
      // adds the frame or takes it out, as a plain click there selects it (answer 2 of step 4, unlike the prototype)
      if (part === "body" && e.shiftKey && e.button === 0 && !spaceDown.current && !ui.mode) {
        lasso.onPointerDown(e, true, toggle);
        return;
      }
      if (ui.mode) return;
      // Shift+click on a frame's name adds it to the selection or takes it out (D-16, prototype pick)
      if (part === "label" && e.shiftKey && e.button === 0 && !spaceDown.current) {
        e.preventDefault();
        toggle();
        return;
      }
      frameState.onFramePointerDown(e, frameId, part);
    },
    [lasso, ui.mode, frameState, select, selection, boxes],
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
    removedHere,
    occupied,
    viewRect,
    undo: ui.undo,
    saveLayout,
    removeCards,
    placeCards: (cards) => placeCards(cards, frameRefs()),
    items: boxes,
    framesNow: frameState.framesNow,
    patchFrames: frameState.patchFrames,
    frameRect: (f) => frameShape(f, memberCounts(cardNodesOf(rf).map((n) => n.data.card))),
    canNote,
    notes: noteMoverRef,
    saveNoteMoves: noteState.saveMoves,
    reqs: reqMoverRef,
  });
  useEffect(() => {
    groupDragRef.current = group.startDrag;
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

  /**
   * Back or Forward onto a selection place (slice 6b, D-38): the place is selected as a click selects it (the details
   * panel never opens, D-54) and, when it has a place on the canvas that is off screen, centred at the same zoom (cards,
   * rows by their card, frames, notes, requirement cards; a card in a collapsed frame by its block). Returns what is gone
   * when the place no longer exists; then nothing is selected.
   */
  const showPlace = useCallback(
    (sel: Selection): PlaceGone | null => {
      if (!sel || sel.t === "multi" || sel.t === "bundle") return null;
      const model = fadeData?.model;
      const cardRect = (n: CardNodeT): Rect =>
        frameRectsNow().find(({ f }) => f.collapsed && f.id === n.data.card.frameId)?.r ?? { x: n.position.x, y: n.position.y, w: cardWidth(n.data.card), h: cardHeight(n.data.card) };
      let rect: Rect | null = null;
      let gone: PlaceGone | null = null;
      switch (sel.t) {
        case "card":
        case "row": {
          const n = cardNodesOf(rf).find((c) => c.id === (sel.t === "card" ? sel.id : sel.cardId));
          if (!n || (sel.t === "row" && !n.data.card.rows.some((r) => r.id === sel.id))) gone = sel.t;
          else rect = cardRect(n);
          break;
        }
        case "map":
          if (model && !model.mappings.some((m) => m.id === sel.id)) gone = "map";
          break;
        case "rel":
          if (model && !model.relationships.some((r) => r.id === sel.id)) gone = "rel";
          break;
        case "frame": {
          const f = frameRectsNow().find(({ f }) => f.id === sel.id);
          if (!f) gone = "frame";
          else rect = f.r;
          break;
        }
        case "note":
          if (!notesNow().some((n) => n.id === sel.id)) gone = "note";
          else rect = noteBoxesRef.current.find((b) => b.id === sel.id)?.rect ?? null;
          break;
        case "req": {
          if (fadeData && !fadeData.requirements.some((r) => r.id === sel.id && r.deleted_at === null)) gone = "req";
          const n = reqNodeOf(sel.id);
          if (n) rect = { x: n.position.x, y: n.position.y, w: REQ_CARD.width, h: requirementCardHeight(n.data.card.nameLines) };
          break;
        }
        case "element":
          // a source system (slice 7a) has no place on the canvas: its panel only, never centred
          if (sel.kind === "source_system") {
            if (model && !model.sourceSystems.some((s) => s.id === sel.id)) gone = "source_system";
          } else if (model && ![...model.entities, ...model.attributes, ...model.sourceTables, ...model.sourceColumns].some((e) => e.id === sel.id)) gone = "element";
          break;
      }
      if (gone) {
        select(null);
        return gone;
      }
      select(sel);
      const v = viewRect();
      if (rect && (rect.x + rect.w < v.x || rect.x > v.x + v.w || rect.y + rect.h < v.y || rect.y > v.y + v.h)) centerOnRect(rect);
      return null;
    },
    [fadeData, rf, frameRectsNow, notesNow, reqNodeOf, select, viewRect, centerOnRect],
  );

  useEffect(() => {
    registerCanvas({
      fit,
      shiftView,
      place,
      remove,
      centerOn,
      showPlace,
      freeSpot: () => freeSpot(viewRect(), occupied()),
      fitWidth,
      placeBeside: (cards, anchorCardId, side) => void placeBeside(cards, anchorCardId, side),
      settled,
      cardView: (id) => {
        const card = (rf.getNode(id) as CardNodeT | undefined)?.data.card;
        if (!card) return null;
        const item = { entity_names: card.entityNames ?? null, attribute_names: card.attributeNames ?? null };
        return { collapsed: card.collapsed, rowFilter: card.rowFilter, entityNames: cardMode(item, namesRef.current, "entity"), attributeNames: cardMode(item, namesRef.current, "attribute") };
      },
      selectAll,
      arrangeSelection: group.arrangeSelection,
      fitSelectionWidths: group.fitSelectionWidths,
      // a live canvas: one card at a time (PRD item 12)
      removeSelection: live ? () => toast("On a live canvas, remove cards one at a time: each one takes its label off.") : group.removeSelection,
      placeSourcesOfSelection: live ? () => toast(LIVE_ONE_AT_A_TIME) : group.placeSourcesOfSelection,
      createFrameAt: frameState.createFrameAt,
      frameView: frameState.frameView,
      updateFrame: frameState.updateFrame,
      deleteFrame: frameState.deleteFrame,
      fitFrame: frameState.fitFrame,
      zoomToFrame: frameState.zoomToFrame,
      selectFrameCards: frameState.selectFrameCards,
      setFrameCollapsed: frameState.setCollapsed,
      setAllFramesCollapsed: frameState.setAllCollapsed,
      resetView: frameState.resetView,
      setNames,
      bundleView: (key) => bundlesRef.current.find((b) => b.key === key) ?? null,
      noteView: noteState.noteView,
      newNote: noteState.newNote,
      editNote: noteState.edit,
      updateNote: noteState.update,
      pinNote: noteState.pin,
      unpinNote: noteState.unpin,
      deleteNote: noteState.remove,
      notesView: (): NoteListItem[] =>
        notesNow()
          .filter((n) => n.id !== DRAFT_NOTE)
          .map((n) => ({
            id: n.id,
            text: n.text,
            status: n.status,
            pinCardId: n.pinCardId,
            pinFrameId: n.pinFrameId,
            pinName: n.pinCardId ? nameOf("card", n.pinCardId) : n.pinFrameId ? nameOf("frame", n.pinFrameId) : null,
          })),
      requirementCard: (requirementId) => {
        const n = reqNodeOf(requirementId);
        return n ? { cardId: n.id, key: n.data.card.key, name: n.data.card.name } : null;
      },
      placeRequirementCard,
      removeRequirementCard,
      placeRequirementCardsBeside: (ids, target) => void placeRequirementCardsBeside(ids, target),
      showRequirementCard,
      addToCanvas,
      showNote: (id) => {
        select({ t: "note", id });
        const r = noteBoxesRef.current.find((b) => b.id === id)?.rect;
        if (r && !inside(viewRect(), r)) centerOnRect(r);
      },
      framesView: frameState.framesView,
      cardFrame: frameState.cardFrame,
      frameAt: frameState.frameAt,
      frameRefs: frameState.frameRefs,
      putInNewFrame: frameState.putInNewFrame,
      arrangeIntoFrames: () => arrangeIntoFrames(fit),
      placeAt: (target, rows, at) => void placeAt(target, { x: snap8(at.x - CARD_W / 2), y: snap8(at.y - 20) }, newCardHeight(rows), false),
      setCardView: (id, view) => {
        const card = (rf.getNode(id) as CardNodeT | undefined)?.data.card;
        if (!card) return;
        const undo: CardPatch = {};
        if (view.collapsed !== undefined) undo.collapsed = card.collapsed;
        if (view.rowFilter !== undefined) undo.rowFilter = card.rowFilter;
        // a card's names (slice 11): shown as an exception unless the choice equals the canvas's mode; the server is
        // sent the choice and decides the same
        const { entityNames, attributeNames, ...rest } = view;
        const patch: CardPatch = { ...rest };
        for (const [dimension, choice] of [["entity", entityNames], ["attribute", attributeNames]] as const) {
          if (choice === undefined) continue;
          const key = CARD_KEY[dimension];
          patch[key] = choice === canvasMode(namesRef.current, dimension) ? undefined : choice;
          undo[key] = card[key];
        }
        change(id, patch, undo, view);
      },
    });
    return () => registerCanvas(null);
  }, [registerCanvas, fit, shiftView, showPlace, place, remove, placeRequirementCard, removeRequirementCard, reqNodeOf, placeRequirementCardsBeside, showRequirementCard, addToCanvas, centerOn, viewRect, occupied, placeAt, change, rf, fitWidth, placeBeside, settled, selectAll, group.arrangeSelection, group.fitSelectionWidths, group.removeSelection, group.placeSourcesOfSelection, frameState.createFrameAt, frameState.frameView, frameState.updateFrame, frameState.deleteFrame, frameState.fitFrame, frameState.zoomToFrame, frameState.selectFrameCards, frameState.setCollapsed, frameState.setAllCollapsed, frameState.resetView, setNames, frameState.framesView, frameState.cardFrame, frameState.frameAt, frameState.frameRefs, frameState.putInNewFrame, arrangeIntoFrames, noteState.noteView, noteState.newNote, noteState.edit, noteState.update, noteState.pin, noteState.unpin, noteState.remove, notesNow, nameOf, select, centerOnRect, live, toast]);

  // ---- an item dropped from the left panel: the top middle of its card goes where the mouse is ----
  // ---- a requirement dragged from the left panel (slice 4b-2, items 17–19): the target under the pointer in a store
  // (the overlay's mark and the hint read it), written only when it changes, so the drag re-renders neither the canvas
  // nor the miniature (S4B2-15) ----
  const [dropStore] = useState(() => createValueStore<DropTarget | null>(null, sameDropTarget));
  const hintRef = useRef<HTMLDivElement | null>(null);
  const dropTargetFor = useCallback(
    (e: DragEvent, requirementId: string): DropTarget =>
      dropTargetAt(document.elementFromPoint(e.clientX, e.clientY), {
        card: (cardId) => {
          const c = (rf.getNode(cardId) as CardNodeT | undefined)?.data.card;
          // the hint names what the card shows (slice 11, F8)
          if (!c) return null;
          return {
            kind: c.kind,
            targetId: c.targetId,
            name: shownText(c),
            rowName: (rowId) => {
              const r = c.rows.find((x) => x.id === rowId);
              return r && shownText(r);
            },
          };
        },
        mappingName: (mappingId) => {
          const l = allMappings.find((m) => m.id === mappingId);
          if (!l) return null;
          const cardOfId = (id: string) => (rf.getNode(id) as CardNodeT | undefined)?.data.card;
          const inputs = l.inputs.map((i) => { const c = cardOfId(i.cardId); return `${c?.name ?? "?"}.${c?.rows.find((r) => r.id === i.columnId)?.name ?? "?"}`; });
          const a = cardOfId(l.cardId);
          return `${inputs.join(", ")} → ${a?.name ?? "?"}.${a?.rows.find((r) => r.id === l.attributeId)?.name ?? "?"}`;
        },
        links: requirementIndex?.linksOf(requirementId) ?? [],
        hasCard: !!reqNodeOf(requirementId),
      }),
    [rf, allMappings, requirementIndex, reqNodeOf],
  );
  const endRequirementDrag = useCallback(() => dropStore.set(null), [dropStore]);
  useEffect(() => {
    window.addEventListener("dragend", endRequirementDrag);
    window.addEventListener("drop", endRequirementDrag);
    return () => {
      window.removeEventListener("dragend", endRequirementDrag);
      window.removeEventListener("drop", endRequirementDrag);
    };
  }, [endRequirementDrag]);

  const onDragOver = useCallback((e: DragEvent) => {
    const dragged = editable && e.dataTransfer.types.includes(REQ_DRAG_TYPE) ? requirementDrag.current : null;
    if (dragged) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      dropStore.set(dropTargetFor(e, dragged.requirementId));
      moveDropHint(hintRef.current, e.clientX, e.clientY);
      return;
    }
    if (!e.dataTransfer.types.includes(CARD_DRAG_TYPE) && !(editable && e.dataTransfer.types.includes(REQ_CARD_DRAG_TYPE))) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, [editable, dropStore, dropTargetFor]);
  /** The pointer left the canvas while dragging: no target, no hint. */
  const onDragLeave = useCallback(
    (e: DragEvent) => {
      if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) dropStore.set(null);
    },
    [dropStore],
  );
  /** A requirement dropped from the left panel: a link (with Undo), “already linked” (nothing written), or its card. */
  const dropRequirement = useCallback(
    async (e: DragEvent, r: { requirementId: string; key: string }) => {
      const target = dropTargetFor(e, r.requirementId);
      dropStore.set(null);
      if (target.t === "place") {
        const at = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const spot = { x: snap8(at.x - REQ_CARD.width / 2), y: snap8(at.y - 30) };
        const here = reqNodeOf(r.requirementId);
        select({ t: "req", id: r.requirementId });
        if (here) {
          saveLayout({ cards: [{ id: here.id, ...spot }] });
          toast(DROP_TOAST.moved(r.key));
        } else if (await placeReqCards([{ requirementId: r.requirementId, ...spot }])) toast(DROP_TOAST.placed(r.key));
        return;
      }
      if (target.linked) {
        toast(DROP_TOAST.already(r.key, target.name));
        return;
      }
      if (!linkRequirement) return;
      let result: CanvasWriteResult<unknown>;
      try {
        result = await linkRequirement({ requirementId: r.requirementId, target: target.target });
      } catch {
        result = FAILED;
      }
      if (!result.ok) {
        toast(result.message, "refusal");
        return;
      }
      const u = ui.undo();
      u?.noteSaved();
      toast(DROP_TOAST.linked(r.key, target.name), "info", u ? { label: "Undo", run: u.undo } : undefined);
    },
    [dropTargetFor, dropStore, rf, reqNodeOf, select, saveLayout, toast, placeReqCards, linkRequirement, ui],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      // a requirement from the left panel (items 17–19): a link or its card, by what lies under the pointer
      const fromTree = editable ? e.dataTransfer.getData(REQ_DRAG_TYPE) : "";
      if (fromTree) {
        e.preventDefault();
        try {
          void dropRequirement(e, JSON.parse(fromTree) as { requirementId: string; key: string });
        } catch {
          dropStore.set(null);
        }
        return;
      }
      // a requirement row from an element panel (item 14): its card where it is dropped, never a link; a card already
      // here moves there (M)
      const req = editable ? e.dataTransfer.getData(REQ_CARD_DRAG_TYPE) : "";
      if (req) {
        e.preventDefault();
        let r: { requirementId: string; key: string };
        try {
          r = JSON.parse(req) as { requirementId: string; key: string };
        } catch {
          return;
        }
        const at = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const spot = { x: snap8(at.x - REQ_CARD.width / 2), y: snap8(at.y - 30) };
        const here = reqNodeOf(r.requirementId);
        select({ t: "req", id: r.requirementId });
        if (here) {
          saveLayout({ cards: [{ id: here.id, ...spot }] });
          toast(`Moved ${r.key}'s card.`);
        } else {
          void placeReqCards([{ requirementId: r.requirementId, ...spot }]).then((ids) => ids && toast(`Placed ${r.key} on this canvas.`));
        }
        return;
      }
      const raw = e.dataTransfer.getData(CARD_DRAG_TYPE);
      if (!raw) return;
      e.preventDefault();
      let data: { target: CardTarget; rows: number; name?: string };
      try {
        data = JSON.parse(raw) as { target: CardTarget; rows: number; name?: string };
      } catch {
        return;
      }
      const at = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      void placeAt(data.target, { x: snap8(at.x - CARD_W / 2), y: snap8(at.y - 20) }, newCardHeight(data.rows), false, { name: data.name ?? "The card" });
    },
    [rf, placeAt, editable, reqNodeOf, select, saveLayout, toast, placeReqCards, dropRequirement, dropStore],
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
        // a live canvas's entity cards also offer Labeled (slice 3b)
        const order = filtersOf(card);
        const next = order[(order.indexOf(card.rowFilter) + 1) % order.length]!;
        change(id, { rowFilter: next }, { rowFilter: card.rowFilter });
      },
      startRelate: modes.startRelate,
      fitWidth,
      toggleCard,
      framePress: (e, frameId) => onFramePointerDown(e, frameId, "label"),
      setFrameCollapsed: frameState.setCollapsed,
      openMember,
    }),
    [editable, selection, select, change, rf, modes.startRelate, fitWidth, toggleCard, onFramePointerDown, frameState.setCollapsed, openMember],
  );

  // A selected card dragged in a group moves the others too, in the same update (slice 2a).
  const { withGroup, onNodeDragStart: groupDragStart, onGroupDragStop } = group;
  const onNodesChange = useCallback(
    (changes: NodeChange<CardNodeT>[]) => {
      // a block's changes (its measured size) are not the cards'; it is drawn from its frame (slice 2c). With none
      // left, the cards stay as they are: applyNodeChanges returns a new array even for no change, and a new array on
      // every round of React Flow's measuring re-rendered the whole canvas on every frame (S2C-12 diagnosis)
      const all = withGroup(changes.filter((c) => !("id" in c) || !c.id.startsWith("block:")));
      if (!all.length) return;
      // a requirement card's changes are its own nodes' (slice 4b-2)
      const isReq = (c: NodeChange<CardNodeT>) => "id" in c && reqNodesRef.current.some((n) => n.id === c.id);
      const reqChanges = all.filter(isReq);
      const cardChanges = reqChanges.length ? all.filter((c) => !isReq(c)) : all;
      if (cardChanges.length) setNodes((ns) => applyNodeChanges(cardChanges, ns));
      if (reqChanges.length) setReqNodes((ns) => applyNodeChanges(reqChanges as unknown as NodeChange<ReqNodeT>[], ns));
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
      // a requirement card: its position only, in no frame (slice 4b-2, item 6)
      if ((node as unknown as ReqNodeT).type === "req") {
        const at = (node as unknown as ReqNodeT).data.card;
        const x = Math.round(node.position.x), y = Math.round(node.position.y);
        if (x !== at.x || y !== at.y) saveLayout({ cards: [{ id: node.id, x, y }] });
        return;
      }
      const card = node.data.card;
      const x = Math.round(node.position.x), y = Math.round(node.position.y);
      if (x === card.x && y === card.y) return;
      saveLayout({ cards: [{ id: node.id, x, y }] }, { ask: true });
    },
    [saveLayout, onGroupDragStop],
  );

  const toggleNoteStatus = useCallback(
    (id: string) => {
      const n = noteState.noteView(id)?.note;
      if (n) noteState.update(id, { status: n.status === "resolved" ? "open" : "resolved" });
    },
    [noteState],
  );

  // ---- hover (C-10): a row of a card or a mapping line; nothing while dragging, drawing a lasso or with a tool on ----
  const busy = !!draft || !!ui.mode || resize.resizing || frameState.busy || noteState.dragging;
  const onHoverOver = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons) return;
      const el = e.target as Element;
      const row = el.closest<HTMLElement>(".row[data-row]");
      const cardId = row?.closest<HTMLElement>("[data-card]")?.dataset.card;
      const mappingId = el.closest<SVGElement>("[data-mapping]")?.dataset.mapping;
      hoverStore.set(row && cardId ? { t: "row", cardId, id: row.dataset.row! } : mappingId ? { t: "map", id: mappingId } : null);
    },
    [hoverStore],
  );

  return (
    <DiagnosisCtx.Provider value={diagnosis}>
    <CanvasCardsCtx.Provider value={cardsApi}>
      <div
        ref={rootRef}
        className={`im-canvas${ui.mode?.kind === "entity" ? " tool-entity" : ""}${ui.mode?.kind === "relate" ? " relating" : ""}${ui.mode?.kind === "hand" ? " tool-hand" : ""}${ui.mode?.kind === "frame" ? " tool-frame" : ""}${ui.mode?.kind === "note" ? " tool-note" : ""}${modes.panning ? " panning" : ""}${resize.resizing ? " resizing" : ""}${dragging || frameState.busy ? " node-dragging" : ""}`}
        data-testid="area-canvas"
        data-grid={grid}
        data-layer={layer}
        data-mode={ui.mode?.kind}
        data-ready={ready || undefined}
        data-notation={ui.notation}
        style={{ visibility: ready ? "visible" : "hidden" }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onPointerDown={(e) => {
          if (!ui.mode && !spaceDown.current) lasso.onPointerDown(e);
          onPointerDown(e);
        }}
        onPointerDownCapture={(e) => {
          if (noteState.onNoteToolPointerDown(e)) return;
          if (frameState.onFrameToolPointerDown(e)) return;
          if (!resize.onPointerDown(e)) modes.onPointerDownCapture(e);
        }}
        onPointerOver={onHoverOver}
        onPointerLeave={() => hoverStore.set(null)}
        onContextMenu={modes.onContextMenu}
      >
        {grid !== "none" && <div className="im-grid" ref={gridRef} aria-hidden data-testid="canvas-grid" />}
        <ReactFlow
          // the blocks are nodes of their own kind (slice 2c); every handler here acts on cards and skips them
          nodes={flowNodes as CardNodeT[]}
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
          <FrameLayer
            frames={diagnosis.noFrames ? NO_FRAMES : frames}
            labels={!diagnosis.noLabels}
            cards={cardData}
            conceptColors={conceptColors}
            selectedId={selectedFrameId}
            onCollapse={frameState.setCollapsed}
            editable={editable}
            drawing={frameState.drawing}
            onPointerDown={onFramePointerDown}
          />
          {!diagnosis.noLines && (
            <LineLayer
              lines={bundled ?? lines}
              bundles={bundled?.bundles}
              blocks={blocks}
              mapsById={mapsById}
              selection={selection}
              related={bundleRelated ?? related}
              onSelect={select}
              tethers={tethers}
              // trace lines only in “Everything” (item 10)
              traces={layer === "all" && !diagnosis.noLines ? traces : NO_TRACES}
            />
          )}
          <NoteLayer
            notes={shownNotes}
            selectedId={selection?.t === "note" ? selection.id : null}
            editingId={noteState.editing}
            canNote={canNote}
            onPointerDown={noteState.onNotePointerDown}
            onToggleStatus={toggleNoteStatus}
            onEdit={noteState.edit}
            onCommit={noteState.commit}
            onCancel={noteState.cancel}
            onHeight={noteState.onHeight}
          />
          <Overview lines={lines} notes={miniNotes} notesDragging={noteState.dragging} />
          {editable && <DropHint store={dropStore} hintRef={hintRef} />}
          <OverlayLayer>
            {/* fading (slice 4p, step 2): the candidate draws first, so the hover and the selection marks stay above it */}
            <FadeLayer
              data={fadeData}
              notes={fadeNotes}
              lines={bundled ?? lines}
              bundles={bundled?.bundles}
              blocks={blocks}
              mapsById={mapsById}
              traces={layer === "all" && !diagnosis.noLines ? traces : NO_TRACES}
            />
            {/* a selected requirement's coverage colours (slice 4b-1): above the fading, so Focus keeps them on */}
            <CoverageLayer
              index={requirementIndex}
              requirementId={selection?.t === "req" ? selection.id : null}
              lines={bundled ?? lines}
              bundles={bundled?.bundles}
              blocks={blocks}
              mapsById={mapsById}
            />
            {!diagnosis.noLines && (
              <HoverLines
                hoverStore={hoverStore}
                lassoStore={lasso.lasso}
                busy={busy}
                allLines={lines}
                lines={bundled ?? lines}
                bundles={bundled?.bundles}
                blocks={blocks}
                mapsById={mapsById}
              />
            )}
            <HoverOverlay hoverStore={hoverStore} lassoStore={lasso.lasso} busy={busy} lines={lines} flash={ui.flash} outline={resize.outline} />
            <SelectionOverlay selection={selection} lassoStore={lasso.lasso} frames={frames} frameRects={frameRects} noteRects={noteRects} />
            <DropTargetMark store={dropStore} lines={bundled ?? lines} bundles={bundled?.bundles} blocks={blocks} mapsById={mapsById} />
          </OverlayLayer>
          <FocusDriver target={focusTarget} canvasId={canvasId} />
          <ChangesDriver data={fadeData} canvasId={canvasId} />
          {draft && <DraftLine draft={draft} />}
          {modes.relateFrom && modes.cursor && <RelateLine fromCardId={modes.relateFrom} cursor={modes.cursor} />}
        </ReactFlow>
        {asking && <ConceptQuestion question={asking.question} onAnswer={asking.answer} kind={asking.kind} />}
        <ChangesBar imports={changeImports ?? NO_IMPORTS} />
        {nodes.length === 0 && frames.length === 0 && (
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
