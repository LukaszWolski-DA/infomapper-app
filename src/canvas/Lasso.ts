"use client";

// The lasso (slice 2a, D-15, D-16; prototype D.type "lasso"): a left drag that starts on the empty canvas draws a
// rectangle; on release the canvas selects the cards fully inside it. A press without moving is left to the pane's
// click (it clears the selection, as before). Esc cancels a lasso being drawn. The caller decides when a press may
// start one (no tool on, Space not held).

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useReactFlow } from "@xyflow/react";
import type { Pt, Rect } from "./geometry";
import { rectBetween } from "./selection";

/** Moving less than this is a click on the empty canvas, not a lasso. */
const SLOP = 4;

interface Press {
  sx: number;
  sy: number;
  start: Pt;
  add: boolean;
  moved: boolean;
}

/** A press on the empty canvas: the pane itself, not a card, a line, the Overview or a control. */
export const onEmptyCanvas = (target: EventTarget | null): boolean =>
  target instanceof Element && target.classList.contains("react-flow__pane");

export function useLasso(onDone: (lasso: Rect, add: boolean) => void) {
  const rf = useReactFlow();
  const [lasso, setLasso] = useState<Rect | null>(null);
  const press = useRef<Press | null>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0 || !onEmptyCanvas(e.target)) return;
      press.current = { sx: e.clientX, sy: e.clientY, start: rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }), add: e.shiftKey, moved: false };
    },
    [rf],
  );

  useEffect(() => {
    const end = () => {
      press.current = null;
      setLasso(null);
    };
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) <= SLOP) return;
      p.moved = true;
      setLasso(rectBetween(p.start, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })));
    };
    const up = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      end();
      if (!p.moved) return;
      // The release is not a click on the empty canvas (that would clear the new selection).
      const swallow = (c: MouseEvent) => c.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      onDone(rectBetween(p.start, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })), p.add);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && press.current) {
        e.stopPropagation();
        end();
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", key, true);
    };
  }, [rf, onDone]);

  return { lasso, onPointerDown };
}
