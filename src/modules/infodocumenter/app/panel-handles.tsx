"use client";

// The editor's side panels (slice 27, item 6; slice 28, item 1; the prototype's `PANELS`, `.de-rz`, `togl`, `togr`).
//
// Resizing: a handle each; drag one, or use the arrow keys (16 px, with Shift 64 px), within the canvas's bounds
// (D-54: 200–520 and 280–640 px); a double-click or Home gives its default width back (264, 340). A focusable separator
// with its width as its value (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`). The widths are CSS variables on the
// editor's body (`--dl`, `--dr`; it holds the preview, not the canvas), written straight to the element while a drag
// runs (no render per move): the editor resizes live, the canvas moves a guide line and applies on release.
//
// Hiding and showing (slice 28): a toggle at each end of the top bar (the canvas's icons, `aria-pressed`). A hidden panel
// is 0 wide (the body's class `nol` or `nor`), `inert` and without its handle; selecting never shows the options panel,
// a double-click on a section does (`show`). Up to 1,100 px the layout stacks: no handles, a hidden panel not shown.
//
// The widths and the flags are kept together in this person's cookie (`panels-cookie.ts`, the canvas's format, the
// editor's own name), which the server reads, so the first paint has them. "Fit width" follows on its own: the preview
// watches its width (`preview.tsx`).

import { useRef, useState, type RefObject } from "react";
import { PANEL_LIMITS, clampWidth, formatSidePanelsCookie, type PanelSide } from "@/ui/side-panels-cookie";
import { DOC_PANELS_COOKIE_MAX_AGE, docPanelsCookieName, type DocPanels } from "../ui/panels-cookie";
import { cn } from "@/ui/lib/utils";
import { toolButtonVariants } from "@/ui/components/tool-button";

export const HANDLE_TEXTS = {
  left: "Width of the sections panel",
  right: "Width of the options panel",
  title: "Drag to widen; double-click for the default width",
} as const;

export const TOGGLE_TEXTS: Readonly<Record<PanelSide, string>> = {
  left: "Show or hide the sections panel",
  right: "Show or hide the options panel",
};

const VAR: Readonly<Record<PanelSide, string>> = { left: "--dl", right: "--dr" };
const WIDTH: Readonly<Record<PanelSide, "leftWidth" | "rightWidth">> = { left: "leftWidth", right: "rightWidth" };
const STEP = 16, BIG_STEP = 64;

