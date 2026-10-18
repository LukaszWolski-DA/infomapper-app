"use client";

// What a selection of several cards can do (slice 2a; prototype startGroupDrag, nudge, arrange, fitWidths,
// multi-feed, multi-remove): drag the group, nudge it with the arrow keys, align, stack, line up, fit widths, bring in
// the feeding sources of the selected entities and take the group off the canvas. Each is one change group, so one
// undo puts everything back. The cards change on screen at once; a refusal puts them back with the domain's message.
// Slice 2b: moves and widths are saved through `saveLayout`, which also decides the cards' frames (answer 1). Frames in
// the selection stand for their cards (D-17, prototype movingItems): a group drag, a nudge, align, stack and line up move
// each selected frame with its cards and each other selected card on its own, every card once; fit widths, remove and
// “Add sources” act on the selected cards only.
// Slice 3a (item 13; prototype movingItems, startGroupDrag, nudge): selected notes move with the group, each once (a
// free note in a moving frame goes with its frame, a pinned note with its card or frame), in the same change. A note of
// the selection pressed and dragged moves the whole selection (`startDrag`). Reviewers move only the notes of a
// selection (they may not move cards or frames); readers nothing. Align, stack, line up and fit widths leave notes alone.

import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";
import { applyNodeChanges, useReactFlow, type NodeChange } from "@xyflow/react";
import { useToast } from "@/ui/components/toast";
import { ARRANGED, arrange, type ArrangeMode } from "./arrange";
import type { CardData } from "./card-data";
import type { FrameData } from "./frame-data";
import { cardNodesOf, type CardNodeT } from "./CardNode";
import type { CardTarget, UndoHooks } from "./context";
import type { ReqMover, SaveLayoutOptions } from "./useFrames";
import type { LayoutChange } from "./layout-plan";
import { besideSpots, CARD_W, cardHeight, cardWidth, inside, newCardHeight, snap8, type Pt, type Rect } from "./geometry";
import type { Selection } from "./line-data";
import type { NoteData } from "./note-data";
import { isNoteKey, selectedCardIds, selectedKeys, selectedReqCardIds, unitsOf, type ItemBox } from "./selection";
import type { NoteMove, NoteMover } from "./useNotes";
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
/** A press that moved less than this is a click. */
const CLICK_SLOP = 4;

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
  /** Cards removed here, at the version they had then (`mergeFresh`). */
  removedHere: MutableRefObject<Map<string, number>>;
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
  /** What stands for a frame: the frame, or its block when collapsed (slice 2c: align, stack, line up use its size). */
  frameRect: (f: FrameData) => Rect;
  /** May move notes (editors and reviewers, slice 3a). */
  canNote: boolean;
  /** The canvas's notes; and a save of notes moved without cards or frames (one change). */
  notes: MutableRefObject<NoteMover | null>;
  saveNoteMoves: (moves: readonly NoteMove[]) => void;
  /** The canvas's requirement cards (slice 4b-2): they move and leave with the selection. */
  reqs: MutableRefObject<ReqMover | null>;
}

type Move = { id: string; from: Pt; to: Pt };
const changedOnly = (list: Move[]) => list.filter((m) => m.to.x !== m.from.x || m.to.y !== m.from.y);

const rectOf = (n: CardNodeT): Rect => ({ x: n.position.x, y: n.position.y, w: cardWidth(n.data.card), h: cardHeight(n.data.card) });

