"use client";

// What a selection of several cards can do (slice 2a; prototype startGroupDrag, nudge, arrange, fitWidths,
// multi-feed, multi-remove): drag the group, nudge it with the arrow keys, align, stack, line up, fit widths, bring in
// the feeding sources of the selected entities and take the group off the canvas. Each is one change group, so one
// undo puts everything back. The cards change on screen at once; a refusal puts them back with the domain's message.
// Slice 2b: moves and widths are saved through `saveLayout`, which also decides the cards' frames (answer 1). Frames in
// the selection stand for their cards (D-17, prototype movingItems): a group drag, a nudge, align, stack and line up move
// each selected frame with its cards and each other selected card on its own, every card once; fit widths, remove and
// “Add sources” act on the selected cards only.

import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { useReactFlow, type NodeChange } from "@xyflow/react";
import { useToast } from "@/ui/components/toast";
import { ARRANGED, arrange, type ArrangeMode } from "./arrange";
import type { CardData } from "./card-data";
import type { FrameData } from "./frame-data";
import type { CardNodeT } from "./CardNode";
import type { CardTarget, UndoHooks } from "./context";
import type { SaveLayoutOptions } from "./useFrames";
import type { LayoutChange } from "./layout-plan";
import { besideSpots, CARD_W, cardHeight, cardWidth, inside, newCardHeight, type Pt, type Rect } from "./geometry";
import type { Selection } from "./line-data";
import { selectedCardIds, selectedKeys, unitsOf, type ItemBox } from "./selection";
import { fitWidth as fitWidthOf } from "./text-fit";

/** What a canvas write returns: the value, or the domain's message for a toast. */
type WriteResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface GroupWrites {
  removeCards: (items: { canvasItemId: string; expectedVersion: number }[]) => Promise<WriteResult<unknown>>;
  placeCards: (cards: (CardTarget & { x: number; y: number; height: number })[]) => Promise<WriteResult<{ canvasItemIds: string[] }>>;
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
  /** Every change of positions and widths (slice 2b): saved in one change, frames decided again. */
  saveLayout: (change: LayoutChange, opts?: SaveLayoutOptions) => void;
  /** The cards and frames of this canvas as the selection sees them (slice 2b). */
  items: () => ItemBox[];
  /** The frames as the canvas shows them now, and a change of where they are shown (not saved). */
  framesNow: () => readonly FrameData[];
  patchFrames: (patch: ReadonlyMap<string, Partial<FrameData>>) => void;
}

type Move = { id: string; from: Pt; to: Pt };
const changedOnly = (list: Move[]) => list.filter((m) => m.to.x !== m.from.x || m.to.y !== m.from.y);

const rectOf = (n: CardNodeT): Rect => ({ x: n.position.x, y: n.position.y, w: cardWidth(n.data.card), h: cardHeight(n.data.card) });

