"use client";

// The Entity tool in the canvas toolbar (slice 38: icon only, its name in `aria-label`) (prototype #tEnt, D-46): pressed, the next click on the canvas creates an entity
// there. E does the same on the canvas; Esc cancels.

import { useContext } from "react";
import { useToast } from "@/ui/components/toast";
import { ENTITY_TOOL_HINT } from "./CanvasModes";
import { CanvasUiCtx } from "./context";
import { toolButtonVariants } from "@/ui/components/tool-button";

export function EntityToolButton() {
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  const on = ui.mode?.kind === "entity";
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label="Entity tool (E)"
      title="Entity tool (E): click on the canvas to create a new entity there"
      data-testid="button-tool-entity"
      onClick={() => {
        ui.setMode(on ? null : { kind: "entity" });
        if (!on) toast(ENTITY_TOOL_HINT);
      }}
      className={toolButtonVariants({ size: "toolbar" })}
    >
      <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden>
        <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
        <path d="M2.5 6h11M8 8.5v3M6.5 10h3" />
      </svg>
    </button>
  );
}
