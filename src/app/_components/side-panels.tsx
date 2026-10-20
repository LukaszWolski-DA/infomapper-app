"use client";

// Showing and hiding the side panels (slice 5a; prototype #tLeft, #tRight, main.noleft, main.noright, .mleft, .mright).
// The toolbar's buttons at its two ends hide and show the object browser and the details panel; a hidden panel gives
// its width to the canvas and stays in the page, inert. The layout is a cookie per person (`side-panels-cookie.ts`),
// so the server draws it as it was left. Hiding or showing the left panel moves the canvas's view by its width in the
// same event, so the model stays where it was on the screen (item 6). A selection never opens a hidden details panel;
// the actions that lead to details on purpose call `openDetails` (Q4). Up to 1000 px wide both panels are hidden and a
// button slides one over the canvas, one at a time; that is not remembered.
// Resizing (items 7–11; prototype PANEL, .pgrip): a grip on each panel's inner edge. While it is dragged only a guide
// line moves (a DOM element moved directly, no render); on release the panel takes the width, the canvas resizes once,
// and the left panel's change moves the view as hiding does. Double-click resets, the keyboard as the prototype's.

import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import { useToast } from "@/ui/components/toast";
import {
  DEFAULT_SIDE_PANELS,
  PANEL_LIMITS,
  SIDE_PANELS_COOKIE_MAX_AGE,
  clampWidth,
  formatSidePanelsCookie,
  sidePanelsCookieName,
  type PanelSide,
  type SidePanelsState,
} from "@/ui/side-panels-cookie";

const NARROW = "(max-width: 1000px)";

interface SidePanelsApi {
  state: SidePanelsState;
  /** Up to 1000 px wide (after hydration; the CSS knows it from the first paint). */
  narrow: boolean;
  /** The panel slid over the canvas on a narrow screen. */
  overlay: PanelSide | null;
  toggle: (side: PanelSide) => void;
  /** Shows the details panel, for an action that leads to details on purpose (Q4); it stays shown. */
  openDetails: () => void;
  /** Closes the left overlay on a narrow screen (after an entity or a table was clicked in it). */
  closeLeftOverlay: () => void;
  /** Gives a panel a width (within its limits), remembered; the left panel's change moves the view (item 9). */
  setWidth: (side: PanelSide, width: number) => void;
}

const noop = () => {};
const SidePanelsCtx = createContext<SidePanelsApi>({
  state: DEFAULT_SIDE_PANELS,
  narrow: false,
  overlay: null,
  toggle: noop,
  openDetails: noop,
  closeLeftOverlay: noop,
  setWidth: noop,
});

export const useSidePanels = () => useContext(SidePanelsCtx);

