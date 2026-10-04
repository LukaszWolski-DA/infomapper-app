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
}

const noop = () => {};
export const CanvasCardsCtx = createContext<CanvasCardsApi>({
  editable: false,
  selection: null,
  select: noop,
  toggleCollapse: noop,
  cycleFilter: noop,
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
}

/**
 * A source column row dropped on an entity card (slice 1b, D-48): on one of its attribute rows, or anywhere else on
 * the card (its header, an empty card). `at` is the drop point on the screen, for the choice that may follow.
 */
export interface ColumnDrop {
  columnId: Uuid;
  target: { attributeId: Uuid } | { entityId: Uuid };
  at: { x: number; y: number };
}

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
  /** The canvas reports a dropped column; the panels decide what it means (they know the model). */
  dropColumn: (drop: ColumnDrop) => void;
  registerColumnDrop: (handler: ((drop: ColumnDrop) => void) | null) => void;
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
  registerCanvas: noop,
  dropColumn: noop,
  registerColumnDrop: noop,
});

/** Drag data of a left-panel item dropped onto the canvas: JSON `{ target: CardTarget, rows: number }`. */
export const CARD_DRAG_TYPE = "application/x-infomapper-card";
