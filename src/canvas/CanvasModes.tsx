"use client";

// Canvas tools and the toolbox gesture (slice 1b; prototype setTool, V.relate, ctxFor):
// - Entity tool (E, D-46): the next click on the canvas creates an entity there; Esc cancels.
// - Relate (the button on an entity card, or “Draw a relationship from here”): a line follows the mouse from the card;
//   the next click on another entity creates the relationship, a click elsewhere ends it. Dragging from the button
//   and releasing over an entity does the same.
// - A right-click without moving opens the toolbox for what is under the mouse, after selecting it (D-19); a right-drag
//   still pans (React Flow). On the header or body of a card of a selection of several it opens the group's toolbox
//   (slice 2a); on a row, that row's own toolbox (D-52).
// - Hand tool (H, slice 2a, D-18): a left drag anywhere, over cards too, pans the canvas and selects nothing; V or Esc
//   end it. Right drag, the middle button and Space still pan as before. It is not saved.
// - Frame tool (A, slice 2b): its presses are the canvas's (`useFrames`); here only on and off. A right-click on a
//   frame's name, handle or an empty spot inside it opens the frame's toolbox; on a card or line inside a frame, theirs.
// The page does the writes and draws the toolbox (CanvasHost); this file only reads gestures.

import { memo, useCallback, useContext, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { EdgeLabelRenderer, useReactFlow, useStore } from "@xyflow/react";
import { useToast } from "@/ui/components/toast";
import type { CardNodeT } from "./CardNode";
import { CanvasUiCtx, type ToolboxTarget } from "./context";
import { cardKey } from "./selection";
import { cardWidth, HEAD_H, type Pt } from "./geometry";

/** A right-click that moved more than this is a pan, not a toolbox. */
const CLICK_SLOP = 5;
/** Where a new entity's card goes relative to the click (prototype: x − 24, y − 20). */
const NEW_ENTITY_OFFSET = { x: 24, y: 20 };

export const ENTITY_TOOL_HINT = "Click on the canvas where the new entity should go. Esc cancels.";
export const HAND_TOOL_HINT = "Hand tool: drag anywhere to move the canvas. V or Esc returns to selecting.";
export const FRAME_TOOL_HINT = "Drag on the canvas to draw a frame. Esc cancels.";
export const RELATE_HINT = "Now click the entity to relate to. Esc cancels.";

const entityCardAt = (el: Element | null) => el?.closest<HTMLElement>(".card.ent[data-card]")?.dataset.card ?? null;

export function useCanvasModes(editable: boolean) {
  const ui = useContext(CanvasUiCtx);
  const { mode, setMode, select } = ui;
  const rf = useReactFlow();
  const toast = useToast();
  const [cursor, setCursor] = useState<Pt | null>(null);
  const rightDown = useRef<Pt | null>(null);
  /** A press on a relate button: becomes a relate drag after a few pixels. */
  const relatePress = useRef<{ cardId: string; sx: number; sy: number; dragging: boolean } | null>(null);
  /** A left drag with the Hand tool: where it started, on the screen and in the view. */
  const handPan = useRef<{ sx: number; sy: number; x: number; y: number; zoom: number } | null>(null);
  const [panning, setPanning] = useState(false);

  const startRelate = useCallback(
    (cardId: string) => {
      if (!editable) return;
      setMode({ kind: "relate", fromCardId: cardId });
      toast(RELATE_HINT);
    },
    [editable, setMode, toast],
  );

  const toggleEntityTool = useCallback(() => {
    if (!editable) return;
    if (mode?.kind === "entity") setMode(null);
    else {
      setMode({ kind: "entity" });
      toast(ENTITY_TOOL_HINT);
    }
  }, [editable, mode, setMode, toast]);

  /** A, the toolbar button: the Frame tool on or off (editors only). */
  const toggleFrameTool = useCallback(() => {
    if (!editable) return;
    if (mode?.kind === "frame") setMode(null);
    else {
      setMode({ kind: "frame" });
      toast(FRAME_TOOL_HINT);
    }
  }, [editable, mode, setMode, toast]);

  /** H, the toolbar button and the toolbox: the Hand tool on or off (for every role; it only moves the view). */
  const toggleHandTool = useCallback(() => {
    if (mode?.kind === "hand") setMode(null);
    else {
      setMode({ kind: "hand" });
      toast(HAND_TOOL_HINT);
    }
  }, [mode, setMode, toast]);

  // The Hand tool's drag moves the view with the mouse; the release is not a click on what lies under it.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = handPan.current;
      if (p) void rf.setViewport({ x: p.x + e.clientX - p.sx, y: p.y + e.clientY - p.sy, zoom: p.zoom });
    };
    const up = () => {
      if (!handPan.current) return;
      handPan.current = null;
      setPanning(false);
      const swallow = (c: MouseEvent) => c.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [rf]);

  // Leaving relate mode clears its line.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the line belongs to relate mode
    if (mode?.kind !== "relate") setCursor(null);
  }, [mode]);

  // The line follows the mouse; a relate drag from the button ends where the mouse is released.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = relatePress.current;
      if (p && !p.dragging && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > CLICK_SLOP) {
        p.dragging = true;
        setMode({ kind: "relate", fromCardId: p.cardId });
      }
      if (mode?.kind === "relate" || p?.dragging) setCursor(rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    };
    const up = (e: PointerEvent) => {
      const p = relatePress.current;
      relatePress.current = null;
      if (!p?.dragging) return;
      // The release is not a click on what lies under it.
      const swallow = (c: MouseEvent) => c.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      setMode(null);
      const to = entityCardAt(document.elementFromPoint(e.clientX, e.clientY));
      if (to) ui.host()?.relate(p.cardId, to);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [mode, rf, setMode, ui]);

  /** Capture phase on the canvas: tools take the next click before cards and the pane see it. */
  const onPointerDownCapture = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button === 2) {
        rightDown.current = { x: e.clientX, y: e.clientY };
        return;
      }
      if (e.button !== 0) return;
      const relateButton = (e.target as HTMLElement).closest<HTMLElement>("[data-relate]");
      if (relateButton && !mode && editable) {
        relatePress.current = { cardId: relateButton.dataset.relate!, sx: e.clientX, sy: e.clientY, dragging: false };
        return;
      }
      if (!mode || mode.kind === "frame") return;
      if ((e.target as HTMLElement).closest(".overview, .react-flow__panel")) return;
      e.preventDefault();
      e.stopPropagation();
      if (mode.kind === "hand") {
        // Before the cards and the pane see it: nothing is dragged or selected.
        const { x, y, zoom } = rf.getViewport();
        handPan.current = { sx: e.clientX, sy: e.clientY, x, y, zoom };
        setPanning(true);
        return;
      }
      const swallow = (c: MouseEvent) => c.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 300);
      setMode(null);
      if (mode.kind === "entity") {
        const at = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        ui.host()?.createEntityAt({ x: at.x - NEW_ENTITY_OFFSET.x, y: at.y - NEW_ENTITY_OFFSET.y });
      } else {
        const to = entityCardAt(e.target as Element);
        if (to) ui.host()?.relate(mode.fromCardId, to);
      }
    },
    [mode, editable, rf, setMode, ui],
  );

  /** A card that is part of a selection of several. */
  const inSelection = useCallback(
    (cardId: string) => {
      const sel = ui.selection;
      const card = (rf.getNode(cardId) as CardNodeT | undefined)?.data.card;
      return sel?.t === "multi" && !!card && sel.keys.includes(cardKey(card));
    },
    [ui.selection, rf],
  );

  /** A right-click without moving: select what is under the mouse, then ask the page for its toolbox. */
  const onContextMenu = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      const down = rightDown.current;
      rightDown.current = null;
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP) return;
      // A tool that takes the next click ends; the Hand tool stays (its toolbox offers “Back to selecting”).
      if (mode && mode.kind !== "hand") setMode(null);
      const el = e.target as HTMLElement;
      if (el.closest(".overview, .react-flow__panel")) return;
      const mappingId = el.closest<SVGElement>("[data-mapping]")?.dataset.mapping;
      const relationshipId = el.closest<SVGElement>("[data-relationship]")?.dataset.relationship;
      const cardId = el.closest<HTMLElement>("[data-card]")?.dataset.card;
      const rowId = cardId ? el.closest<HTMLElement>(".row[data-row]")?.dataset.row : undefined;
      const frameId = cardId ? undefined : el.closest<HTMLElement>("[data-frame]")?.dataset.frame;
      let target: ToolboxTarget;
      if (mappingId) {
        target = { kind: "map", mappingId };
        select({ t: "map", id: mappingId });
      } else if (relationshipId) {
        target = { kind: "rel", relationshipId };
        select({ t: "rel", id: relationshipId });
      } else if (cardId && rowId) {
        // a row keeps its own toolbox, also on a selected card (D-52 over the prototype's ctxFor)
        target = { kind: "row", cardId, rowId };
        select({ t: "row", cardId, id: rowId });
      } else if (cardId && inSelection(cardId)) {
        // the header or body of a selected card: the group's toolbox
        target = { kind: "selection" };
      } else if (cardId) {
        target = { kind: "card", cardId };
        select({ t: "card", id: cardId });
      } else if (frameId) {
        target = { kind: "frame", frameId };
        select({ t: "frame", id: frameId });
      } else {
        target = { kind: "canvas" };
        select(null);
      }
      ui.host()?.openToolbox({ target, screen: { x: e.clientX, y: e.clientY }, at: rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }) });
    },
    [mode, setMode, select, rf, ui, inSelection],
  );

  const relateFrom = mode?.kind === "relate" ? mode.fromCardId : null;
  return { startRelate, toggleEntityTool, toggleHandTool, toggleFrameTool, panning, onPointerDownCapture, onContextMenu, relateFrom, cursor };
}

/** The line from the card a relationship starts at to the mouse (prototype: from the card's header middle). */
export const RelateLine = memo(function RelateLine({ fromCardId, cursor }: { fromCardId: string; cursor: Pt }) {
  const node = useStore((s) => s.nodeLookup.get(fromCardId));
  if (!node) return null;
  const card = (node as unknown as CardNodeT).data.card;
  const { x, y } = node.internals.positionAbsolute;
  const x0 = x + cardWidth(card) / 2, y0 = y + HEAD_H / 2;
  return (
    <EdgeLabelRenderer>
      <svg className="line-layer draft-layer" width={1} height={1} data-testid="line-relate">
        <path className="tmp" d={`M${x0},${y0} L${cursor.x},${cursor.y}`} />
      </svg>
    </EdgeLabelRenderer>
  );
});
