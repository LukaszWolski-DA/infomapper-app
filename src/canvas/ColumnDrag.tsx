"use client";

// Mapping by drag (slice 1b, D-48; prototype "connect"): press on a source column row and move more than 5 px, and a
// line follows the mouse from the row; entity rows and cards under the mouse light up as drop targets. Dropping on an
// attribute row or elsewhere on an entity card reports a ColumnDrop; the panels decide what happens. Esc cancels.
// Near the canvas edge the view scrolls by itself (prototype autoPan), so a distant attribute can be reached.
// The drop target is found with elementFromPoint and marked with a class, so the cards do not re-render while dragging.
// Slice 15c (B-6, C4, C5): a drag starts from an entity's attribute row too when the page allows it (`host.rowDrag`: a
// module's mapping, InfoCube's logical → dimensional, in either direction), and the page says what each target does
// (`RowDrag.plan`): only a target that maps is marked; a refusal is shown on the release. While a drag lasts the cards
// that can take it stay lit under the fading veil (X3: one SVG path in the overlay, no card restyled); the fading asked
// for before (Focus, the Changes view) comes back after it. The line under the mouse is a value store (`draftStore`), not the canvas's state:
// a drag re-renders only the line (`DraftLines`), never `ModelCanvas` (S15-18: a re-render per move cost about 60 ms
// on "Performance test – star"). The crosshair is the dragged row's alone, with the pointer captured on it: before, a
// class on `body` (`connecting`) restyled every row of the canvas at the drag's start and end (about 35 ms there).

