"use client";

// Crow's foot / UML in the canvas toolbar (prototype data-not buttons): one setting for every canvas (D-22). Slice 38:
// the short labels IE / UML at every width; on a narrow canvas it is in “More” (`more-breakpoints.ts`).

import { useContext } from "react";
import { CanvasUiCtx, type Notation } from "./context";
import { cn } from "@/ui/lib/utils";
import { SEGMENTED_BUTTON, SEGMENTED_TRACK } from "@/ui/components/segmented";

const OPTIONS: { value: Notation; label: string; short: string; title: string }[] = [
  { value: "ie", label: "Crow's foot", short: "IE", title: "Crow's foot (Information Engineering)" },
  { value: "uml", label: "UML", short: "UML", title: "UML multiplicity, as in Enterprise Architect" },
];

export function NotationSwitch() {
  const ui = useContext(CanvasUiCtx);
  return (
    <div role="group" aria-label="Relationship notation" data-testid="switch-notation" className={cn("inline-flex flex-none", SEGMENTED_TRACK)}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={ui.notation === o.value}
          data-notation={o.value}
          onClick={() => ui.setNotation(o.value)}
          className={cn(SEGMENTED_BUTTON, "px-2")}
        >
          {o.short}
        </button>
      ))}
    </div>
  );
}
