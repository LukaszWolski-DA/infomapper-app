"use client";

import { createContext } from "react";
import type { Uuid } from "@/domain/ids";
import type { Selection } from "./line-data";

/** What the card nodes may do and see; kept in a context so node data stays plain and memo-friendly. */
export interface CanvasCardsApi {
  /** The user may change the canvas (owner, admin, modeler; not archived). */
  editable: boolean;
  selection: Selection;
  select: (sel: Selection) => void;
  toggleCollapse: (cardId: string) => void;
  cycleFilter: (cardId: string) => void;
  /** The relate button on an entity card: click, then click the other entity. */
  startRelate: (cardId: string) => void;
  /** Double-click on the width handle. */
  fitWidth: (cardId: string) => void;
}

const noop = () => {};
export const CanvasCardsCtx = createContext<CanvasCardsApi>({
  editable: false,
  selection: null,
  select: noop,
  toggleCollapse: noop,
  cycleFilter: noop,
  startRelate: noop,
  fitWidth: noop,
});

/** Relationship ends: crow's foot (Information Engineering) or UML multiplicity. Shared by all canvases (D-22). */
export type Notation = "ie" | "uml";

/** An element of the model that can get a card: an entity or a source table. */
export type CardTarget = { entityId: Uuid } | { sourceTableId: Uuid };

/** What the mounted canvas offers the panels and the top bar; registered by the canvas once it is mounted. */
export interface CanvasHandle {
  /** Fits all cards into the view. */
  fit: () => void;
  /** Places an element in a free spot of the view, or shows its card when it is already here. `rows` sizes the card. */
  place: (target: CardTarget, rows: number, options?: { quiet?: boolean }) => void;
  /** Takes a card off this canvas (D-02); waits for the card's pending saves. */
  remove: (cardId: Uuid) => void;
  /** Moves the view so the card is in the middle. */
  centerOn: (cardId: Uuid) => void;
  /** A free spot near the middle of the view for a new entity (D-46). */
  freeSpot: () => { x: number; y: number };
  /** Places an element with the top middle of its card at a canvas point (toolbox “Add an entity or table here”). */
  placeAt: (target: CardTarget, rows: number, at: { x: number; y: number }) => void;
  /** “Fit width to names” (D-37): the narrowest width at which every name of the card fits. */
  fitWidth: (cardId: Uuid) => void;
  /** Collapses or expands a card, or sets its row filter (toolbox); saved like the card's own buttons. */
  setCardView: (cardId: Uuid, view: { collapsed?: boolean; rowFilter?: RowFilter }) => void;
  /**
   * Places elements beside a card in one change (B-08): feeding sources on the left, fed entities on the right, each
   * in a free spot. Elements already here are skipped.
   */
  placeBeside: (cards: readonly { target: CardTarget; rows: number }[], anchorCardId: Uuid, side: "left" | "right") => void;
  /** Resolves once every card change still on its way has been saved (before an undo). */
  settled: () => Promise<void>;
  /** A card's collapse state and row filter as the canvas shows them now (changed without a fresh page). */
  cardView: (cardId: Uuid) => { collapsed: boolean; rowFilter: RowFilter } | null;
}

export type RowFilter = "all" | "mapped" | "unmapped" | "keys";

/**
 * A source column row dropped on an entity card (slice 1b, D-48): on one of its attribute rows, or anywhere else on
 * the card (its header, an empty card). `at` is the drop point on the screen, for the choice that may follow.
 */
export interface ColumnDrop {
  columnId: Uuid;
  target: { attributeId: Uuid } | { entityId: Uuid };
  at: { x: number; y: number };
}

/** What a right-click without moving was on (slice 1b, D-19). The canvas has already selected it. */
export type ToolboxTarget =
  | { kind: "canvas" }
  | { kind: "card"; cardId: Uuid }
  | { kind: "row"; cardId: Uuid; rowId: Uuid }
  | { kind: "map"; mappingId: Uuid }
  | { kind: "rel"; relationshipId: Uuid };

