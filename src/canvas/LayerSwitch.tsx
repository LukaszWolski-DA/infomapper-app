"use client";

// Everything / Mappings / Relationships in the top bar (prototype data-layer buttons, D-22, slice 2a): which lines the
// open canvas shows. Saved per canvas for editors; reviewers and readers switch it in their browser only (`look.tsx`).
// Short labels All / Maps / Rels below the prototype's 2100 px.

import type { CanvasLayer } from "@/domain/types";
import { useCanvasLook } from "./look";

const OPTIONS: { value: CanvasLayer; label: string; short: string }[] = [
  { value: "all", label: "Everything", short: "All" },
  { value: "mappings", label: "Mappings", short: "Maps" },
  { value: "relationships", label: "Relationships", short: "Rels" },
];

export function LayerSwitch() {
  const api = useCanvasLook();
  if (!api) return null;
  return (
    <div role="group" aria-label="What to show" data-testid="switch-layer" className="inline-flex flex-none rounded-[7px] bg-im-hover p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.label}
          aria-pressed={api.look.layer === o.value}
          data-layer={o.value}
          onClick={() => api.look.layer !== o.value && api.setLook({ layer: o.value })}
          className="h-[26px] whitespace-nowrap rounded-[5px] px-2.5 text-im-ink-2 aria-pressed:bg-im-surface aria-pressed:text-im-ink aria-pressed:shadow-[0_0_0_1px_var(--im-line),0_1px_2px_var(--im-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-im-logical"
        >
          <span className="hidden min-[2100px]:inline">{o.label}</span>
          <span className="min-[2100px]:hidden">{o.short}</span>
        </button>
      ))}
    </div>
  );
}
