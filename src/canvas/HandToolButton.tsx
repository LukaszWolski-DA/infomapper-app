"use client";

// The Hand tool in the top bar (prototype #tHand, D-18, slice 2a): pressed, a left drag anywhere moves the canvas.
// H does the same on the canvas; V or Esc returns to selecting. Every role has it: it only moves the view.

import { useContext } from "react";
import { useToast } from "@/ui/components/toast";
import { HAND_TOOL_HINT } from "./CanvasModes";
import { CanvasUiCtx } from "./context";

export function HandToolButton() {
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  const on = ui.mode?.kind === "hand";
  return (
    <button
      type="button"
      aria-pressed={on}
      title="Hand tool (H): drag anywhere to move the canvas. V or Esc returns to selecting"
      data-testid="button-tool-hand"
      onClick={() => {
        ui.setMode(on ? null : { kind: "hand" });
        if (!on) toast(HAND_TOOL_HINT);
      }}
      className="inline-flex h-[30px] flex-none items-center gap-1.5 rounded-md px-2 text-im-ink-2 hover:bg-im-hover hover:text-im-ink aria-pressed:bg-im-logical-soft aria-pressed:text-im-logical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-im-logical"
    >
      <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.4] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden>
        <path d="M5.5 8V3.8a1 1 0 0 1 2 0V7.5M7.5 7V2.8a1 1 0 0 1 2 0V7.5M9.5 7.2V3.8a1 1 0 0 1 2 0v5.4c0 2.7-1.8 4.8-4.3 4.8-1.6 0-2.6-.7-3.5-2L2.2 9.4a1 1 0 0 1 1.6-1.2L5.5 10" />
      </svg>
      <span className="hidden lg:inline">Hand</span>
    </button>
  );
}
