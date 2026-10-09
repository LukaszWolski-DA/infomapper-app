"use client";

// Wraps the canvas page so the canvas, the panels and the tools in the top bar share one React Flow instance and one
// selection.
// Per-browser view preferences (whether the Overview is open, the notation) stay in the browser (data model
// section 12). The notation is one setting for every canvas (D-22).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { CanvasUiCtx, type CanvasHandle, type CanvasHost, type CanvasMode, type CanvasUiApi, type Notation, type UndoHooks } from "./context";
import type { Selection } from "./line-data";

const OVERVIEW_KEY = "infomapper:overview";
const NOTATION_KEY = "infomapper:notation";

export function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // private mode or blocked storage: the preference is simply not remembered
  }
}

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [notation, setNotationState] = useState<Notation>("ie");
  const [selection, select] = useState<Selection>(null);
  const handle = useRef<CanvasHandle | null>(null);
  const host = useRef<CanvasHost | null>(null);
  const undo = useRef<UndoHooks | null>(null);
  const [mode, setMode] = useState<CanvasMode>(null);
  const [layoutKey, setLayoutKey] = useState("");
  const [flash, setFlash] = useState<{ rowId: string; n: number } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashRow = useCallback((rowId: string) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash((f) => ({ rowId, n: (f?.n ?? 0) + 1 }));
    flashTimer.current = setTimeout(() => setFlash(null), 700);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount: localStorage is not available on the server
    if (readPreference(OVERVIEW_KEY) === "closed") setOverviewOpen(false);
    if (readPreference(NOTATION_KEY) === "uml") setNotationState("uml");
  }, []);

  const setNotation = useCallback((n: Notation) => {
    writePreference(NOTATION_KEY, n);
    setNotationState(n);
  }, []);

  const toggleOverview = useCallback(() => {
    setOverviewOpen((open) => {
      writePreference(OVERVIEW_KEY, open ? "closed" : "open");
      return !open;
    });
  }, []);

  const api = useMemo<CanvasUiApi>(
    () => ({
      overviewOpen,
      toggleOverview,
      notation,
      setNotation,
      selection,
      select,
      fit: () => handle.current?.fit(),
      place: (target, rows, options) => handle.current?.place(target, rows, options),
      remove: (cardId) => handle.current?.remove(cardId),
      centerOn: (cardId) => handle.current?.centerOn(cardId),
      freeSpot: () => handle.current?.freeSpot() ?? { x: 40, y: 40 },
      registerCanvas: (h) => {
        handle.current = h;
      },
      placeAt: (target, rows, at) => handle.current?.placeAt(target, rows, at),
      setCardView: (cardId, view) => handle.current?.setCardView(cardId, view),
      fitWidth: (cardId) => handle.current?.fitWidth(cardId),
      placeBeside: (cards, anchorCardId, side) => handle.current?.placeBeside(cards, anchorCardId, side),
      settled: () => handle.current?.settled() ?? Promise.resolve(),
      cardView: (cardId) => handle.current?.cardView(cardId) ?? null,
      selectAll: () => handle.current?.selectAll(),
      arrangeSelection: (mode) => handle.current?.arrangeSelection(mode),
      fitSelectionWidths: () => handle.current?.fitSelectionWidths(),
      removeSelection: () => handle.current?.removeSelection(),
      placeSourcesOfSelection: (sourcesOf) => handle.current?.placeSourcesOfSelection(sourcesOf),
      createFrameAt: (at) => handle.current?.createFrameAt(at),
      frameView: (frameId) => handle.current?.frameView(frameId) ?? null,
      framesView: () => handle.current?.framesView() ?? [],
      cardFrame: (cardId) => handle.current?.cardFrame(cardId) ?? null,
      frameAt: (at) => handle.current?.frameAt(at) ?? null,
      frameRefs: () => handle.current?.frameRefs() ?? [],
      putInNewFrame: (cardIds, fromCard) => handle.current?.putInNewFrame(cardIds, fromCard),
      arrangeIntoFrames: () => handle.current?.arrangeIntoFrames(),
      updateFrame: (frameId, patch) => handle.current?.updateFrame(frameId, patch) ?? Promise.resolve(false),
      deleteFrame: (frameId) => handle.current?.deleteFrame(frameId),
      fitFrame: (frameId) => handle.current?.fitFrame(frameId),
      zoomToFrame: (frameId) => handle.current?.zoomToFrame(frameId),
      selectFrameCards: (frameId) => handle.current?.selectFrameCards(frameId),
      setFrameCollapsed: (frameId, collapsed) => handle.current?.setFrameCollapsed(frameId, collapsed),
      bundleView: (key) => handle.current?.bundleView(key) ?? null,
      flash,
      flashRow,
      mode,
      setMode,
      host: () => host.current,
      registerHost: (h) => {
        host.current = h;
      },
      undo: () => undo.current,
      registerUndo: (u) => {
        undo.current = u;
      },
      layoutKey,
      publishLayout: setLayoutKey,
    }),
    [overviewOpen, toggleOverview, notation, setNotation, selection, mode, flash, flashRow, layoutKey],
  );

  return (
    <ReactFlowProvider>
      <CanvasUiCtx.Provider value={api}>{children}</CanvasUiCtx.Provider>
    </ReactFlowProvider>
  );
}
