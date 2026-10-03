"use client";

// Wraps the canvas page so the canvas and its tools in the top bar (zoom, fit) share one React Flow instance.
// Per-browser view preferences (whether the Overview is open) stay in the browser (data model section 12).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { CanvasUiCtx, type CanvasUiApi } from "./context";

const OVERVIEW_KEY = "infomapper:overview";

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
  const fitRef = useRef<() => void>(() => {});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount: localStorage is not available on the server
    if (readPreference(OVERVIEW_KEY) === "closed") setOverviewOpen(false);
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
      fit: () => fitRef.current(),
      registerFit: (fit) => {
        fitRef.current = fit;
      },
    }),
    [overviewOpen, toggleOverview],
  );

  return (
    <ReactFlowProvider>
      <CanvasUiCtx.Provider value={api}>{children}</CanvasUiCtx.Provider>
    </ReactFlowProvider>
  );
}
