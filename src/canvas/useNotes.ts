"use client";

// Notes on the canvas (slice 3a, D-20, D-21; prototype createNote, placeNoteAt, startEditNote, the note drag and width
// resize, unpinNote, deleteNote). The notes as the canvas shows them: from the server, changed at once by the user,
// saved one after the other per note (as cards are), put back with the domain's message when refused. Every saved
// change is one undo step.
// - A new note (the Note tool, the toolboxes) is a draft until its text is written: Ctrl+Enter or a click outside
//   saves it, Esc or an empty text drops it, leaving nothing saved and no undo step (D-21). It is yellow, 220 px wide,
//   open for typing and selected. The Note tool ends after one note.
// - A note is dragged anywhere on it (not its ✓ or its edge), snapped to 8 px: a free note to a new place, joining the
//   frame it is dropped in (x + 20, y + 13); a pinned note to a new offset from its card or frame. Its right edge
//   changes its width in steps of 8 between 160 and 520 px. A click without moving selects it; a double-click edits it.
// - Reviewers work on notes as modelers do; readers only select them (Łukasz's step 0 answer 1).

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import { useReactFlow } from "@xyflow/react";
import type { Uuid } from "@/domain/ids";
import { noteFrameAt, NOTE_WIDTH, pinOffset, pinTargetRect, type NotePlaces } from "@/domain/model/notes";
import { useToast } from "@/ui/components/toast";
import type { NotePatch, NoteView, UndoHooks } from "./context";
import type { Selection } from "./line-data";
import { noteAt, type NoteData } from "./note-data";

type WriteResult<T> = { ok: true; value: T } | { ok: false; message: string };
type NoteResult = Promise<WriteResult<{ note: NoteData }>>;
type Pin = { canvasItemId?: Uuid; frameId?: Uuid };

/** The note writes of one canvas (server actions, bound to the workspace and canvas by the page). */
export interface NoteWrites {
  createNote: (input: { text: string; x?: number; y?: number; pin?: Pin }) => NoteResult;
  updateNote: (input: { noteId: Uuid; expectedVersion: number } & NotePatch) => NoteResult;
  moveNote: (input: { noteId: Uuid; expectedVersion: number; x: number; y: number }) => NoteResult;
  pinNote: (input: { noteId: Uuid; expectedVersion: number; pin: Pin }) => NoteResult;
  unpinNote: (input: { noteId: Uuid; expectedVersion: number }) => NoteResult;
  deleteNote: (input: { noteId: Uuid; expectedVersion: number }) => Promise<WriteResult<unknown>>;
}

const READ_ONLY = () => Promise.resolve({ ok: false as const, message: "Notes cannot be changed here." });
/** A canvas without note writes (read-only use). */
export const NO_NOTE_WRITES: NoteWrites = {
  createNote: READ_ONLY,
  updateNote: READ_ONLY,
  moveNote: READ_ONLY,
  pinNote: READ_ONLY,
  unpinNote: READ_ONLY,
  deleteNote: READ_ONLY,
};

/** The id of the new note being written (never saved under it). */
export const DRAFT_NOTE = "note:draft";
/** A press that moved less than this is a click. */
const CLICK_SLOP = 4;
/** The Note tool's free note: its corner this far up-left of the click (prototype placeNoteAt). */
const TOOL_OFFSET = { x: 16, y: 13 };
const FAILED = { ok: false as const, message: "Something went wrong. Nothing was saved." };
const snap8 = (v: number) => Math.round(v / 8) * 8;

const swallowNextClick = () => {
  const swallow = (c: MouseEvent) => c.stopPropagation();
  window.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
};

interface Options {
  /** May write notes: owner, admin, modeler and reviewer, not archived. */
  canNote: boolean;
  initialNotes: readonly NoteData[];
  versions: MutableRefObject<Map<string, number>>;
  pending: MutableRefObject<Map<string, number>>;
  enqueue: (id: string, write: () => Promise<void>) => void;
  select: (sel: Selection) => void;
  undo: () => UndoHooks | null;
  writes: NoteWrites;
  /** The cards and frames as the canvas shows them now (a dragged card at its node's place). */
  placesNow: () => NotePlaces;
  /** Names of cards and frames, and what a note can be pinned to now. */
  nameOf: (kind: "card" | "frame", id: Uuid) => string;
  targets: () => NoteView["targets"];
  /** The Note tool's on/off, owned by the canvas modes. */
  noteTool: boolean;
  endNoteTool: () => void;
  /** Who is writing (a draft's “Created … by …”). */
  userName: string;
}

