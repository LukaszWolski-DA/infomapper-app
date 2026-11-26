"use client";

// The Note tool in the top bar (prototype #tNote, slice 3a): pressed, a click on the canvas makes a note there, or
// pinned to the card, frame name or collapsed block clicked. N does the same on the canvas; Esc cancels. For editors
// and reviewers (Łukasz's step 0 answer 1).

import { useContext } from "react";
import { useToast } from "@/ui/components/toast";
import { NOTE_TOOL_HINT } from "./CanvasModes";
import { CanvasUiCtx } from "./context";
import { cn } from "@/ui/lib/utils";
import { toolButtonVariants } from "@/ui/components/tool-button";

export function NoteToolButton() {
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  const on = ui.mode?.kind === "note";
  return (
    <button
      type="button"
      aria-pressed={on}
      title="Note tool (N): click on the canvas, a card or a frame's name"
      data-testid="button-tool-note"
      onClick={() => {
        ui.setMode(on ? null : { kind: "note" });
        if (!on) toast(NOTE_TOOL_HINT);
      }}
      className={cn(toolButtonVariants(), "px-2 max-[2101px]:px-1.5")}
    >
      <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.5] [stroke-linejoin:round]" aria-hidden>
        <path d="M3 2.5h10v7.5l-3.5 3.5H3z" />
        <path d="M13 10H9.5v3.5" />
      </svg>
      <span className="hidden min-[2101px]:inline">Note</span>
    </button>
  );
}