export function useGroupActions(o: Options) {
  const rf = useReactFlow();
  const toast = useToast();
  const { editable, selection, select, setNodes, patchCard, enqueueGroup, versions, pending, undo, occupied, viewRect } = o;
  const { saveLayout, removeCards, placeCards, items, framesNow, patchFrames } = o;

  /** The selected cards themselves on this canvas (not frames): several, or the one selected card. */
  const selectedNodes = useCallback((): CardNodeT[] => {
    const all = items();
    const ids = new Set(selectedCardIds(selectedKeys(selection, all), all));
    return (rf.getNodes() as CardNodeT[]).filter((n) => ids.has(n.id));
  }, [rf, selection, items]);

  /** What the selection moves: selected frames with their cards, and the other selected cards (slice 2b). */
  const moving = useCallback(() => {
    const all = items();
    const u = unitsOf(selectedKeys(selection, all), all);
    const byId = new Map((rf.getNodes() as CardNodeT[]).map((n) => [n.id, n]));
    const frames = new Map(framesNow().map((f) => [f.id, f]));
    return {
      frames: u.frames.map((id) => frames.get(id)).filter((f): f is FrameData => !!f),
      cards: u.cards.map((id) => byId.get(id)).filter((n): n is CardNodeT => !!n),
      members: u.members.map((id) => byId.get(id)).filter((n): n is CardNodeT => !!n),
    };
  }, [items, selection, rf, framesNow]);

  /**
   * New positions on screen at once, saved in one change with the cards' frames; a refusal puts everything back.
   * Frames carry their cards; `carried` holds where every moving card was before (shown moved already).
   */
  const saveMoves = useCallback(
    (moves: { frames: Move[]; cards: Move[]; carried?: ReadonlyMap<string, Pt> }, options: { onGrid?: boolean; ask?: boolean; saved?: () => void } = {}) => {
      if (!moves.frames.length && !moves.cards.length) return;
      saveLayout(
        { frames: moves.frames.map((m) => ({ id: m.id, ...m.to })), cards: moves.cards.map((m) => ({ id: m.id, ...m.to })) },
        {
          ...options,
          from: new Map([...(moves.carried ?? []), ...moves.cards.map((m) => [m.id, m.from] as const)]),
          framesFrom: new Map(moves.frames.map((m) => [m.id, m.from])),
        },
      );
    },
    [saveLayout],
  );

  // ---- group drag: the dragged card leads, the others and the selected frames follow by the same amount ----
  const drag = useRef<{ lead: string; start: Map<string, Pt>; loose: Set<string>; frames: Map<string, Pt>; dx: number; dy: number } | null>(null);

  const onNodeDragStart = useCallback(
    (node: CardNodeT) => {
      drag.current = null;
      const lead = items().find((i) => i.id === node.id);
      if (!editable || selection?.t !== "multi" || !lead || !selection.keys.includes(lead.key)) return;
      const m = moving();
      drag.current = {
        lead: node.id,
        start: new Map([...m.cards, ...m.members].map((n) => [n.id, { ...n.position }])),
        loose: new Set(m.cards.map((n) => n.id)),
        frames: new Map(m.frames.map((f) => [f.id, { x: f.x, y: f.y }])),
        dx: 0,
        dy: 0,
      };
    },
    [editable, selection, items, moving],
  );

  /** React Flow moves the lead; the same change moves the rest of the group (and its frames), in one update per frame. */
  const withGroup = useCallback(
    (changes: NodeChange<CardNodeT>[]): NodeChange<CardNodeT>[] => {
      const g = drag.current;
      if (!g) return changes;
      const lead = changes.find((c) => c.type === "position" && c.id === g.lead && c.position);
      if (!lead || lead.type !== "position" || !lead.position) return changes;
      const s0 = g.start.get(g.lead)!;
      const dx = lead.position.x - s0.x, dy = lead.position.y - s0.y;
      const rest: NodeChange<CardNodeT>[] = [];
      for (const [id, s] of g.start) if (id !== g.lead) rest.push({ type: "position", id, position: { x: s.x + dx, y: s.y + dy }, dragging: lead.dragging });
      if (g.frames.size && (dx !== g.dx || dy !== g.dy)) patchFrames(new Map([...g.frames].map(([id, s]) => [id, { x: s.x + dx, y: s.y + dy }])));
      g.dx = dx;
      g.dy = dy;
      return [...changes, ...rest];
    },
    [patchFrames],
  );

  /** The drag ends: one change for the whole group. Returns false when it was not a group drag. */
  const onGroupDragStop = useCallback((): boolean => {
    const g = drag.current;
    drag.current = null;
    if (!g) return false;
    const leadNode = rf.getNode(g.lead);
    const s0 = g.start.get(g.lead)!;
    const dx = leadNode ? Math.round(leadNode.position.x) - s0.x : 0, dy = leadNode ? Math.round(leadNode.position.y) - s0.y : 0;
    if (dx === 0 && dy === 0) {
      if (g.frames.size) patchFrames(g.frames);
      return true;
    }
    // The release is not a click on the lead card (that would select only it).
    const swallow = (c: MouseEvent) => c.stopPropagation();
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
    const by = (from: Pt): Pt => ({ x: from.x + dx, y: from.y + dy });
    // a drag drop: entities that land in a concept frame of another concept are asked about (D-05)
    saveMoves(
      {
        frames: [...g.frames].map(([id, from]) => ({ id, from, to: by(from) })),
        cards: [...g.loose].map((id) => ({ id, from: g.start.get(id)!, to: by(g.start.get(id)!) })),
        carried: g.start,
      },
      { ask: true },
    );
    return true;
  }, [rf, saveMoves, patchFrames]);

  // ---- nudge: the selection moves at once, the moves are saved together after the keys are still ----
  const nudging = useRef<{
    from: Map<string, Pt>;
    at: Map<string, Pt>;
    loose: Set<string>;
    frames: Map<string, Pt>;
    framesAt: Map<string, Pt>;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  const flushNudge = useCallback(() => {
    const n = nudging.current;
    nudging.current = null;
    if (!n) return;
    for (const id of [...n.from.keys(), ...n.frames.keys()]) pending.current.set(id, (pending.current.get(id) ?? 1) - 1);
    saveMoves({
      frames: changedOnly([...n.frames].map(([id, from]) => ({ id, from, to: n.framesAt.get(id)! }))),
      cards: changedOnly([...n.loose].map((id) => ({ id, from: n.from.get(id)!, to: n.at.get(id)! }))),
      carried: n.from,
    });
  }, [pending, saveMoves]);

  const nudge = useCallback(
    (dx: number, dy: number): boolean => {
      if (!editable) return false;
      const m = moving();
      if (!m.cards.length && !m.frames.length) return false;
      const n = (nudging.current ??= { from: new Map(), at: new Map(), loose: new Set(), frames: new Map(), framesAt: new Map(), timer: null });
      // a fresh page from the server must not put them back before they are saved
      const hold = (id: string) => pending.current.set(id, (pending.current.get(id) ?? 0) + 1);
      for (const node of [...m.cards, ...m.members]) {
        if (!n.from.has(node.id)) {
          n.from.set(node.id, { ...node.position });
          n.at.set(node.id, { ...node.position });
          hold(node.id);
        }
        const p = n.at.get(node.id)!;
        const to = { x: p.x + dx, y: p.y + dy };
        n.at.set(node.id, to);
        patchCard(node.id, to);
      }
      for (const node of m.cards) n.loose.add(node.id);
      const framesTo = new Map<string, Pt>();
      for (const f of m.frames) {
        if (!n.frames.has(f.id)) {
          n.frames.set(f.id, { x: f.x, y: f.y });
          n.framesAt.set(f.id, { x: f.x, y: f.y });
          hold(f.id);
        }
        const p = n.framesAt.get(f.id)!;
        const to = { x: p.x + dx, y: p.y + dy };
        n.framesAt.set(f.id, to);
        framesTo.set(f.id, to);
      }
      patchFrames(framesTo);
      if (n.timer) clearTimeout(n.timer);
      n.timer = setTimeout(flushNudge, NUDGE_SAVE_MS);
      return true;
    },
    [editable, moving, pending, patchCard, patchFrames, flushNudge],
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
      const m = moving();
      if (!editable || m.cards.length + m.frames.length < 2) return;
      const to = arrange(mode, [
        ...m.frames.map((f) => ({ id: f.id, rect: { x: f.x, y: f.y, w: f.width, h: f.height }, frame: true })),
        ...m.cards.map((n) => ({ id: n.id, rect: rectOf(n) })),
      ]);
      const frames = changedOnly(m.frames.map((f) => ({ id: f.id, from: { x: f.x, y: f.y }, to: to.get(f.id)! })));
      const cards = changedOnly(m.cards.map((n) => ({ id: n.id, from: { ...n.position }, to: to.get(n.id)! })));
      if (!frames.length && !cards.length) {
        toast(ARRANGED[mode]);
        return;
      }
      saveMoves({ frames, cards }, { onGrid: true, saved: () => toast(ARRANGED[mode]) });
    },
    [editable, moving, saveMoves, toast],
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
    saveLayout({ cards: changes.map((c) => ({ id: c.id, width: c.to })) }, { saved: done });
  }, [editable, selectedNodes, saveLayout, toast]);

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
      const placed: (CardTarget & { x: number; y: number; height: number })[] = [];
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
          placed.push({ sourceTableId: w.sourceTableId, ...spots[i]!, height: heights[i]! });
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
