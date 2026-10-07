"use client";

// What a selection of several cards can do (slice 2a; prototype startGroupDrag, nudge, arrange, fitWidths,
// multi-feed, multi-remove): drag the group, nudge it with the arrow keys, align, stack, line up, fit widths, bring in
// the feeding sources of the selected entities and take the group off the canvas. Each is one change group, so one
// undo puts everything back. The cards change on screen at once; a refusal puts them back with the domain's message.

import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { useReactFlow, type NodeChange } from "@xyflow/react";
import { useToast } from "@/ui/components/toast";
import { ARRANGED, arrange, type ArrangeMode } from "./arrange";
import type { CardData } from "./card-data";
import type { CardNodeT } from "./CardNode";
import type { CardTarget, UndoHooks } from "./context";
import { besideSpots, CARD_W, cardHeight, cardWidth, inside, newCardHeight, type Pt, type Rect } from "./geometry";
import type { Selection } from "./line-data";
import { cardKey } from "./selection";
import { fitWidth as fitWidthOf } from "./text-fit";

/** What a canvas write returns: the value, or the domain's message for a toast. */
type WriteResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface CardPosition {
  canvasItemId: string;
  expectedVersion: number;
  x: number;
  y: number;
}
type Versions = { versions: Record<string, number> };

export interface GroupWrites {
  /** A group drag or nudges, in one change. */
  moveCards: (items: CardPosition[]) => Promise<WriteResult<Versions>>;
  /** Align, stack or line up, in one change (positions on the 8 px grid). */
  arrangeCards: (items: CardPosition[]) => Promise<WriteResult<Versions>>;
  setCardWidths: (items: { canvasItemId: string; expectedVersion: number; width: number | null }[]) => Promise<WriteResult<Versions>>;
  removeCards: (items: { canvasItemId: string; expectedVersion: number }[]) => Promise<WriteResult<unknown>>;
  placeCards: (cards: (CardTarget & { x: number; y: number })[]) => Promise<WriteResult<{ canvasItemIds: string[] }>>;
}

/** Arrow keys move the selection this far, with Shift further (prototype nudge). */
export const NUDGE = { step: 8, big: 32 } as const;
/** The nudges are saved together once the keys have been still this long. */
const NUDGE_SAVE_MS = 400;
const FAILED = { ok: false as const, message: "Something went wrong. Nothing was saved." };

interface Options extends GroupWrites {
  editable: boolean;
  selection: Selection;
  select: (sel: Selection) => void;
  setNodes: Dispatch<SetStateAction<CardNodeT[]>>;
  patchCard: (id: string, patch: Partial<Pick<CardData, "x" | "y" | "width">>) => void;
  /** Runs a write after every write still on its way for these cards, and counts it as pending for them. */
  enqueueGroup: (ids: readonly string[], write: () => Promise<void>) => void;
  versions: MutableRefObject<Map<string, number>>;
  pending: MutableRefObject<Map<string, number>>;
  occupied: () => Rect[];
  viewRect: () => Rect;
  undo: () => UndoHooks | null;
}

const rectOf = (n: CardNodeT): Rect => ({ x: n.position.x, y: n.position.y, w: cardWidth(n.data.card), h: cardHeight(n.data.card) });

