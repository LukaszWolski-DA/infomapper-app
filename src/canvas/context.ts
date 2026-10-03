"use client";

import { createContext } from "react";

/** What the card nodes may do; kept in a context so node data stays plain and memo-friendly. */
export interface CanvasCardsApi {
  /** The user may change the canvas (owner, admin, modeler; not archived). */
  editable: boolean;
  toggleCollapse: (cardId: string) => void;
  cycleFilter: (cardId: string) => void;
}

const noop = () => {};
export const CanvasCardsCtx = createContext<CanvasCardsApi>({ editable: false, toggleCollapse: noop, cycleFilter: noop });

/** Shared between the canvas and the canvas tools in the top bar (zoom, fit) and the Overview. */
export interface CanvasUiApi {
  overviewOpen: boolean;
  toggleOverview: () => void;
  /** Fits all cards into the view; set by the canvas once it is mounted. */
  fit: () => void;
  registerFit: (fit: () => void) => void;
}

export const CanvasUiCtx = createContext<CanvasUiApi>({ overviewOpen: true, toggleOverview: noop, fit: noop, registerFit: noop });
