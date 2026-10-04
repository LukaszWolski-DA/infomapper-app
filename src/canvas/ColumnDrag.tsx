"use client";

// Mapping by drag (slice 1b, D-48; prototype "connect"): press on a source column row and move more than 5 px, and a
// line follows the mouse from the row; entity rows and cards under the mouse light up as drop targets. Dropping on an
// attribute row or elsewhere on an entity card reports a ColumnDrop; the panels decide what happens. Esc cancels.
// The drop target is found with elementFromPoint and marked with a class, so the cards do not re-render while dragging.

import { memo, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { EdgeLabelRenderer, useReactFlow, useStore } from "@xyflow/react";
import type { CardNodeT } from "./CardNode";
import type { ColumnDrop } from "./context";
import { cardWidth, LOD_ZOOM, rowEnd, type Pt } from "./geometry";

/** How far the mouse must move before a press on a row becomes a drag (prototype: 5 px). */
const DRAG_START = 5;

/** A drag in progress: the column's card and row, and the mouse in canvas coordinates. */
export interface ColumnDraft {
  cardId: string;
  columnId: string;
  cur: Pt;
}

type Drop = { target: ColumnDrop["target"]; el: Element };

/** What is under the mouse: an attribute row, or another part of an entity card (header, empty card). */
function findDrop(el: Element | null, entityOf: (cardId: string) => string | null): Drop | null {
  const card = el?.closest<HTMLElement>(".card.ent[data-card]");
  if (!el || !card) return null;
  const row = el.closest<HTMLElement>(".row[data-row]");
  if (row && card.contains(row)) return { target: { attributeId: row.dataset.row! }, el: row };
  const entityId = entityOf(card.dataset.card!);
  return entityId ? { target: { entityId }, el: card } : null;
}

export function useColumnDrag(editable: boolean, onDrop: (drop: ColumnDrop) => void) {
  const rf = useReactFlow();
  const lod = useStore((s) => s.transform[2] < LOD_ZOOM);
  const [draft, setDraft] = useState<ColumnDraft | null>(null);
  const press = useRef<{ cardId: string; columnId: string; sx: number; sy: number; dragging: boolean } | null>(null);
  const drop = useRef<Drop | null>(null);

  const entityOf = useCallback((cardId: string) => {
    const card = (rf.getNode(cardId) as CardNodeT | undefined)?.data.card;
    return card?.kind === "ent" ? card.targetId : null;
  }, [rf]);

  const mark = (next: Drop | null) => {
    if (drop.current?.el !== next?.el) {
      drop.current?.el.classList.remove("drop");
      next?.el.classList.add("drop");
    }
    drop.current = next;
  };

  const end = useCallback(() => {
    press.current = null;
    drop.current?.el.classList.remove("drop");
    drop.current = null;
    document.body.classList.remove("connecting");
    setDraft(null);
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      if (!p.dragging) {
        if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) <= DRAG_START) return;
        p.dragging = true;
        document.body.classList.add("connecting");
      }
      mark(findDrop(document.elementFromPoint(e.clientX, e.clientY), entityOf));
      setDraft({ cardId: p.cardId, columnId: p.columnId, cur: rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }) });
    };
    const up = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      const target = drop.current?.target;
      const dragged = p.dragging;
      end();
      if (!dragged) return; // a click: the card selects the row as before
      // The release is not a click on what lies under it (the pane would clear the selection).
      const swallow = (c: MouseEvent) => c.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      if (target) onDrop({ columnId: p.columnId, target, at: { x: e.clientX, y: e.clientY } });
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && press.current?.dragging) end();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", end);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("keydown", key);
    };
  }, [rf, entityOf, onDrop, end]);

  /** On the canvas wrapper: a left press on a source column row may start a drag. */
  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!editable || lod || e.button !== 0) return;
      const row = (e.target as HTMLElement).closest<HTMLElement>(".card.src .row[data-row]");
      const cardId = row?.closest<HTMLElement>("[data-card]")?.dataset.card;
      if (!row || !cardId) return;
      e.preventDefault(); // no text selection while dragging
      press.current = { cardId, columnId: row.dataset.row!, sx: e.clientX, sy: e.clientY, dragging: false };
    },
    [editable, lod],
  );

  return { draft, onPointerDown };
}

/** The line from the dragged column's row to the mouse, leaving the card on the side the mouse is on. */
export const DraftLine = memo(function DraftLine({ draft }: { draft: ColumnDraft }) {
  const node = useStore((s) => s.nodeLookup.get(draft.cardId));
  if (!node) return null;
  const card = (node as unknown as CardNodeT).data.card;
  const { x, y } = node.internals.positionAbsolute;
  const end = rowEnd({ x, y, card }, draft.columnId);
  const w = cardWidth(card);
  const right = draft.cur.x > x + w / 2;
  const x0 = right ? x + w : x, sn = right ? 1 : -1;
  const k = Math.max(40, Math.abs(draft.cur.x - x0) * 0.45);
  const d = `M${x0},${end.y} C${x0 + sn * k},${end.y} ${draft.cur.x - sn * k},${draft.cur.y} ${draft.cur.x},${draft.cur.y}`;
  return (
    <EdgeLabelRenderer>
      <svg className="line-layer draft-layer" width={1} height={1} data-testid="line-draft">
        <path className="tmp" d={d} />
      </svg>
    </EdgeLabelRenderer>
  );
});
