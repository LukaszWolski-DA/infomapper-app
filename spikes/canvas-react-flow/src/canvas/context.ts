"use client";

import { createContext } from "react";
import type { RowFilter } from "./CardNode";

/* Callbacks the custom nodes need; kept in a context so node data stays plain and memo-friendly. */
export type Notation = "ie" | "uml";

export interface CanvasApi {
  notation: Notation;
  toggleCollapse: (cardId: string) => void;
  setFilter: (cardId: string, f: RowFilter) => void;
  toggleFrame: (frameId: string) => void;
}

const noop = () => {};
export const CanvasCtx = createContext<CanvasApi>({ notation: "ie", toggleCollapse: noop, setFilter: noop, toggleFrame: noop });