export function useGroupActions(o: Options) {
  const rf = useReactFlow();
  const toast = useToast();
  const { editable, selection, select, setNodes, patchCard, enqueueGroup, versions, pending, removedHere, undo, occupied, viewRect } = o;
  const { saveLayout, removeCards, placeCards, items, framesNow, patchFrames, frameRect, canNote, notes: noteMover, saveNoteMoves, reqs: reqMover } = o;

  /** The selected cards themselves on this canvas (not frames): several, or the one selected card. */
  const selectedNodes = useCallback((): CardNodeT[] => {
    const all = items();
    const ids = new Set(selectedCardIds(selectedKeys(selection, all), all));
    return cardNodesOf(rf).filter((n) => ids.has(n.id));
  }, [rf, selection, items]);

  /**
   * What the selection moves: selected frames with their cards, the other selected cards (slice 2b) and the selected
   * notes that move by themselves (slice 3a). Reviewers move only notes, readers nothing.
   */
  const moving = useCallback(() => {
    const all = items();
    const keys = selectedKeys(selection, all);
    const u = unitsOf(editable ? keys : canNote ? keys.filter(isNoteKey) : [], all);
    const byId = new Map(cardNodesOf(rf).map((n) => [n.id, n]));
    const frames = new Map(framesNow().map((f) => [f.id, f]));
    // a card hidden in a collapsed frame does not move on its own, even when selected from a panel (slice 2c)
    const hidden = new Set(all.filter((i) => i.hidden).map((i) => i.id));
    return {
      frames: u.frames.map((id) => frames.get(id)).filter((f): f is FrameData => !!f),
      cards: u.cards.filter((id) => !hidden.has(id)).map((id) => byId.get(id)).filter((n): n is CardNodeT => !!n),
      members: u.members.map((id) => byId.get(id)).filter((n): n is CardNodeT => !!n),
      notes: canNote ? u.notes.map((id) => noteMover.current?.noteOf(id)).filter((n): n is NoteData => !!n) : [],
      // requirement cards (slice 4b-2): each on its own, where it is shown now
      reqs: u.reqs.flatMap((id) => {
        const at = reqMover.current?.has(id) ? rf.getNode(id)?.position : undefined;
        return at ? [{ id, position: { x: at.x, y: at.y } }] : [];
      }),
    };
  }, [items, selection, rf, framesNow, editable, canNote, noteMover, reqMover]);

  /**
   * New positions on screen at once, saved in one change with the cards' frames; a refusal puts everything back.
   * Frames carry their cards; `carried` holds where every moving card was before (shown moved already).
   */
  const saveMoves = useCallback(
    (
      moves: { frames: Move[]; cards: Move[]; carried?: ReadonlyMap<string, Pt>; notes?: NoteMove[] },
      options: { onGrid?: boolean; ask?: boolean; saved?: () => void } = {},
    ) => {
      const notes = moves.notes ?? [];
      if (!moves.frames.length && !moves.cards.length) {
        // notes alone (slice 3a): their own change, which reviewers may make too
        if (notes.length) saveNoteMoves(notes);
        return;
      }
      saveLayout(
        {
          frames: moves.frames.map((m) => ({ id: m.id, ...m.to })),
          cards: moves.cards.map((m) => ({ id: m.id, ...m.to })),
          notes: notes.map((m) => ({ id: m.id, ...m.to })),
        },
        {
          ...options,
          from: new Map([...(moves.carried ?? []), ...moves.cards.map((m) => [m.id, m.from] as const)]),
          framesFrom: new Map(moves.frames.map((m) => [m.id, m.from])),
          notesFrom: new Map(notes.map((m) => [m.id, m.from])),
        },
      );
    },
    [saveLayout, saveNoteMoves],
  );

  /** Shows the selection's notes moved by (dx, dy) from where they started (not saved). */
  const showNotes = useCallback(
    (starts: ReadonlyMap<string, Pt>, dx: number, dy: number) => {
      if (starts.size) noteMover.current?.show(new Map([...starts].map(([id, s]) => [id, { x: s.x + dx, y: s.y + dy }])));
    },
    [noteMover],
  );
  const notesAt = (list: readonly NoteData[]) => new Map(list.map((n) => [n.id, { x: n.x, y: n.y }]));
  const noteMoves = (starts: ReadonlyMap<string, Pt>, dx: number, dy: number): NoteMove[] =>
    [...starts].map(([id, from]) => ({ id, from, to: { x: from.x + dx, y: from.y + dy } }));

  // ---- group drag: the dragged card leads, the others and the selected frames follow by the same amount ----
  const drag = useRef<{ lead: string; start: Map<string, Pt>; loose: Set<string>; frames: Map<string, Pt>; notes: Map<string, Pt>; dx: number; dy: number } | null>(null);

  const onNodeDragStart = useCallback(
    (node: CardNodeT) => {
      drag.current = null;
      const lead = items().find((i) => i.id === node.id);
      if (!editable || selection?.t !== "multi" || !lead || !selection.keys.includes(lead.key)) return;
      const m = moving();
      drag.current = {
        lead: node.id,
        start: new Map([...m.cards, ...m.members, ...m.reqs].map((n) => [n.id, { ...n.position }])),
        loose: new Set([...m.cards, ...m.reqs].map((n) => n.id)),
        frames: new Map(m.frames.map((f) => [f.id, { x: f.x, y: f.y }])),
        notes: notesAt(m.notes),
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
      if (dx !== g.dx || dy !== g.dy) showNotes(g.notes, dx, dy);
      g.dx = dx;
      g.dy = dy;
      return [...changes, ...rest];
    },
    [patchFrames, showNotes],
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
      showNotes(g.notes, 0, 0);
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
        notes: noteMoves(g.notes, dx, dy),
      },
      { ask: true },
    );
    return true;
  }, [rf, saveMoves, patchFrames, showNotes]);

  /**
   * A note of the selection pressed (slice 3a): the whole selection follows the pointer, snapped to 8 px, one update per
   * frame, and is saved in one change on release; a press without moving is a click (`onClick`). False when the
   * selection holds nothing this person may move.
   */
  const startDrag = useCallback(
    (e: ReactPointerEvent, onClick: () => void): boolean => {
      const m = moving();
      if (!m.cards.length && !m.frames.length && !m.notes.length && !m.reqs.length) return false;
      e.preventDefault();
      const zoom = rf.getViewport().zoom;
      const sx = e.clientX, sy = e.clientY;
      const start = new Map([...m.cards, ...m.members].map((n) => [n.id, { ...n.position }]));
      const loose = new Set(m.cards.map((n) => n.id));
      const frames = new Map(m.frames.map((f) => [f.id, { x: f.x, y: f.y }]));
      const notes = notesAt(m.notes);
      const reqs = new Map(m.reqs.map((n) => [n.id, n.position]));
      let dx = 0, dy = 0, moved = false;
      let raf: number | null = null;
      const show = () => {
        raf = null;
        if (start.size) setNodes((ns) => applyNodeChanges([...start].map(([id, p]) => ({ type: "position" as const, id, position: { x: p.x + dx, y: p.y + dy } })), ns));
        if (reqs.size) reqMover.current?.show(new Map([...reqs].map(([id, p]) => [id, { x: p.x + dx, y: p.y + dy }])));
        if (frames.size) patchFrames(new Map([...frames].map(([id, p]) => [id, { x: p.x + dx, y: p.y + dy }])));
        showNotes(notes, dx, dy);
      };
      const move = (ev: PointerEvent) => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < CLICK_SLOP) return;
        moved = true;
        const ndx = snap8((ev.clientX - sx) / zoom), ndy = snap8((ev.clientY - sy) / zoom);
        if (ndx === dx && ndy === dy) return;
        dx = ndx;
        dy = ndy;
        if (raf === null) raf = requestAnimationFrame(show);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        if (raf !== null) cancelAnimationFrame(raf);
        if (!moved) {
          onClick();
          return;
        }
        const swallow = (c: MouseEvent) => c.stopPropagation();
        window.addEventListener("click", swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
        if (dx === 0 && dy === 0) {
          show();
          return;
        }
        const by = (from: Pt): Pt => ({ x: from.x + dx, y: from.y + dy });
        saveMoves(
          {
            frames: [...frames].map(([id, from]) => ({ id, from, to: by(from) })),
            cards: [...[...loose].map((id) => ({ id, from: start.get(id)!, to: by(start.get(id)!) })), ...[...reqs].map(([id, from]) => ({ id, from, to: by(from) }))],
            carried: start,
            notes: noteMoves(notes, dx, dy),
          },
          loose.size ? { ask: true } : {},
        );
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      return true;
    },
    [moving, rf, setNodes, patchFrames, showNotes, saveMoves, reqMover],
  );

  // ---- nudge: the selection moves at once, the moves are saved together after the keys are still ----
  const nudging = useRef<{
    from: Map<string, Pt>;
    at: Map<string, Pt>;
    loose: Set<string>;
    frames: Map<string, Pt>;
    framesAt: Map<string, Pt>;
    notes: Map<string, Pt>;
    notesAt: Map<string, Pt>;
    reqs: Map<string, Pt>;
    reqsAt: Map<string, Pt>;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  const flushNudge = useCallback(() => {
    const n = nudging.current;
    nudging.current = null;
    if (!n) return;
    for (const id of [...n.from.keys(), ...n.frames.keys(), ...n.notes.keys(), ...n.reqs.keys()]) pending.current.set(id, (pending.current.get(id) ?? 1) - 1);
    saveMoves({
      frames: changedOnly([...n.frames].map(([id, from]) => ({ id, from, to: n.framesAt.get(id)! }))),
      cards: changedOnly([...[...n.loose].map((id) => ({ id, from: n.from.get(id)!, to: n.at.get(id)! })), ...[...n.reqs].map(([id, from]) => ({ id, from, to: n.reqsAt.get(id)! }))]),
      carried: n.from,
      notes: changedOnly([...n.notes].map(([id, from]) => ({ id, from, to: n.notesAt.get(id)! }))),
    });
  }, [pending, saveMoves]);

  const nudge = useCallback(
    (dx: number, dy: number): boolean => {
      if (!editable && !canNote) return false;
      const m = moving();
      if (!m.cards.length && !m.frames.length && !m.notes.length && !m.reqs.length) return false;
      const n = (nudging.current ??= { from: new Map(), at: new Map(), loose: new Set(), frames: new Map(), framesAt: new Map(), notes: new Map(), notesAt: new Map(), reqs: new Map(), reqsAt: new Map(), timer: null });
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
      const notesTo = new Map<string, Pt>();
      for (const note of m.notes) {
        if (!n.notes.has(note.id)) {
          n.notes.set(note.id, { x: note.x, y: note.y });
          n.notesAt.set(note.id, { x: note.x, y: note.y });
          hold(note.id);
        }
        const p = n.notesAt.get(note.id)!;
        const to = { x: p.x + dx, y: p.y + dy };
        n.notesAt.set(note.id, to);
        notesTo.set(note.id, to);
      }
      if (notesTo.size) noteMover.current?.show(notesTo);
      const reqsTo = new Map<string, Pt>();
      for (const r of m.reqs) {
        if (!n.reqs.has(r.id)) {
          n.reqs.set(r.id, r.position);
          n.reqsAt.set(r.id, r.position);
          hold(r.id);
        }
        const p = n.reqsAt.get(r.id)!;
        const to = { x: p.x + dx, y: p.y + dy };
        n.reqsAt.set(r.id, to);
        reqsTo.set(r.id, to);
      }
      if (reqsTo.size) reqMover.current?.show(reqsTo);
      if (n.timer) clearTimeout(n.timer);
      n.timer = setTimeout(flushNudge, NUDGE_SAVE_MS);
      return true;
    },
    [editable, canNote, moving, pending, patchCard, patchFrames, flushNudge, noteMover, reqMover],
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
        ...m.frames.map((f) => ({ id: f.id, rect: frameRect(f), frame: true })),
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
    [editable, moving, saveMoves, toast, frameRect],
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
    const all = items();
    // the selected requirement cards leave with the cards (slice 4b-2, L)
    const reqIds = selectedReqCardIds(selectedKeys(selection, all), all);
    const ids = [...selectedNodes().map((n) => n.id), ...reqIds];
    if (!editable || !ids.length) return;
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
      for (const id of ids) removedHere.current.set(id, versions.current.get(id) ?? 1);
      setNodes((ns) => ns.filter((n) => !ids.includes(n.id)));
      if (reqIds.length) reqMover.current?.drop(reqIds);
      select(null);
      const u = undo();
      const n = ids.length;
      toast(
        `Removed ${n} card${n === 1 ? "" : "s"} from this canvas. They stay in the model with their mappings.`,
        "info",
        u ? { label: "Undo", run: u.undo } : undefined,
      );
    });
  }, [editable, items, selection, selectedNodes, enqueueGroup, removeCards, versions, removedHere, setNodes, select, undo, toast, reqMover]);

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
      const here = new Set(cardNodesOf(rf).filter((n) => n.data.card.kind === "src").map((n) => n.data.card.targetId));
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
    startDrag,
    nudge,
    arrangeSelection,
    fitSelectionWidths,
    removeSelection,
    placeSourcesOfSelection: placeSources,
  };
}