const isNarrow = () => window.matchMedia(NARROW).matches;
function subscribeNarrow(onChange: () => void) {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function writeCookie(name: string, state: SidePanelsState) {
  try {
    document.cookie = `${name}=${formatSidePanelsCookie(state)}; path=/; max-age=${SIDE_PANELS_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    // blocked cookies: the layout is simply not remembered
  }
}

export function SidePanelsProvider({
  userId,
  initial,
  openRight = false,
  children,
}: {
  userId: string;
  /** The layout as the browser's cookie had it when the page was made. */
  initial: SidePanelsState;
  /** The page was opened to show something's details (`?card=`, `?label=`, `?req=`, `?note=`; Q4). */
  openRight?: boolean;
  children: ReactNode;
}) {
  const ui = useContext(CanvasUiCtx);
  const cookie = sidePanelsCookieName(userId);
  const [state, setState] = useState<SidePanelsState>(() => (openRight ? { ...initial, right: true } : initial));
  const stateRef = useRef(state);
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false);
  const [overlayState, setOverlay] = useState<PanelSide | null>(null);
  const overlay = narrow ? overlayState : null;

  const commit = useCallback(
    (next: SidePanelsState) => {
      stateRef.current = next;
      setState(next);
      writeCookie(cookie, next);
    },
    [cookie],
  );

  // Arriving to see something's details: the panel opened on the server stays open (remembered); on a narrow screen
  // it slides in.
  useEffect(() => {
    if (!openRight) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the screen's width is known only in the browser
    if (isNarrow()) setOverlay("right");
    else if (!initial.right) writeCookie(cookie, stateRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  // Crossing 1000 px either way closes an overlay: above it the remembered layout applies, below it both panels start
  // hidden (item 12).
  useEffect(() => subscribeNarrow(() => setOverlay(null)), []);

  const toggle = useCallback(
    (side: PanelSide) => {
      if (isNarrow()) {
        setOverlay((o) => (o === side ? null : side));
        return;
      }
      const s = stateRef.current;
      const next = { ...s, [side]: !s[side] };
      commit(next);
      // the left panel's width goes to or comes from the canvas's left edge: the view follows it (item 6)
      if (side === "left") ui.shiftView(s.left ? s.leftWidth : -s.leftWidth);
    },
    [commit, ui],
  );

  const openDetails = useCallback(() => {
    if (isNarrow()) {
      setOverlay("right");
      return;
    }
    if (!stateRef.current.right) commit({ ...stateRef.current, right: true });
  }, [commit]);

  const closeLeftOverlay = useCallback(() => setOverlay((o) => (o === "left" ? null : o)), []);

  const setWidth = useCallback(
    (side: PanelSide, width: number) => {
      const s = stateRef.current;
      const key = side === "left" ? "leftWidth" : "rightWidth";
      const next = clampWidth(side, width);
      if (next === s[key]) return;
      commit({ ...s, [key]: next });
      // a wider left panel pushes the canvas's left edge right: the view goes back by as much (item 9)
      if (side === "left" && s.left) ui.shiftView(s.leftWidth - next);
    },
    [commit, ui],
  );

  const api = useMemo(
    () => ({ state, narrow, overlay, toggle, openDetails, closeLeftOverlay, setWidth }),
    [state, narrow, overlay, toggle, openDetails, closeLeftOverlay, setWidth],
  );
  return <SidePanelsCtx.Provider value={api}>{children}</SidePanelsCtx.Provider>;
}

/** The three columns: left panel | content | right panel. */
export function SidePanelsGrid({ left, right, children }: { left: ReactNode; right: ReactNode; children: ReactNode }) {
  const { state, narrow, overlay } = useSidePanels();
  // the columns themselves, never CSS variables: a variable here would be inherited by every element of the canvas and
  // restyle all of them on each change (AD-24 rule 4; S5A-08 found 75–140 ms of style recalculation in the dense view)
  const style: CSSProperties = {
    gridTemplateColumns: `${state.left ? state.leftWidth : 0}px minmax(0, 1fr) ${state.right ? state.rightWidth : 0}px`,
  };
  const hidden = (side: PanelSide) => (narrow ? overlay !== side : !state[side]);
  return (
    <div className="im-panels min-h-0 flex-1" style={style} data-testid="side-panels">
      <div className="im-guide" data-testid="panel-guide" aria-hidden />
      <aside
        data-testid="panel-left"
        data-side="left"
        data-shown={state.left}
        data-overlay={overlay === "left"}
        inert={hidden("left")}
        className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-im-line bg-im-panel"
      >
        {/* keyed: the content comes from the server page, next to the grip (React's key check in development) */}
        <Fragment key="content">{left}</Fragment>
        <Grip key="grip" side="left" />
      </aside>
      {children}
      <aside
        data-testid="panel-inspector"
        data-side="right"
        data-shown={state.right}
        data-overlay={overlay === "right"}
        inert={hidden("right")}
        className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-im-line bg-im-panel"
      >
        <Grip key="grip" side="right" />
        <Fragment key="content">{right}</Fragment>
      </aside>
    </div>
  );
}

const KEY_STEP = 16;
const SHIFT_STEP = 64;

/**
 * A panel's grip (prototype #gripL, #gripR): drag to resize, double-click to reset, ←/→ 16 px (Shift 64 px) and Home
 * on the keyboard. → always moves the edge right: it widens the left panel and narrows the right one.
 */
function Grip({ side }: { side: PanelSide }) {
  const { state, setWidth } = useSidePanels();
  const toast = useToast();
  const width = side === "left" ? state.leftWidth : state.rightWidth;
  const limits = PANEL_LIMITS[side];
  const grow = side === "left" ? 1 : -1;
  /** The drag under way: where it started, the width it would give, the grid's width and the guide line. */
  const drag = useRef<{ x0: number; w0: number; w: number; edge: number; guide: HTMLElement | null } | null>(null);

  const moveGuide = (w: number) => {
    const d = drag.current;
    if (!d) return;
    d.w = w;
    // the guide stands where the panel's inner edge will be: the new width in from the grid's own edge
    if (d.guide) d.guide.style.transform = `translateX(${side === "left" ? w : d.edge - w}px)`;
  };
  const endDrag = (el: HTMLElement) => {
    drag.current?.guide?.classList.remove("on");
    drag.current = null;
    el.classList.remove("on");
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "left" ? "Resize the left panel" : "Resize the right panel"}
      aria-valuenow={width}
      aria-valuemin={limits.min}
      aria-valuemax={limits.max}
      tabIndex={0}
      title="Drag to resize; double-click to reset"
      data-testid={side === "left" ? "grip-left" : "grip-right"}
      className="im-grip"
      data-side={side}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // a pointer the browser does not know (the diagnosis drives the grip with synthetic events): no capture
        }
        const grid = e.currentTarget.closest(".im-panels")!;
        const guide = grid.querySelector<HTMLElement>(":scope > .im-guide");
        drag.current = { x0: e.clientX, w0: width, w: width, edge: grid.getBoundingClientRect().width, guide };
        e.currentTarget.classList.add("on");
        moveGuide(width);
        guide?.classList.add("on");
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d) moveGuide(clampWidth(side, d.w0 + grow * (e.clientX - d.x0)));
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        if (!d) return;
        endDrag(e.currentTarget);
        setWidth(side, d.w);
      }}
      onLostPointerCapture={(e) => {
        // a drag cut short (the window lost the pointer): nothing changes
        if (drag.current) endDrag(e.currentTarget);
      }}
      onDoubleClick={() => {
        setWidth(side, limits.def);
        toast(side === "left" ? "Left panel width reset." : "Right panel width reset.");
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? SHIFT_STEP : KEY_STEP;
        if (e.key === "ArrowRight") setWidth(side, width + step * grow);
        else if (e.key === "ArrowLeft") setWidth(side, width - step * grow);
        else if (e.key === "Home") setWidth(side, limits.def);
        else return;
        e.preventDefault();
        e.stopPropagation();
      }}
    />
  );
}

const TITLE: Record<PanelSide, string> = {
  left: "Show or hide the object browser",
  right: "Show or hide the details panel",
};

/** The toolbar's button for one panel (prototype #tLeft, #tRight, with their icons). */
export function PanelToggle({ side }: { side: PanelSide }) {
  const { state, narrow, overlay, toggle } = useSidePanels();
  const shown = narrow ? overlay === side : state[side];
  return (
    <button
      type="button"
      aria-pressed={shown}
      title={TITLE[side]}
      aria-label={TITLE[side]}
      data-testid={side === "left" ? "button-toggle-left" : "button-toggle-right"}
      onClick={() => toggle(side)}
      className="inline-flex h-[30px] flex-none items-center rounded-md px-2 text-im-ink-2 hover:bg-im-hover hover:text-im-ink aria-pressed:text-im-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-im-logical"
    >
      <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden>
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
        <path d={side === "left" ? "M6 2.5v11" : "M10 2.5v11"} />
      </svg>
    </button>
  );
}
