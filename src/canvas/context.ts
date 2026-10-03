"use client";

import { createContext } from "react";
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

/** Shared between the canvas and the canvas tools in the top bar (notation, zoom, fit) and the Overview. */
export interface CanvasUiApi {
  overviewOpen: boolean;
  toggleOverview: () => void;
  notation: Notation;
  setNotation: (n: Notation) => void;
  /** Fits all cards into the view; set by the canvas once it is mounted. */
  fit: () => void;
  registerFit: (fit: () => void) => void;
}

export const CanvasUiCtx = createContext<CanvasUiApi>({
  overviewOpen: true,
  toggleOverview: noop,
  notation: "ie",
  setNotation: noop,
  fit: noop,
  registerFit: noop,
});