export function useGroupActions(o: Options) {
  const rf = useReactFlow();
  const toast = useToast();
  const { editable, selection, select, setNodes, patchCard, enqueueGroup, versions, pending, undo, occupied, viewRect } = o;
  const { moveCards, arrangeCards, setCardWidths, removeCards, placeCards } = o;

  /** The selected cards on this canvas: several, or the one selected card. */
  const selectedNodes = useCallback((): CardNodeT[] => {
    const nodes = rf.getNodes() as CardNodeT[];
    if (selection?.t === "multi") {
      const keys = new Set(selection.keys);
      return nodes.filter((n) => keys.has(cardKey(n.data.card)));
    }
    if (selection?.t === "card") return nodes.filter((n) => n.id === selection.id);
    return [];
  }, [rf, selection]);

  /** New positions on screen at once, saved in one change; a refusal puts the cards back. */
  const savePositions = useCallback(
    (moves: { id: string; to: Pt; from: Pt }[], send: GroupWrites["moveCards"], saved?: () => void) => {
      if (!moves.length) return;
      for (const m of moves) patchCard(m.id, m.to);
      enqueueGroup(
        moves.map((m) => m.id),
        async () => {
          let result: WriteResult<Versions>;
          try {
            result = await send(moves.map((m) => ({ canvasItemId: m.id, expectedVersion: versions.current.get(m.id) ?? 1, ...m.to })));
          } catch {
            result = FAILED;
          }
          if (result.ok) {
            for (const [id, v] of Object.entries(result.value.versions)) versions.current.set(id, v);
            undo()?.noteSaved();
            saved?.();
          } else {
            for (const m of moves) patchCard(m.id, m.from);
            toast(result.message, "refusal");
          }
        },
      );
    },
    [patchCard, enqueueGroup, versions, undo, toast],
  );

  // ---- group drag: the dragged card leads, the others follow by the same amount (snapped as a whole) ----
  const drag = useRef<{ lead: string; start: Map<string, Pt> } | null>(null);

  const onNodeDragStart = useCallback(
    (node: CardNodeT) => {
      drag.current = null;
      if (!editable || selection?.t !== "multi" || !selection.keys.includes(cardKey(node.data.card))) return;
      drag.current = { lead: node.id, start: new Map(selectedNodes().map((n) => [n.id, { ...n.position }])) };
    },
    [editable, selection, selectedNodes],
  );

  /** React Flow moves the lead; the same change moves the rest of the group, in one update per frame. */
  const withGroup = useCallback((changes: NodeChange<CardNodeT>[]): NodeChange<CardNodeT>[] => {
    const g = drag.current;
    if (!g) return changes;
    const lead = changes.find((c) => c.type === "position" && c.id === g.lead && c.position);
    if (!lead || lead.type !== "position" || !lead.position) return changes;
    const s0 = g.start.get(g.lead)!;
    const dx = lead.position.x - s0.x, dy = lead.position.y - s0.y;
    const rest: NodeChange<CardNodeT>[] = [];
    for (const [id, s] of g.start) if (id !== g.lead) rest.push({ type: "position", id, position: { x: s.x + dx, y: s.y + dy }, dragging: lead.dragging });
    return [...changes, ...rest];
  }, []);

  /** The drag ends: one change for the whole group. Returns false when it was not a group drag. */
  const onGroupDragStop = useCallback((): boolean => {
    const g = drag.current;
    drag.current = null;
    if (!g) return false;
    const moves = [...g.start]
      .map(([id, from]) => {
        const n = rf.getNode(id);
        return { id, from, to: n ? { x: Math.round(n.position.x), y: Math.round(n.position.y) } : from };
      })
      .filter((m) => m.to.x !== m.from.x || m.to.y !== m.from.y);
    if (!moves.length) return true;
    // The release is not a click on the lead card (that would select only it).
    const swallow = (c: MouseEvent) => c.stopPropagation();
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
    savePositions(moves, moveCards);
    return true;
  }, [rf, savePositions, moveCards]);

  // ---- nudge: the cards move at once, the moves are saved together after the keys are still ----
  const nudging = useRef<{ from: Map<string, Pt>; at: Map<string, Pt>; timer: ReturnType<typeof setTimeout> | null } | null>(null);

  const flushNudge = useCallback(() => {
    const n = nudging.current;
    nudging.current = null;
    if (!n) return;
    for (const id of n.from.keys()) pending.current.set(id, (pending.current.get(id) ?? 1) - 1);
    const moves = [...n.from].map(([id, from]) => ({ id, from, to: n.at.get(id)! })).filter((m) => m.to.x !== m.from.x || m.to.y !== m.from.y);
    savePositions(moves, moveCards);
  }, [pending, savePositions, moveCards]);

  const nudge = useCallback(
    (dx: number, dy: number): boolean => {
      if (!editable) return false;
      const nodes = selectedNodes();
      if (!nodes.length) return false;
      const n = (nudging.current ??= { from: new Map(), at: new Map(), timer: null });
      for (const node of nodes) {
        if (!n.from.has(node.id)) {
          n.from.set(node.id, { ...node.position });
          n.at.set(node.id, { ...node.position });
          // a fresh page from the server must not put it back before it is saved
          pending.current.set(node.id, (pending.current.get(node.id) ?? 0) + 1);
        }
        const p = n.at.get(node.id)!;
        const to = { x: p.x + dx, y: p.y + dy };
        n.at.set(node.id, to);
        patchCard(node.id, to);
      }
      if (n.timer) clearTimeout(n.timer);
      n.timer = setTimeout(flushNudge, NUDGE_SAVE_MS);
      return true;
    },
    [editable, selectedNodes, pending, patchCard, flushNudge],
  );

  // Leaving the canvas saves what was nudged at once.
  const flushRef = useRef(flushNudge);
  useEffect(() => {
    flushRef.current = flushNudge;
  }, [flushNudge]);
  useEffect(
    () => () => {
      if (nudging.current?.timer) clearTimeout(nudging.current.timer);
      flushRef.current();
    },
    [],
  );

  // ---- the group's actions (toolbox and selection panel) ----
  const arrangeSelection = useCallback(
    (mode: ArrangeMode) => {
      const nodes = selectedNodes();
      if (!editable || nodes.length < 2) return;
      const to = arrange(mode, nodes.map((n) => ({ id: n.id, rect: rectOf(n) })));
      const moves = nodes
        .map((n) => ({ id: n.id, from: { ...n.position }, to: to.get(n.id)! }))
        .filter((m) => m.to.x !== m.from.x || m.to.y !== m.from.y);
      if (!moves.length) {
        toast(ARRANGED[mode]);
        return;
      }
      savePositions(moves, arrangeCards, () => toast(ARRANGED[mode]));
    },
    [editable, selectedNodes, savePositions, arrangeCards, toast],
  );

  const fitSelectionWidths = useCallback(() => {
    const nodes = selectedNodes();
    if (!editable || !nodes.length) return;
    const changes = nodes
      .map((n) => {
        const card = n.data.card;
        const width = fitWidthOf({ kind: card.kind, name: card.name, coverage: `${card.mapped}/${card.rows.length}`, rows: card.rows });
        return { id: n.id, from: card.width, to: width };
      })
      .filter((c) => c.to !== c.from);
    const done = () => toast(nodes.length > 1 ? `Fitted ${nodes.length} cards to their names.` : "Fitted the card to its names.");
    if (!changes.length) {
      done();
      return;
    }
    for (const c of changes) patchCard(c.id, { width: c.to });
    enqueueGroup(
      changes.map((c) => c.id),
      async () => {
        let result: WriteResult<Versions>;
        try {
          result = await setCardWidths(changes.map((c) => ({ canvasItemId: c.id, expectedVersion: versions.current.get(c.id) ?? 1, width: c.to })));
        } catch {
          result = FAILED;
        }
        if (result.ok) {
          for (const [id, v] of Object.entries(result.value.versions)) versions.current.set(id, v);
          undo()?.noteSaved();
          done();
        } else {
          for (const c of changes) patchCard(c.id, { width: c.from });
          toast(result.message, "refusal");
        }
      },
    );
  }, [editable, selectedNodes, patchCard, enqueueGroup, setCardWidths, versions, undo, toast]);

  const removeSelection = useCallback(() => {
    const nodes = selectedNodes();
    if (!editable || !nodes.length) return;
    const ids = nodes.map((n) => n.id);
    enqueueGroup(ids, async () => {
      let result: WriteResult<unknown>;
      try {
        result = await removeCards(ids.map((id) => ({ canvasItemId: id, expectedVersion: versions.current.get(id) ?? 1 })));
      } catch {
        result = FAILED;
      }
      if (!result.ok) {
        toast(result.message, "refusal");
        return;
      }
      setNodes((ns) => ns.filter((n) => !ids.includes(n.id)));
      select(null);
      const u = undo();
      const n = ids.length;
      toast(
        `Removed ${n} card${n === 1 ? "" : "s"} from this canvas. They stay in the model with their mappings.`,
        "info",
        u ? { label: "Undo", run: u.undo } : undefined,
      );
    });
  }, [editable, selectedNodes, enqueueGroup, removeCards, versions, setNodes, select, undo, toast]);

  /**
   * “Add sources of selected entities” (PRD item 9): each entity's missing feeding source tables go beside its own card,
   * left of it, by the slice 1b rules, avoiding every card already here and those placed for another selected entity.
   * A table feeding several selected entities is placed once, beside the first (top to bottom). One change.
   */
  const placeSourcesOfSelection = useCallback(
    async (sourcesOf: (entityId: string) => { sourceTableId: string; rows: number }[]) => {
      if (!editable) return;
      const entities = selectedNodes()
        .filter((n) => n.data.card.kind === "ent")
        .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
      if (!entities.length) return;
      const here = new Set((rf.getNodes() as CardNodeT[]).filter((n) => n.data.card.kind === "src").map((n) => n.data.card.targetId));
      const taken = occupied();
      const placed: (CardTarget & { x: number; y: number })[] = [];
      const boxes: Rect[] = [];
      for (const anchor of entities) {
        const wanted = sourcesOf(anchor.data.card.targetId).filter((s) => !here.has(s.sourceTableId));
        if (!wanted.length) continue;
        const heights = wanted.map((w) => newCardHeight(w.rows));
        const spots = besideSpots(rectOf(anchor), "left", heights, taken);
        wanted.forEach((w, i) => {
          here.add(w.sourceTableId);
          const box = { ...spots[i]!, w: CARD_W, h: heights[i]! };
          taken.push(box);
          boxes.push(box);
          placed.push({ sourceTableId: w.sourceTableId, ...spots[i]! });
        });
      }
      if (!placed.length) {
        toast("Everything is already on this canvas.");
        return;
      }
      let result: WriteResult<{ canvasItemIds: string[] }>;
      try {
        result = await placeCards(placed);
      } catch {
        result = FAILED;
      }
      if (!result.ok) {
        toast(result.message, "refusal");
        return;
      }
      // Bring the new cards into view if they landed outside it.
      if (boxes.some((r) => !inside(viewRect(), r))) {
        const all = [...entities.map(rectOf), ...boxes];
        const x0 = Math.min(...all.map((r) => r.x)), y0 = Math.min(...all.map((r) => r.y));
        const x1 = Math.max(...all.map((r) => r.x + r.w)), y1 = Math.max(...all.map((r) => r.y + r.h));
        void rf.fitBounds({ x: x0 - 40, y: y0 - 40, width: x1 - x0 + 80, height: y1 - y0 + 80 }, { duration: 250, padding: 0 });
      }
      const n = placed.length;
      toast(`Added ${n} source table${n === 1 ? "" : "s"} next to the selection.`);
    },
    [editable, selectedNodes, rf, occupied, viewRect, placeCards, toast],
  );

  const placeSources = useCallback(
    (sourcesOf: (entityId: string) => { sourceTableId: string; rows: number }[]) => void placeSourcesOfSelection(sourcesOf),
    [placeSourcesOfSelection],
  );

  return {
    onNodeDragStart,
    withGroup,
    onGroupDragStop,
    nudge,
    arrangeSelection,
    fitSelectionWidths,
    removeSelection,
    placeSourcesOfSelection: placeSources,
  };
}