import { memo, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { EdgeLabelRenderer, useReactFlow, useStore, useStoreApi } from "@xyflow/react";
import type { CardNodeT } from "./CardNode";
import type { ColumnDrop, RowDrag, RowDragFrom, RowDrop, RowDropTarget } from "./context";
import { currentFade, requestFade, type FadeRequest } from "./fade";
import { cardWidth, edgePush, LOD_ZOOM, rowEnd, type Pt } from "./geometry";
import { createValueStore, useValue, type ValueStore } from "./value-store";

/** How far the mouse must move before a press on a row becomes a drag (prototype: 5 px). */
const DRAG_START = 5;

/** A drag in progress: the row's card and row, and the mouse in canvas coordinates. */
export interface RowDraft {
  cardId: string;
  rowId: string;
  cur: Pt;
}

type Drop = { target: RowDropTarget; el: Element };

/** What is under the mouse: an attribute row, another part of an entity card (header, empty card), a column's row. */
function findDrop(el: Element | null, entityOf: (cardId: string) => string | null): Drop | null {
  const card = el?.closest<HTMLElement>(".card[data-card]");
  if (!el || !card) return null;
  const row = el.closest<HTMLElement>(".row[data-row]");
  if (card.classList.contains("src")) return row && card.contains(row) ? { target: { columnId: row.dataset.row! }, el: row } : null;
  if (!card.classList.contains("ent")) return null;
  if (row && card.contains(row)) return { target: { attributeId: row.dataset.row! }, el: row };
  const entityId = entityOf(card.dataset.card!);
  return entityId ? { target: { entityId }, el: card } : null;
}

/** The fading key of a drag's veil: one per drag start. */
const veilKey = (from: RowDragFrom) => `drag:${"columnId" in from ? from.columnId : from.attributeId}`;

export function useColumnDrag(
  editable: boolean,
  onDrop: (drop: ColumnDrop) => void,
  /** Slice 15c: the page's say on a drag, an entity row's drop, and a refusal's text on the release. */
  rows: { drag: (from: RowDragFrom) => RowDrag | null; drop: (drop: RowDrop) => void; refuse: (text: string) => void; start?: () => void },
) {
  const rf = useReactFlow();
  const storeApi = useStoreApi();
  const lod = useStore((s) => s.transform[2] < LOD_ZOOM);
  const [draftStore] = useState(() => createValueStore<RowDraft | null>(null));
  const setDraft = draftStore.set;
  const press = useRef<{ cardId: string; from: RowDragFrom; drag: RowDrag; sx: number; sy: number; dragging: boolean; before: FadeRequest; row: HTMLElement; pointerId: number } | null>(null);
  const drop = useRef<(Drop & { verdict: ReturnType<RowDrag["plan"]> }) | null>(null);
  /** The mouse on the screen, and the running auto-scroll frame. */
  const last = useRef<Pt>({ x: 0, y: 0 });
  const scrolling = useRef<number | null>(null);
  const latest = useRef(rows);
  useEffect(() => {
    latest.current = rows;
  });

  const entityOf = useCallback((cardId: string) => {
    const card = (rf.getNode(cardId) as CardNodeT | undefined)?.data.card;
    return card?.kind === "ent" ? card.targetId : null;
  }, [rf]);

  /** The target under the mouse with what a drop there does; only a target that maps is marked. */
  const mark = (next: Drop | null, drag: RowDrag) => {
    const verdict = next ? drag.plan(next.target) : "none";
    const el = verdict === "ok" ? next!.el : null;
    if (drop.current?.el !== el || drop.current?.verdict !== "ok") drop.current?.el.classList.remove("drop");
    el?.classList.add("drop");
    drop.current = next ? { ...next, verdict } : null;
  };

  const end = useCallback(() => {
    if (scrolling.current !== null) cancelAnimationFrame(scrolling.current);
    scrolling.current = null;
    const p = press.current;
    // the veil goes; the fading asked for before the drag comes back (Focus, the Changes view)
    const now = currentFade();
    if (p?.dragging && p.drag.lit && now && "lit" in now && now.key === veilKey(p.from)) requestFade(p.before);
    press.current = null;
    drop.current?.el.classList.remove("drop");
    drop.current = null;
    if (p?.dragging) {
      p.row.classList.remove("drag-from");
      try {
        if (p.row.hasPointerCapture(p.pointerId)) p.row.releasePointerCapture(p.pointerId);
      } catch {
        // the pointer is gone already
      }
    }
    setDraft(null);
  }, [setDraft]);

  useEffect(() => {
    /** The line and the drop target for the mouse where it is now. */
    const follow = (p: NonNullable<typeof press.current>) => {
      const { x, y } = last.current;
      mark(findDrop(document.elementFromPoint(x, y), entityOf), p.drag);
      setDraft({ cardId: p.cardId, rowId: "columnId" in p.from ? p.from.columnId : p.from.attributeId, cur: rf.screenToFlowPosition({ x, y }) });
    };
    const scroll = () => {
      scrolling.current = null;
      const p = press.current, box = storeApi.getState().domNode?.getBoundingClientRect();
      if (!p?.dragging || !box) return;
      const push = edgePush(last.current, box);
      if (!push.x && !push.y) return;
      const { x, y, zoom } = rf.getViewport();
      void rf.setViewport({ x: x + push.x, y: y + push.y, zoom });
      follow(p);
      scrolling.current = requestAnimationFrame(scroll);
    };
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      last.current = { x: e.clientX, y: e.clientY };
      if (!p.dragging) {
        if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) <= DRAG_START) return;
        p.dragging = true;
        // the crosshair on the dragged row only, where the captured pointer takes its cursor from
        p.row.classList.add("drag-from");
        try {
          p.row.setPointerCapture(p.pointerId);
        } catch {
          // no such active pointer (an event made by a script): the crosshair shows over the row only
        }
        latest.current.start?.();
        // the veil (X3): the cards that can take the drop stay lit
        if (p.drag.lit) {
          p.before = currentFade();
          const lit = p.drag.lit;
          requestFade({ lit: { entities: new Set(lit.entities), tables: new Set(lit.tables), rows: new Map(), mappings: new Set(), relationships: new Set() }, key: veilKey(p.from) });
        }
      }
      follow(p);
      if (scrolling.current === null) scrolling.current = requestAnimationFrame(scroll);
    };
    const up = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      const target = drop.current?.target;
      const verdict = drop.current?.verdict ?? "none";
      const dragged = p.dragging;
      end();
      if (!dragged) return; // a click: the card selects the row as before
      // The release is not a click on what lies under it (the pane would clear the selection).
      const swallow = (c: MouseEvent) => c.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      if (!target || verdict === "none") return;
      if (typeof verdict === "object") {
        latest.current.refuse(verdict.refuse);
        return;
      }
      const at = { x: e.clientX, y: e.clientY };
      if ("columnId" in p.from) {
        if (!("columnId" in target)) onDrop({ columnId: p.from.columnId, target, at });
      } else latest.current.drop({ attributeId: p.from.attributeId, target, at });
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
  }, [rf, storeApi, entityOf, onDrop, end, setDraft]);

  /** On the canvas wrapper: a left press on a source column's row, or an entity row the page allows, may start a drag. */
  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!editable || lod || e.button !== 0) return;
      const row = (e.target as HTMLElement).closest<HTMLElement>(".card.src .row[data-row], .card.ent .row[data-row]");
      const card = row?.closest<HTMLElement>("[data-card]");
      const cardId = card?.dataset.card;
      if (!row || !card || !cardId) return;
      const from: RowDragFrom = card.classList.contains("src") ? { columnId: row.dataset.row! } : { attributeId: row.dataset.row! };
      const drag = latest.current.drag(from);
      if (!drag) return;
      e.preventDefault(); // no text selection while dragging
      press.current = { cardId, from, drag, sx: e.clientX, sy: e.clientY, dragging: false, before: null, row, pointerId: e.pointerId };
    },
    [editable, lod],
  );

  return { draftStore, onPointerDown };
}

/** The drag's line, from its store: only this re-renders while the mouse moves. */
export const DraftLines = memo(function DraftLines({ store }: { store: ValueStore<RowDraft | null> }) {
  const draft = useValue(store);
  return draft ? <DraftLine draft={draft} /> : null;
});

/** The line from the dragged row to the mouse, leaving the card on the side the mouse is on. */
export const DraftLine = memo(function DraftLine({ draft }: { draft: RowDraft }) {
  const node = useStore((s) => s.nodeLookup.get(draft.cardId));
  if (!node) return null;
  const card = (node as unknown as CardNodeT).data.card;
  const { x, y } = node.internals.positionAbsolute;
  const end = rowEnd({ x, y, card }, draft.rowId);
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
