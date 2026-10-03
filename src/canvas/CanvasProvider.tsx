"use client";

// Wraps the canvas page so the canvas and its tools in the top bar (zoom, fit) share one React Flow instance.
// Per-browser view preferences (whether the Overview is open, the notation) stay in the browser (data model
// section 12). The notation is one setting for every canvas (D-22).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { CanvasUiCtx, type CanvasUiApi, type Notation } from "./context";

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
  const fitRef = useRef<() => void>(() => {});

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
      fit: () => fitRef.current(),
      registerFit: (fit) => {
        fitRef.current = fit;
      },
    }),
    [overviewOpen, toggleOverview, notation, setNotation],
  );

  return (
    <ReactFlowProvider>
      <CanvasUiCtx.Provider value={api}>{children}</CanvasUiCtx.Provider>
    </ReactFlowProvider>
  );
}