export function useNotes(o: Options) {
  const rf = useReactFlow();
  const toast = useToast();
  const { canNote, versions, pending, enqueue, select, undo, writes } = o;
  const [saved, setNotes] = useState<NoteData[]>(() => [...o.initialNotes]);
  const [draft, setDraft] = useState<NoteData | null>(null);
  const [editing, setEditing] = useState<Uuid | null>(null);
  const [heights, setHeights] = useState<ReadonlyMap<Uuid, number>>(() => new Map());
  const [dragging, setDragging] = useState(false);
  const notes = useMemo(() => (draft ? [...saved, draft] : saved), [saved, draft]);
  const notesRef = useRef(notes);
  const placesRef = useRef(o.placesNow);
  const namesRef = useRef(o.nameOf);
  const targetsRef = useRef(o.targets);
  useEffect(() => {
    notesRef.current = notes;
    placesRef.current = o.placesNow;
    namesRef.current = o.nameOf;
    targetsRef.current = o.targets;
  });

  // ---- fresh notes from the server (after an undo, a removed card, a deleted frame): take them, except what is saving ----
  const { initialNotes } = o;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the server's notes arrive as props after a fresh page
    setNotes((ns) => {
      const local = new Map(ns.map((n) => [n.id, n]));
      return initialNotes.map((n) => ((pending.current.get(n.id) ?? 0) && local.has(n.id) ? local.get(n.id)! : n));
    });
    for (const n of initialNotes) if (!(pending.current.get(n.id) ?? 0)) versions.current.set(n.id, n.version);
  }, [initialNotes, pending, versions]);

  const noteOf = useCallback((id: Uuid) => notesRef.current.find((n) => n.id === id) ?? null, []);
  const patch = useCallback((id: Uuid, p: Partial<NoteData>) => {
    if (id === DRAFT_NOTE) setDraft((d) => (d ? { ...d, ...p } : d));
    else setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, ...p } : n)));
  }, []);

  /** Saves one change of a note after its earlier ones; a refusal puts `back` and shows the domain's message. */
  const save = useCallback(
    (id: Uuid, run: (version: number) => NoteResult, back: Partial<NoteData>) => {
      enqueue(id, async () => {
        let result: WriteResult<{ note: NoteData }>;
        try {
          result = await run(versions.current.get(id) ?? noteOf(id)?.version ?? 1);
        } catch {
          result = FAILED;
        }
        if (!result.ok) {
          patch(id, back);
          toast(result.message, "refusal");
          return;
        }
        const fresh = result.value.note;
        versions.current.set(id, fresh.version);
        // later changes of this note are still on their way: they show already, keep them
        if ((pending.current.get(id) ?? 0) <= 1) setNotes((ns) => ns.map((n) => (n.id === id ? fresh : n)));
        undo()?.noteSaved();
      });
    },
    [enqueue, versions, pending, noteOf, patch, toast, undo],
  );

  /** A free note's frame and that frame's place now, for a note at this canvas point. */
  const frameFor = useCallback((at: { x: number; y: number }) => {
    const places = placesRef.current();
    const frameId = noteFrameAt([...places.frames.values()], at, places.members);
    const f = frameId ? places.frames.get(frameId) : undefined;
    return { frameId, anchor: f ? { x: f.x, y: f.y } : null };
  }, []);

  // ---- a new note ----
  const newNote = useCallback(
    (where: { at: { x: number; y: number } } | { cardId: Uuid } | { frameId: Uuid }) => {
      if (!canNote) return;
      let place: Pick<NoteData, "x" | "y" | "pinCardId" | "pinFrameId" | "frameId" | "anchor">;
      if ("at" in where) {
        const at = { x: snap8(where.at.x), y: snap8(where.at.y) };
        place = { ...at, pinCardId: null, pinFrameId: null, ...frameFor(at) };
      } else {
        const pin = { pin_canvas_item_id: "cardId" in where ? where.cardId : null, pin_frame_id: "frameId" in where ? where.frameId : null };
        const rect = pinTargetRect(pin, placesRef.current());
        if (!rect) return;
        place = { ...pinOffset(rect), pinCardId: pin.pin_canvas_item_id, pinFrameId: pin.pin_frame_id, frameId: null, anchor: null };
      }
      setDraft({
        id: DRAFT_NOTE,
        version: 0,
        text: "",
        color: "yellow",
        status: "open",
        width: NOTE_WIDTH.initial,
        ...place,
        createdAt: new Date().toISOString(),
        createdBy: o.userName,
      });
      setEditing(DRAFT_NOTE);
      select({ t: "note", id: DRAFT_NOTE });
    },
    [canNote, frameFor, select, o.userName],
  );

  /** The Note tool: a click on a card, a frame's name or a collapsed block pins a note to it; elsewhere a free note. */
  const onNoteToolPointerDown = useCallback(
    (e: ReactPointerEvent): boolean => {
      if (!o.noteTool || e.button !== 0) return false;
      const el = e.target as HTMLElement;
      if (el.closest(".overview, .react-flow__panel")) return false;
      e.preventDefault();
      e.stopPropagation();
      swallowNextClick();
      o.endNoteTool();
      const block = el.closest<HTMLElement>("[data-block]")?.dataset.block;
      const card = block ? undefined : el.closest<HTMLElement>("[data-card]")?.dataset.card;
      const label = block || card ? undefined : el.closest(".f-lab") ? el.closest<HTMLElement>("[data-frame]")?.dataset.frame : undefined;
      if (block || label) newNote({ frameId: (block ?? label)! });
      else if (card) newNote({ cardId: card });
      else {
        const at = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        newNote({ at: { x: at.x - TOOL_OFFSET.x, y: at.y - TOOL_OFFSET.y } });
      }
      return true;
    },
    [o, rf, newNote],
  );

  // ---- writing ----
  const edit = useCallback(
    (id: Uuid) => {
      if (!canNote || !noteOf(id)) return;
      setEditing(id);
      select({ t: "note", id });
    },
    [canNote, noteOf, select],
  );

  /** Editing ends with this text: a draft is saved when it has text and dropped otherwise; a note saves a changed text. */
  const commit = useCallback(
    (id: Uuid, raw: string) => {
      setEditing((e) => (e === id ? null : e));
      const text = raw.replace(/\s+$/, "");
      if (id === DRAFT_NOTE) {
        const d = notesRef.current.find((n) => n.id === DRAFT_NOTE);
        if (!d || !text.trim()) {
          setDraft(null);
          select(null);
          return;
        }
        setDraft({ ...d, text });
        void (async () => {
          let result: WriteResult<{ note: NoteData }>;
          try {
            result = await writes.createNote({
              text,
              ...(d.pinCardId ? { pin: { canvasItemId: d.pinCardId } } : d.pinFrameId ? { pin: { frameId: d.pinFrameId } } : { x: d.x, y: d.y }),
            });
          } catch {
            result = FAILED;
          }
          setDraft(null);
          if (!result.ok) {
            select(null);
            toast(result.message, "refusal");
            return;
          }
          const note = result.value.note;
          versions.current.set(note.id, note.version);
          setNotes((ns) => [...ns, note]);
          select({ t: "note", id: note.id });
          undo()?.noteSaved();
        })();
        return;
      }
      const n = noteOf(id);
      if (!n || text.trim() === n.text.trim()) return;
      patch(id, { text });
      save(id, (v) => writes.updateNote({ noteId: id, expectedVersion: v, text }), { text: n.text });
    },
    [noteOf, patch, save, writes, select, toast, versions, undo],
  );

  const cancel = useCallback(
    (id: Uuid) => {
      setEditing((e) => (e === id ? null : e));
      if (id === DRAFT_NOTE) {
        setDraft(null);
        select(null);
      }
    },
    [select],
  );

  const update = useCallback(
    (id: Uuid, p: NotePatch) => {
      const n = noteOf(id);
      if (!canNote || !n || id === DRAFT_NOTE) return;
      const back: Partial<NoteData> = {};
      for (const k of Object.keys(p) as (keyof NotePatch)[]) (back as Record<string, unknown>)[k] = n[k];
      patch(id, p);
      save(id, (v) => writes.updateNote({ noteId: id, expectedVersion: v, ...p }), back);
    },
    [canNote, noteOf, patch, save, writes],
  );

  const pin = useCallback(
    (id: Uuid, to: { cardId: Uuid } | { frameId: Uuid }) => {
      const n = noteOf(id);
      if (!canNote || !n || id === DRAFT_NOTE) return;
      const cols = { pin_canvas_item_id: "cardId" in to ? to.cardId : null, pin_frame_id: "frameId" in to ? to.frameId : null };
      const rect = pinTargetRect(cols, placesRef.current());
      if (!rect) return;
      patch(id, { ...pinOffset(rect), pinCardId: cols.pin_canvas_item_id, pinFrameId: cols.pin_frame_id, frameId: null, anchor: null });
      save(
        id,
        (v) => writes.pinNote({ noteId: id, expectedVersion: v, pin: "cardId" in to ? { canvasItemId: to.cardId } : { frameId: to.frameId } }),
        { x: n.x, y: n.y, pinCardId: n.pinCardId, pinFrameId: n.pinFrameId, frameId: n.frameId, anchor: n.anchor },
      );
    },
    [canNote, noteOf, patch, save, writes],
  );

  const unpin = useCallback(
    (id: Uuid) => {
      const n = noteOf(id);
      if (!canNote || !n || id === DRAFT_NOTE || (!n.pinCardId && !n.pinFrameId)) return;
      const at = noteAt(n, placesRef.current());
      patch(id, { ...at, pinCardId: null, pinFrameId: null, ...frameFor(at) });
      save(id, (v) => writes.unpinNote({ noteId: id, expectedVersion: v }), { x: n.x, y: n.y, pinCardId: n.pinCardId, pinFrameId: n.pinFrameId, frameId: n.frameId, anchor: n.anchor });
      toast("The note is free now.");
    },
    [canNote, noteOf, patch, save, writes, frameFor, toast],
  );

  const remove = useCallback(
    (id: Uuid) => {
      const n = noteOf(id);
      if (!canNote || !n) return;
      if (id === DRAFT_NOTE) return cancel(id);
      setNotes((ns) => ns.filter((x) => x.id !== id));
      select(null);
      enqueue(id, async () => {
        let result: WriteResult<unknown>;
        try {
          result = await writes.deleteNote({ noteId: id, expectedVersion: versions.current.get(id) ?? n.version });
        } catch {
          result = FAILED;
        }
        if (!result.ok) {
          setNotes((ns) => (ns.some((x) => x.id === id) ? ns : [...ns, n]));
          toast(result.message, "refusal");
          return;
        }
        const u = undo();
        u?.noteSaved();
        toast("Note deleted", "info", u ? { label: "Undo", run: u.undo } : undefined);
      });
    },
    [canNote, noteOf, cancel, select, enqueue, writes, versions, toast, undo],
  );

  // ---- dragging a note, and its width ----
  const onNotePointerDown = useCallback(
    (e: ReactPointerEvent, id: Uuid, part: "body" | "resize") => {
      if (e.button !== 0) return;
      // the note is above cards and frames: the press is the note's, not a lasso's or a card's
      e.stopPropagation();
      const n = noteOf(id);
      if (!n) return;
      if ((e.target as HTMLElement).closest("textarea, button")) return;
      if (!canNote || id === DRAFT_NOTE) {
        select({ t: "note", id });
        return;
      }
      e.preventDefault();
      const zoom = rf.getViewport().zoom;
      const sx = e.clientX, sy = e.clientY;
      let moved = false;
      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - sx) / zoom, dy = (ev.clientY - sy) / zoom;
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < CLICK_SLOP) return;
        if (!moved) {
          moved = true;
          setDragging(true);
        }
        if (part === "resize") patch(id, { width: Math.min(NOTE_WIDTH.max, Math.max(NOTE_WIDTH.min, snap8(n.width + dx))) });
        else patch(id, { x: n.x + snap8(dx), y: n.y + snap8(dy) });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (!moved) {
          select({ t: "note", id });
          return;
        }
        setDragging(false);
        swallowNextClick();
        const now = noteOf(id)!;
        if (part === "resize") {
          if (now.width !== n.width) save(id, (v) => writes.updateNote({ noteId: id, expectedVersion: v, width: now.width }), { width: n.width });
          return;
        }
        if (now.x === n.x && now.y === n.y) return;
        const back = { x: n.x, y: n.y, frameId: n.frameId, anchor: n.anchor };
        // a free note joins the frame it is dropped in (its place on the canvas now, the frame as it is now)
        if (!now.pinCardId && !now.pinFrameId) {
          const at = noteAt(now, placesRef.current());
          patch(id, { ...at, ...frameFor(at) });
          save(id, (v) => writes.moveNote({ noteId: id, expectedVersion: v, x: at.x, y: at.y }), back);
        } else {
          save(id, (v) => writes.moveNote({ noteId: id, expectedVersion: v, x: now.x, y: now.y }), back);
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [canNote, noteOf, rf, patch, save, writes, select, frameFor],
  );

  const onHeight = useCallback((id: Uuid, h: number) => {
    setHeights((hs) => (hs.get(id) === h ? hs : new Map(hs).set(id, h)));
  }, []);

  // ---- what the panels see ----
  const noteView = useCallback((id: Uuid): NoteView | null => {
    const n = notesRef.current.find((x) => x.id === id);
    if (!n) return null;
    const pinKind = n.pinCardId ? "card" : n.pinFrameId ? "frame" : null;
    const pinId = n.pinCardId ?? n.pinFrameId;
    return {
      note: n,
      draft: n.id === DRAFT_NOTE,
      pinnedTo: pinKind && pinId ? { kind: pinKind, id: pinId, name: namesRef.current(pinKind, pinId) } : null,
      frameName: !pinKind && n.frameId ? namesRef.current("frame", n.frameId) || null : null,
      targets: targetsRef.current(),
    };
  }, []);

  return {
    notes,
    editing,
    heights,
    dragging,
    newNote,
    onNoteToolPointerDown,
    onNotePointerDown,
    onHeight,
    edit,
    commit,
    cancel,
    update,
    pin,
    unpin,
    remove,
    noteView,
  };
}