function writeCookie(userId: string, panels: DocPanels) {
  try {
    document.cookie = `${docPanelsCookieName(userId)}=${formatSidePanelsCookie(panels)}; path=/; max-age=${DOC_PANELS_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    // blocked cookies: the layout is simply not remembered
  }
}

export interface DocPanelsApi {
  /** Which panels are shown (a render on each toggle; the widths never render). */
  shown: Readonly<Record<PanelSide, boolean>>;
  toggle: (side: PanelSide) => void;
  /** Shows a hidden panel, for an action that leads to it on purpose (a double-click on a section). */
  show: (side: PanelSide) => void;
  /** The body's classes for the hidden panels (`nol`, `nor`). */
  className: string;
  /** For the handles: the layout the server drew, a width as it stands, a width given (not kept yet) and the keeping. */
  initial: DocPanels;
  width: (side: PanelSide) => number;
  setWidth: (side: PanelSide, width: number) => void;
  keep: () => void;
}

export function useDocPanels(userId: string, initial: DocPanels): DocPanelsApi {
  const current = useRef<DocPanels>({ ...initial });
  const [shown, setShown] = useState({ left: initial.left, right: initial.right });
  const keep = () => writeCookie(userId, current.current);
  const toggle = (side: PanelSide) => {
    current.current = { ...current.current, [side]: !current.current[side] };
    setShown({ left: current.current.left, right: current.current.right });
    keep();
  };
  const show = (side: PanelSide) => {
    if (!current.current[side]) toggle(side);
  };
  const width = (side: PanelSide) => current.current[WIDTH[side]];
  const setWidth = (side: PanelSide, w: number) => {
    current.current = { ...current.current, [WIDTH[side]]: w };
  };
  return { shown, toggle, show, className: [shown.left ? "" : "nol", shown.right ? "" : "nor"].filter(Boolean).join(" "), initial, width, setWidth, keep };
}

/** A toggle in the top bar (the canvas's `PanelToggle`: its icon, look and words' form). */
export function PanelToggle({ side, panels }: { side: PanelSide; panels: DocPanelsApi }) {
  return (
    <button
      type="button"
      aria-pressed={panels.shown[side]}
      title={TOGGLE_TEXTS[side]}
      aria-label={TOGGLE_TEXTS[side]}
      aria-controls={side === "left" ? "editor-left" : "editor-right"}
      data-testid={side === "left" ? "button-toggle-sections" : "button-toggle-options"}
      onClick={() => panels.toggle(side)}
      className={cn(toolButtonVariants({ tone: "plain" }), "h-control-sm px-2")}
    >
      <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden>
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
        <path d={side === "left" ? "M6 2.5v11" : "M10 2.5v11"} />
      </svg>
    </button>
  );
}

export function PanelHandles({ body, panels }: { body: RefObject<HTMLDivElement | null>; panels: DocPanelsApi }) {
  const handles = useRef<Partial<Record<PanelSide, HTMLDivElement | null>>>({});
  const widthOf = panels.width;

  // the widths the server drew from the cookie are on the element (its `style`); from here on they are written to it
  // directly (React compares its own props, so a render of the editor never puts the first widths back)
  const apply = (side: PanelSide, width: number) => {
    const w = clampWidth(side, width);
    panels.setWidth(side, w);
    body.current?.style.setProperty(VAR[side], `${w}px`);
    handles.current[side]?.setAttribute("aria-valuenow", String(w));
  };

  const handle = (side: PanelSide) => {
    const { min, max, def } = PANEL_LIMITS[side];
    return (
      <div
        ref={(el) => {
          handles.current[side] = el;
        }}
        role="separator"
        aria-orientation="vertical"
        aria-label={HANDLE_TEXTS[side]}
        aria-valuenow={panels.initial[WIDTH[side]]}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-controls={side === "left" ? "editor-left" : "editor-right"}
        title={HANDLE_TEXTS.title}
        tabIndex={0}
        data-testid={`handle-${side}`}
        className={`de-rz ${side === "left" ? "l" : "r"}`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const el = e.currentTarget, x0 = e.clientX, w0 = widthOf(side);
          el.setPointerCapture(e.pointerId);
          el.classList.add("drag");
          e.preventDefault();
          const move = (ev: PointerEvent) => apply(side, w0 + (side === "left" ? ev.clientX - x0 : x0 - ev.clientX));
          const end = () => {
            el.classList.remove("drag");
            el.removeEventListener("pointermove", move);
            el.removeEventListener("pointerup", end);
            el.removeEventListener("pointercancel", end);
            panels.keep();
          };
          el.addEventListener("pointermove", move);
          el.addEventListener("pointerup", end);
          el.addEventListener("pointercancel", end);
        }}
        onDoubleClick={() => {
          apply(side, def);
          panels.keep();
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? BIG_STEP : STEP;
          const grow = e.key === "ArrowRight" ? (side === "left" ? step : -step) : e.key === "ArrowLeft" ? (side === "left" ? -step : step) : null;
          if (grow !== null) apply(side, widthOf(side) + grow);
          else if (e.key === "Home") apply(side, def);
          else return;
          e.preventDefault();
          e.stopPropagation();
          panels.keep();
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

/**
 * The handles' look (the prototype's `.de-rz`) and the hidden panels (`nol`, `nor`: 0 wide, without their handle; the
 * panel itself is `inert`). Up to 1,100 px the layout stacks: no handles, and a hidden panel is not shown.
 */
export const HANDLE_CSS = `
.de-body{position:relative}
.de-rz{position:absolute;top:0;bottom:0;width:8px;cursor:col-resize;z-index:6;touch-action:none}
.de-rz.l{left:calc(var(--dl,264px) - 4px)}.de-rz.r{right:calc(var(--dr,340px) - 4px)}
.de-rz::after{content:"";position:absolute;top:0;bottom:0;left:3px;width:2px;background:transparent;transition:background .12s}
.de-rz:hover::after,.de-rz:focus-visible::after,.de-rz.drag::after{background:var(--im-logical)}
.de-rz:focus-visible{outline:none}
.de-body.nol{--dl:0px!important}.de-body.nor{--dr:0px!important}
.de-body.nol>#editor-left,.de-body.nor>#editor-right{visibility:hidden;overflow:hidden;padding:0;border:0}
.de-body.nol>.de-rz.l,.de-body.nor>.de-rz.r{display:none}
@media (max-width:1100px){.de-rz{display:none}}
`;
