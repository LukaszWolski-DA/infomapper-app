"use client";

// Zoom out, the zoom value, zoom in and fit, in the top bar as in the prototype (#zOut, #zoomv, #zIn, #zFit).

import { useContext } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { CanvasUiCtx } from "./context";
import { zoomAround } from "./geometry";

const btn =
  "inline-flex h-[30px] items-center rounded-md px-1.5 text-im-ink-2 hover:bg-im-hover hover:text-im-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-im-logical";
const svg = "size-4 fill-none stroke-current stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round]";

export function ZoomControls() {
  const ui = useContext(CanvasUiCtx);
  const rf = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);

  const zoomBy = (factor: number) => {
    const v = zoomAround(rf.getViewport(), factor, { width, height });
    void rf.setViewport(v);
  };

  return (
    <div className="flex flex-none items-center" data-testid="group-zoom">
      <button type="button" className={btn} title="Zoom out" data-testid="button-zoom-out" onClick={() => zoomBy(1 / 1.2)}>
        <svg viewBox="0 0 16 16" className={svg} aria-hidden>
          <path d="M3.5 8h9" />
        </svg>
      </button>
      <span className="min-w-[44px] text-center text-im-ink-2 tabular-nums" data-testid="value-zoom">
        {Math.round(zoom * 100)}%
      </span>
      <button type="button" className={btn} title="Zoom in" data-testid="button-zoom-in" onClick={() => zoomBy(1.2)}>
        <svg viewBox="0 0 16 16" className={svg} aria-hidden>
          <path d="M3.5 8h9M8 3.5v9" />
        </svg>
      </button>
      <button type="button" className={btn} title="Fit everything on screen (F)" data-testid="button-zoom-fit" onClick={ui.fit}>
        <svg viewBox="0 0 16 16" className={svg} aria-hidden>
          <path d="M2 5.5V2h3.5M10.5 2H14v3.5M14 10.5V14h-3.5M5.5 14H2v-3.5" />
        </svg>
      </button>
    </div>
  );
}
