"use client";

// The handles between the editor's side panels and the preview (slice 27, item 6; the prototype's `PANELS`, `.de-rz`):
// drag one, or use the arrow keys (16 px, with Shift 64 px), within the panel's bounds; a double-click or Home gives its
// default width back. A focusable separator with its width as its value (Q7: `aria-valuenow`, `aria-valuemin`,
// `aria-valuemax`). The widths are CSS variables on the editor's body (`--dl`, `--dr`; it holds the preview, not the
// canvas), written straight to the element while a drag runs (no render per move), and kept in this person's cookie
// when it ends (`panels-cookie.ts`). Up to 1,100 px the layout stacks and the handles are hidden. "Fit width" follows
// on its own: the preview watches its width (`preview.tsx`).

import { useRef, type RefObject } from "react";
import { clampDocPanel, DOC_PANEL_LIMITS, DOC_PANELS_COOKIE_MAX_AGE, docPanelsCookieName, formatDocPanelsCookie, type DocPanel, type DocPanelWidths } from "../ui/panels-cookie";

export const HANDLE_TEXTS = {
  left: "Width of the sections panel",
  right: "Width of the options panel",
  title: "Drag to widen; double-click for the default width",
} as const;

const VAR: Readonly<Record<DocPanel, string>> = { left: "--dl", right: "--dr" };
const STEP = 16, BIG_STEP = 64;

function writeCookie(userId: string, widths: DocPanelWidths) {
  try {
    document.cookie = `${docPanelsCookieName(userId)}=${formatDocPanelsCookie(widths)}; path=/; max-age=${DOC_PANELS_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    // blocked cookies: the widths are simply not remembered
  }
}

export function PanelHandles({ body, userId, initial }: { body: RefObject<HTMLDivElement | null>; userId: string; initial: DocPanelWidths }) {
  const widths = useRef<Record<DocPanel, number>>({ ...initial });
  const handles = useRef<Partial<Record<DocPanel, HTMLDivElement | null>>>({});

  // the widths the server drew from the cookie are on the element (its `style`); from here on they are written to it
  // directly (React compares its own props, so a render of the editor never puts the first widths back)
  const apply = (side: DocPanel, width: number) => {
    const w = clampDocPanel(side, width);
    widths.current[side] = w;
    body.current?.style.setProperty(VAR[side], `${w}px`);
    handles.current[side]?.setAttribute("aria-valuenow", String(w));
  };
  const keep = () => writeCookie(userId, widths.current);

  const handle = (side: DocPanel) => {
    const { min, max, def } = DOC_PANEL_LIMITS[side];
    return (
      <div
        ref={(el) => {
          handles.current[side] = el;
        }}
        role="separator"
        aria-orientation="vertical"
        aria-label={HANDLE_TEXTS[side]}
        aria-valuenow={initial[side]}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-controls={side === "left" ? "editor-left" : "editor-right"}
        title={HANDLE_TEXTS.title}
        tabIndex={0}
        data-testid={`handle-${side}`}
        className={`de-rz ${side === "left" ? "l" : "r"}`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const el = e.currentTarget, x0 = e.clientX, w0 = widths.current[side];
          el.setPointerCapture(e.pointerId);
          el.classList.add("drag");
          e.preventDefault();
          const move = (ev: PointerEvent) => apply(side, w0 + (side === "left" ? ev.clientX - x0 : x0 - ev.clientX));
          const end = () => {
            el.classList.remove("drag");
            el.removeEventListener("pointermove", move);
            el.removeEventListener("pointerup", end);
            el.removeEventListener("pointercancel", end);
            keep();
          };
          el.addEventListener("pointermove", move);
          el.addEventListener("pointerup", end);
          el.addEventListener("pointercancel", end);
        }}
        onDoubleClick={() => {
          apply(side, def);
          keep();
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? BIG_STEP : STEP;
          const grow = e.key === "ArrowRight" ? (side === "left" ? step : -step) : e.key === "ArrowLeft" ? (side === "left" ? -step : step) : null;
          if (grow !== null) apply(side, widths.current[side] + grow);
          else if (e.key === "Home") apply(side, def);
          else return;
          e.preventDefault();
          e.stopPropagation();
          keep();
        }}
      />
    );
  };
  return (
    <>
      {handle("left")}
      {handle("right")}
    </>
  );
}

/** The handles' look (the prototype's `.de-rz`), hidden where the layout stacks. */
export const HANDLE_CSS = `
.de-body{position:relative}
.de-rz{position:absolute;top:0;bottom:0;width:8px;cursor:col-resize;z-index:6;touch-action:none}
.de-rz.l{left:calc(var(--dl,250px) - 4px)}.de-rz.r{right:calc(var(--dr,330px) - 4px)}
.de-rz::after{content:"";position:absolute;top:0;bottom:0;left:3px;width:2px;background:transparent;transition:background .12s}
.de-rz:hover::after,.de-rz:focus-visible::after,.de-rz.drag::after{background:var(--im-logical)}
.de-rz:focus-visible{outline:none}
@media (max-width:1100px){.de-rz{display:none}}
`;
