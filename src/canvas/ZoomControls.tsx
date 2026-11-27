"use client";

// Zoom out, the zoom value, zoom in and fit, at the canvas toolbar's end as in the prototype (#zOut, #zoomv, #zIn, #zFit;
// slice 38: 28 px buttons, the value 42 px in 12 px text, `#ctb .zoomv`).
// Slice 9 (D-60): the value is a field. While someone types in it, the typed text is this component's own state, so
// typing re-renders only the zoom group, never `ModelCanvas`. Enter or leaving the field applies the zoom around the
// view's centre, as − and + do, in one `setViewport` (the canvas's size from React Flow's store, no layout read); a
// value out of range is clamped and shown, anything else goes back without a toast; Escape goes back. Keys typed here
// do not reach the canvas: its shortcuts, Undo and Back skip text fields.

import { useContext, useEffect, useRef, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { CanvasUiCtx } from "./context";
import { typedZoom, zoomAround } from "./geometry";
import { QUIET_FIELD } from "@/ui/components/input";
import { cn } from "@/ui/lib/utils";
import { toolButtonVariants } from "@/ui/components/tool-button";

const btn = toolButtonVariants({ size: "toolbar" });
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

  // the typed text, from the first key until the field is left; null shows the zoom (it follows every zoom meanwhile)
  const [draft, setDraft] = useState<string | null>(null);
  const cancel = useRef(false);
  const focusing = useRef(false);
  const shown = `${Math.round(zoom * 100)}%`;
  const field = useRef<HTMLInputElement>(null);
  // a zoom while the field has the focus but nothing is typed yet (Fit's animation, a pinch) writes the new value into
  // it, which drops the selection: select it again, so the first key still replaces it (`select` reads no layout)
  useEffect(() => {
    if (draft === null && field.current && document.activeElement === field.current) field.current.select();
  }, [shown, draft]);
  const apply = () => {
    const typed = draft === null || cancel.current ? null : typedZoom(draft);
    cancel.current = false;
    setDraft(null);
    const current = rf.getViewport().zoom;
    if (typed !== null && typed !== current) zoomBy(typed / current);
  };

  return (
    <div className="flex flex-none items-center gap-0.5" data-testid="group-zoom">
      <button type="button" className={btn} title="Zoom out" aria-label="Zoom out" data-testid="button-zoom-out" onClick={() => zoomBy(1 / 1.2)}>
        <svg viewBox="0 0 16 16" className={svg} aria-hidden>
          <path d="M3.5 8h9" />
        </svg>
      </button>
      <input
        ref={field}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        aria-label="Zoom"
        title="Type a zoom and press Enter"
        className={cn(QUIET_FIELD, "w-[42px] px-0 text-center text-xs tabular-nums")}
        data-testid="value-zoom"
        value={draft ?? shown}
        onFocus={(e) => {
          focusing.current = true;
          e.currentTarget.select();
        }}
        // the click that focuses the field keeps the whole value selected (its mouseup would place the caret)
        onMouseUp={(e) => {
          if (focusing.current) e.preventDefault();
          focusing.current = false;
        }}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onKeyDown={(e) => {
          focusing.current = false;
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") {
            cancel.current = true;
            e.currentTarget.blur();
          }
        }}
        onBlur={apply}
      />
      <button type="button" className={btn} title="Zoom in" aria-label="Zoom in" data-testid="button-zoom-in" onClick={() => zoomBy(1.2)}>
        <svg viewBox="0 0 16 16" className={svg} aria-hidden>
          <path d="M3.5 8h9M8 3.5v9" />
        </svg>
      </button>
      <button type="button" className={btn} title="Fit everything on screen (F)" aria-label="Fit everything on screen (F)" data-testid="button-zoom-fit" onClick={ui.fit}>
        <svg viewBox="0 0 16 16" className={svg} aria-hidden>
          <path d="M2 5.5V2h3.5M10.5 2H14v3.5M14 10.5V14h-3.5M5.5 14H2v-3.5" />
        </svg>
      </button>
    </div>
  );
}
