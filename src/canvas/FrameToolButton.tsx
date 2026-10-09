"use client";

// The Frame tool in the top bar (prototype #tFrame, slice 2b): pressed, a drag on the canvas draws a frame; a click
// makes a 480 × 320 frame there. A does the same on the canvas; Esc cancels. Editors only.

import { useContext } from "react";
import { useToast } from "@/ui/components/toast";
import { FRAME_TOOL_HINT } from "./CanvasModes";
import { CanvasUiCtx } from "./context";

export function FrameToolButton() {
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  const on = ui.mode?.kind === "frame";
  return (
    <button
      type="button"
      aria-pressed={on}
      title="Frame tool (A): drag on the canvas to draw a frame"
      data-testid="button-tool-frame"
      onClick={() => {
        ui.setMode(on ? null : { kind: "frame" });
        if (!on) toast(FRAME_TOOL_HINT);
      }}
      className="inline-flex h-[30px] flex-none items-center gap-1.5 rounded-md px-2 text-im-ink-2 hover:bg-im-hover hover:text-im-ink aria-pressed:bg-im-logical-soft aria-pressed:text-im-logical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-im-logical"
    >
      <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden>
        <rect x="2.5" y="4" width="11" height="9.5" rx="2.5" strokeDasharray="2.5 2" />
        <path d="M2.5 2h5" />
      </svg>
      <span className="hidden lg:inline">Frame</span>
    </button>
  );
}
