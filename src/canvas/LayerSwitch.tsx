"use client";

// Everything / Mappings / Relationships in the top bar (prototype data-layer buttons, D-22, slice 2a): which lines the
// open canvas shows. Saved per canvas for editors; reviewers and readers switch it in their browser only (`look.tsx`).
// Slice 38: in the canvas toolbar with the prototype's short labels All / Maps / Rels at every width, the full name in
// each button's title.

import type { CanvasLayer } from "@/domain/types";
import { useCanvasLook } from "./look";
import { cn } from "@/ui/lib/utils";
import { SEGMENTED_BUTTON, SEGMENTED_TRACK } from "@/ui/components/segmented";

const OPTIONS: { value: CanvasLayer; label: string; short: string }[] = [
  { value: "all", label: "Everything", short: "All" },
  { value: "mappings", label: "Mappings", short: "Maps" },
  { value: "relationships", label: "Relationships", short: "Rels" },
];

export function LayerSwitch() {
  const api = useCanvasLook();
  if (!api) return null;
  return (
    <div role="group" aria-label="What to show" data-testid="switch-layer" className={cn("inline-flex flex-none", SEGMENTED_TRACK)}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.label}
          aria-pressed={api.look.layer === o.value}
          data-layer={o.value}
          onClick={() => api.look.layer !== o.value && api.setLook({ layer: o.value })}
          className={cn(SEGMENTED_BUTTON, "px-2")}
        >
          {o.short}
        </button>
      ))}
    </div>
  );
}
