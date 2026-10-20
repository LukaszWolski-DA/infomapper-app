"use client";

// Showing and hiding the side panels (slice 5a; prototype #tLeft, #tRight, main.noleft, main.noright, .mleft, .mright).
// The toolbar's buttons at its two ends hide and show the object browser and the details panel; a hidden panel gives
// its width to the canvas and stays in the page, inert. The layout is a cookie per person (`side-panels-cookie.ts`),
// so the server draws it as it was left. Hiding or showing the left panel moves the canvas's view by its width in the
// same event, so the model stays where it was on the screen (item 6). A selection never opens a hidden details panel;
// the actions that lead to details on purpose call `openDetails` (Q4). Up to 1000 px wide both panels are hidden and a
// button slides one over the canvas, one at a time; that is not remembered.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import {
  DEFAULT_SIDE_PANELS,
  SIDE_PANELS_COOKIE_MAX_AGE,
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
}

const noop = () => {};
const SidePanelsCtx = createContext<SidePanelsApi>({
  state: DEFAULT_SIDE_PANELS,
  narrow: false,
  overlay: null,
  toggle: noop,
  openDetails: noop,
  closeLeftOverlay: noop,
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

  const api = useMemo(
    () => ({ state, narrow, overlay, toggle, openDetails, closeLeftOverlay }),
    [state, narrow, overlay, toggle, openDetails, closeLeftOverlay],
  );
  return <SidePanelsCtx.Provider value={api}>{children}</SidePanelsCtx.Provider>;
}

/** The three columns: left panel | content | right panel. */
export function SidePanelsGrid({ left, right, children }: { left: ReactNode; right: ReactNode; children: ReactNode }) {
  const { state, narrow, overlay } = useSidePanels();
  const style = {
    "--im-lw": `${state.left ? state.leftWidth : 0}px`,
    "--im-rw": `${state.right ? state.rightWidth : 0}px`,
  } as CSSProperties;
  const hidden = (side: PanelSide) => (narrow ? overlay !== side : !state[side]);
  return (
    <div className="im-panels min-h-0 flex-1" style={style} data-testid="side-panels">
      <aside
        data-testid="panel-left"
        data-side="left"
        data-shown={state.left}
        data-overlay={overlay === "left"}
        inert={hidden("left")}
        className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-im-line bg-im-panel"
      >
        {left}
      </aside>
      {children}
      <aside
        data-testid="panel-inspector"
        data-side="right"
        data-shown={state.right}
        data-overlay={overlay === "right"}
        inert={hidden("right")}
        className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-im-line bg-im-panel"
      >
        {right}
      </aside>
    </div>
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