export interface ToolboxRequest {
  target: ToolboxTarget;
  /** Where the toolbox opens, on the screen. */
  screen: { x: number; y: number };
  /** The same point on the canvas, for “here” actions. */
  at: { x: number; y: number };
}

/** A canvas tool that changes what a click does: the Entity tool (D-46) or drawing a relationship from a card. */
export type CanvasMode = { kind: "entity" } | { kind: "relate"; fromCardId: Uuid } | null;

/**
 * What the canvas asks of the page around it. The canvas knows gestures and positions; the page knows the model and
 * runs the writes, so it registers these handlers.
 */
export interface CanvasHost {
  dropColumn: (drop: ColumnDrop) => void;
  /** The Entity tool or “New entity here”: a new entity whose card's top left is at a canvas point. */
  createEntityAt: (at: { x: number; y: number }, name?: string) => void;
  /** A relationship from one entity card to another (relate button or “Draw a relationship from here”). */
  relate: (fromCardId: Uuid, toCardId: Uuid) => void;
  openToolbox: (request: ToolboxRequest) => void;
  /** Ctrl/Alt + ↑/↓ with an attribute selected (D-36): one place up or down, with Shift to the top or bottom. */
  moveAttribute: (attributeId: Uuid, how: AttributeMove) => void;
  /** Delete or Backspace with a mapping or relationship line selected: deleted at once, with Undo in the toast. */
  deleteLine: (line: { t: "map" | "rel"; id: Uuid }) => void;
}

/** The page's undo (slice 1b), for the canvas's own toasts and for card changes saved without a fresh page. */
export interface UndoHooks {
  /** Undoes the person's last step (the toast's “Undo”). */
  undo: () => void;
  /** A card change was saved: there is something to undo now, and nothing to redo. */
  noteSaved: () => void;
}

export type AttributeMove = "up" | "down" | "top" | "bottom";

/** Shared between the canvas, the panels and the canvas tools in the top bar (notation, zoom, fit). */
export interface CanvasUiApi extends CanvasHandle {
  overviewOpen: boolean;
  toggleOverview: () => void;
  notation: Notation;
  setNotation: (n: Notation) => void;
  /** What is selected on the canvas; the right panel shows it. */
  selection: Selection;
  select: (sel: Selection) => void;
  registerCanvas: (handle: CanvasHandle | null) => void;
  /** The active canvas tool, shared with the top bar's Entity tool button. */
  mode: CanvasMode;
  setMode: (mode: CanvasMode) => void;
  /** A row that was just moved flashes briefly (D-36); `n` restarts the flash. */
  flash: { rowId: Uuid; n: number } | null;
  flashRow: (rowId: Uuid) => void;
  /** The page's handlers for what happens on the canvas; null until the page registers them. */
  host: () => CanvasHost | null;
  registerHost: (host: CanvasHost | null) => void;
  undo: () => UndoHooks | null;
  registerUndo: (undo: UndoHooks | null) => void;
}

export const CanvasUiCtx = createContext<CanvasUiApi>({
  overviewOpen: true,
  toggleOverview: noop,
  notation: "ie",
  setNotation: noop,
  selection: null,
  select: noop,
  fit: noop,
  place: noop,
  remove: noop,
  centerOn: noop,
  freeSpot: () => ({ x: 0, y: 0 }),
  placeAt: noop,
  fitWidth: noop,
  setCardView: noop,
  placeBeside: noop,
  settled: () => Promise.resolve(),
  cardView: () => null,
  registerCanvas: noop,
  mode: null,
  setMode: noop,
  flash: null,
  flashRow: noop,
  host: () => null,
  registerHost: noop,
  undo: () => null,
  registerUndo: noop,
});

/** Drag data of a left-panel item dropped onto the canvas: JSON `{ target: CardTarget, rows: number }`. */
export const CARD_DRAG_TYPE = "application/x-infomapper-card";
