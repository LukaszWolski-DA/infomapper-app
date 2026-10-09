"use client";

import { createContext } from "react";
import type { Uuid } from "@/domain/ids";
import type { ArrangeMode } from "./arrange";
import type { FrameData, FrameStats } from "./frame-data";
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
  /** Shift+click on a card: in or out of the selection (slice 2a). */
  toggleCard: (cardId: string) => void;
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
  toggleCard: noop,
});

/**
 * Measurement-only switches (slice 2a diagnosis, AD-31): only the measurement-only production build passes them, from
 * `?diag=nolines`, `?diag=blocks`, `?diag=noframes` or `?diag=nolabels`. Users never see them.
 */
export interface Diagnosis {
  /** No line layer at all. */
  noLines?: boolean;
  /** Every card drawn as its below-40 % block, at any zoom. */
  blocks?: boolean;
  /** No frame layer at all (slice 2b, S2B-14). The frame names' zoom variable is still set, to tell the two apart. */
  noFrames?: boolean;
  /** Frames without their names and chips (slice 2b, S2B-14). */
  noLabels?: boolean;
}
export const DiagnosisCtx = createContext<Diagnosis>({});

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
  /** Selects every card on the canvas (Ctrl+A, toolbox “Select all”; slice 2a). */
  selectAll: () => void;
  /** The selected cards aligned, stacked or lined up, in one change (slice 2a). */
  arrangeSelection: (mode: ArrangeMode) => void;
  /** “Fit widths to names” for every selected card, in one change. */
  fitSelectionWidths: () => void;
  /** Takes the selected cards off this canvas in one change, with Undo in the toast. */
  removeSelection: () => void;
  /**
   * “Add sources of selected entities”: the missing feeding source tables of each selected entity, beside its card,
   * in one change. `sourcesOf` gives an entity's feeding source tables and their row counts (the page knows the model).
   */
  placeSourcesOfSelection: (sourcesOf: (entityId: Uuid) => { sourceTableId: Uuid; rows: number }[]) => void;
  /** “New frame here” (slice 2b): a 480 × 320 frame centred on a canvas point. */
  createFrameAt: (at: { x: number; y: number }) => void;
  /** A frame as the canvas shows it now, with its cards and numbers (they change without a fresh page). */
  frameView: (frameId: Uuid) => FrameView | null;
  /** Every frame of the canvas as it shows them now, largest first. */
  framesView: () => FrameView[];
  /** The frame a card belongs to on this canvas now. */
  cardFrame: (cardId: Uuid) => FrameData | null;
  /** The smallest frame around a canvas point (the Entity tool takes a concept frame's concept, D-46). */
  frameAt: (at: { x: number; y: number }) => FrameData | null;
  /** Every frame at the version the canvas knows: a new card may make one grow (slice 2b). */
  frameRefs: () => { frameId: Uuid; expectedVersion: number }[];
  /**
   * Puts cards in a new frame around them (PRD item 12): a selection takes only itself; one card (`fromCard`) also
   * takes the free cards fully inside the new frame.
   */
  putInNewFrame: (cardIds: readonly Uuid[], fromCard: boolean) => void;
  /** “Arrange into frames by concept and system” (canvas overview). */
  arrangeIntoFrames: () => void;
  /** Renames a frame or changes what it stands for (the frame panel); resolves whether it was saved. */
  updateFrame: (frameId: Uuid, patch: FramePatch) => Promise<boolean>;
  /** Deletes a frame; its cards stay. The toast offers Undo. */
  deleteFrame: (frameId: Uuid) => void;
  fitFrame: (frameId: Uuid) => void;
  zoomToFrame: (frameId: Uuid) => void;
  /** Selects the frame's cards (toolbox “Select its cards”). */
  selectFrameCards: (frameId: Uuid) => void;
}

/** A card in a frame, for the frame panel. */
export interface FrameMember {
  id: Uuid;
  kind: "ent" | "src";
  targetId: Uuid;
  name: string;
  misplaced: boolean;
}

/** A frame as the canvas shows it now: its cards and the numbers of its label (slice 2b). */
export interface FrameView {
  frame: FrameData;
  cardIds: Uuid[];
  members: FrameMember[];
  stats: FrameStats;
}

/** What the frame panel may change (slice 2b, item 9). */
export interface FramePatch {
  name?: string;
  kind?: "concept" | "source_system" | "free";
  conceptId?: Uuid;
  sourceSystemId?: Uuid;
  color?: string;
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
  /** A right-click on a card of a selection of several (slice 2a): the group's toolbox. */
  | { kind: "selection" }
  | { kind: "row"; cardId: Uuid; rowId: Uuid }
  | { kind: "map"; mappingId: Uuid }
  | { kind: "rel"; relationshipId: Uuid }
  /** A frame's name, handle or an empty spot inside it (slice 2b). */
  | { kind: "frame"; frameId: Uuid };

export interface ToolboxRequest {
  target: ToolboxTarget;
  /** Where the toolbox opens, on the screen. */
  screen: { x: number; y: number };
  /** The same point on the canvas, for “here” actions. */
  at: { x: number; y: number };
}

/**
 * A canvas tool that changes what a click does: the Entity tool (D-46), drawing a relationship from a card, or the
 * Hand tool (D-18, slice 2a), with which a left drag anywhere pans. One at a time; Esc ends it.
 */
export type CanvasMode = { kind: "entity" } | { kind: "relate"; fromCardId: Uuid } | { kind: "hand" } | { kind: "frame" } | null;

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
  /** A frame was just made (slice 2b): its name is ready to type in the right panel. */
  frameCreated: (frameId: Uuid) => void;
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
  /**
   * Changes whenever the canvas changes its frames or which cards are in them (slice 2b), so the panels that show
   * frames draw again; positions alone do not change it.
   */
  layoutKey: string;
  publishLayout: (key: string) => void;
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
  selectAll: noop,
  arrangeSelection: noop,
  fitSelectionWidths: noop,
  removeSelection: noop,
  placeSourcesOfSelection: noop,
  createFrameAt: noop,
  frameView: () => null,
  framesView: () => [],
  cardFrame: () => null,
  frameAt: () => null,
  frameRefs: () => [],
  putInNewFrame: noop,
  arrangeIntoFrames: noop,
  updateFrame: () => Promise.resolve(false),
  deleteFrame: noop,
  fitFrame: noop,
  zoomToFrame: noop,
  selectFrameCards: noop,
  registerCanvas: noop,
  mode: null,
  setMode: noop,
  flash: null,
  flashRow: noop,
  host: () => null,
  registerHost: noop,
  undo: () => null,
  registerUndo: noop,
  layoutKey: "",
  publishLayout: noop,
});

/** Drag data of a left-panel item dropped onto the canvas: JSON `{ target: CardTarget, rows: number }`. */
export const CARD_DRAG_TYPE = "application/x-infomapper-card";
