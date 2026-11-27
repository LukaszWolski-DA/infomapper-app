"use client";

// The canvas toolbar (slice 38, D-90 as proposed; the prototype's `#ctb`): a white box floating at the canvas's top,
// centred, radius 12, `shadow-pop`, 4 px inside, 28 px controls and a hairline between groups. It lies in a strip over
// the canvas's area (`AppShell`'s `<main>`), outside React Flow: the strip contains no canvas element, so its container
// query (“More”, `more-breakpoints.ts`) and its classes restyle nothing of the canvas (AD-24 rule 4), and nothing here
// reads layout in a commit: the strip's width reaches “More”'s menu through a `ResizeObserver` (`toolbarRoom`). The strip
// lets pointer events through to the canvas; only the toolbar takes them. Its box is fixed (its bottom 50 px below the
// canvas's top), so the fits and placements keep `TOOLBAR_TOP_ROOM` free without measuring it.

import { useEffect, useRef, type ReactNode } from "react";
import { toolbarRoom } from "./toolbar-room";

export function CanvasToolbar({ children }: { children: ReactNode }) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) toolbarRoom.set(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      toolbarRoom.set(null);
    };
  }, []);
  return (
    <div ref={strip} data-testid="strip-canvas-toolbar" className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-3 @container">
      <div
        role="toolbar"
        aria-label="Canvas"
        data-testid="bar-canvas"
        className="pointer-events-auto flex min-w-0 max-w-full flex-none items-center gap-0.5 overflow-x-auto rounded-lg border border-im-line bg-im-surface p-1 shadow-pop [scrollbar-width:none]"
      >
        {children}
      </div>
    </div>
  );
}

/** The hairline between the toolbar's groups (the prototype's `.csep`). */
export const ToolbarSeparator = () => <span aria-hidden className="mx-0.5 h-5 w-px flex-none bg-im-line" />;
