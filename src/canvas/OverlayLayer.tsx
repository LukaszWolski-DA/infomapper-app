"use client";

// The overlay above the cards (slice 4p, trial A; AD-24's “draw highlights in the overlay layer”): one container in
// React Flow's viewport portal with a compositing layer of its own (`will-change: transform`, canvas.css). What changes
// often is drawn in it: the hovered lines and the rows at their ends (C-10), the moved-row flash, the card-width
// outline, the selection marks and the lasso. Adding or removing them repaints this layer only, not the viewport's big
// layer with its cards and lines; panning and zooming move it with the viewport like the rest.

import type { ReactNode } from "react";
import { ViewportPortal } from "@xyflow/react";

export function OverlayLayer({ children }: { children: ReactNode }) {
  return (
    <ViewportPortal>
      <div className="overlay-layer" data-testid="layer-overlay">
        {children}
      </div>
    </ViewportPortal>
  );
}
