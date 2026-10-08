"use client";

// Frames on the canvas (slice 2b) and every change of where cards and frames are or how wide cards are.
// - The frames as the canvas shows them: from the server, changed at once by the user, saved in order (as cards are).
// - `saveLayout`: drags, drops, nudges, arranging, card widths. The browser works out the cards' frames and the frames'
//   growth with the domain's rules (`layout-plan.ts`) and shows them at once; `moveOnCanvas` does the same on the
//   server in one change group. A refusal puts everything back with the domain's message.
// - Dragging a frame by its name or an empty spot inside it moves it with its cards, lines following (D-14), snapped
//   to 8 px as a group drag is; a click without moving selects it. The handle at its bottom-right corner resizes it,
//   at least 160 × 96 px, and membership is decided again on release (D-06).
// - The Frame tool (A): drag on the canvas to draw a frame; a press without dragging (or a frame under 160 × 96)
//   makes a 480 × 320 frame centred on it; the tool ends after one frame; Esc cancels. “New frame here” in the toolbox.
// - Delete, fit to content, zoom to a frame, select its cards, rename.
// - Slice 2b step 3: a drag drop that brings entities into a concept frame of another concept asks once whether to
//   move them in the model (D-05, D-17); the drop and the answer are saved together. Other moves only mark them.
//   “Put in a new frame”; the frames as the panels see them (`frameView`, `framesView`, `cardFrame`, `frameAt`).
// - Slice 2b step 4: a frame that is part of a selection of several, dragged by its name or an empty spot, moves the
//   whole selection: every selected frame with its cards and every other selected card (D-17, prototype startGroupDrag).

import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";
import { applyNodeChanges, useReactFlow, type NodeChange } from "@xyflow/react";
import type { Uuid } from "@/domain/ids";
import {
  conceptQuestions,
  FRAME_MIN_SIZE,
  frameAt as smallestFrameAt,
  FREE_FRAME_COLORS,
  frameAround,
  isMisplaced,
  NEW_FRAME_NAME,
  NEW_FRAME_SIZE,
  type FrameBox,
} from "@/domain/model/frames";
import type { Frame } from "@/domain/types";
import { useToast } from "@/ui/components/toast";
import type { CardData } from "./card-data";
import type { CardNodeT } from "./CardNode";
import type { FramePatch, FrameView, UndoHooks } from "./context";
import { buildFrames, conceptAsk, frameStats, type ConceptAsk, type FrameData } from "./frame-data";
import type { FramePart } from "./FrameLayer";
import { cardHeight, cardWidth, snap8, type Pt, type Rect } from "./geometry";
import { planLayout, planReframe, type LayoutChange, type PlanCard } from "./layout-plan";
import type { Selection } from "./line-data";
import { rectBetween } from "./selection";

type WriteResult<T> = { ok: true; value: T } | { ok: false; message: string };
type Versions = { versions: Record<string, number> };
type CardRef = { canvasItemId: Uuid; expectedVersion: number };
type SizedRef = CardRef & { height: number };

/** The frame writes of one canvas (server actions, bound to the workspace and canvas by the page). */
export interface FrameWrites {
  moveOnCanvas: (input: {
    frames: { frameId: Uuid; expectedVersion: number; x?: number; y?: number }[];
    items: (CardRef & { x?: number; y?: number; width?: number | null; height?: number })[];
    onGrid?: boolean;
    moveToConcepts?: boolean;
  }) => Promise<WriteResult<Versions & { movedToConcepts: number }>>;
  createFrame: (input: { x: number; y: number; width: number; height: number; cards: SizedRef[] }) => Promise<WriteResult<Versions & { frameId: Uuid; claimed: number }>>;
  updateFrame: (input: { frameId: Uuid; expectedVersion: number } & FramePatch) => Promise<WriteResult<{ frame: Frame }>>;
  resizeFrame: (input: { frameId: Uuid; expectedVersion: number; width: number; height: number; cards: CardRef[] }) => Promise<WriteResult<Versions>>;
  fitFrame: (input: { frameId: Uuid; expectedVersion: number; cards: SizedRef[] }) => Promise<WriteResult<Versions>>;
  deleteFrame: (input: { frameId: Uuid; expectedVersion: number; cards: CardRef[] }) => Promise<WriteResult<{ name: string; released: number }>>;
  putInNewFrame: (input: { cards: SizedRef[]; others?: SizedRef[] }) => Promise<WriteResult<Versions & { frameId: Uuid; kind: Frame["kind"]; cards: number }>>;
  arrangeIntoFrames: (input: {
    frames: { frameId: Uuid; expectedVersion: number }[];
    cards: SizedRef[];
  }) => Promise<WriteResult<Versions & { frames: number; built: Frame[]; cards: { id: Uuid; x: number; y: number; frameId: Uuid | null }[] }>>;
}

export type CardPatch = Partial<Pick<CardData, "collapsed" | "rowFilter" | "x" | "y" | "width" | "frameId">>;

export interface SaveLayoutOptions {
  /** Align, stack, line up: positions on the 8 px grid. */
  onGrid?: boolean;
  /** Where cards were before, when the canvas already shows them moved (nudges, group moves). */
  from?: ReadonlyMap<Uuid, Pt>;
  /** Where frames were before, when the canvas already shows them moved (a frame drag). */
  framesFrom?: ReadonlyMap<Uuid, Pt>;
  /** Runs once saved. */
  saved?: () => void;
  /** A drag drop (single card or group): entities that land in a concept frame of another concept are asked about. */
  ask?: boolean;
}

interface Options {
  editable: boolean;
  initialFrames: readonly FrameData[];
  setNodes: Dispatch<SetStateAction<CardNodeT[]>>;
  patchCard: (id: Uuid, patch: CardPatch) => void;
  enqueueGroup: (ids: readonly Uuid[], write: () => Promise<void>) => void;
  versions: MutableRefObject<Map<string, number>>;
  pending: MutableRefObject<Map<string, number>>;
  select: (sel: Selection) => void;
  undo: () => UndoHooks | null;
  writes: FrameWrites;
  /** Space held: a left drag pans. */
  spaceDown: MutableRefObject<boolean>;
  /** The Frame tool's on/off, owned by the canvas modes. */
  frameTool: boolean;
  endFrameTool: () => void;
  /** A new frame was made: its name is ready to type in the panel. */
  onCreated: (frameId: Uuid) => void;
  /** Selects the cards with these ids. */
  selectCards: (cardIds: readonly Uuid[]) => void;
  /** Concept names, for the drop's question. */
  conceptName: (id: Uuid) => string;
  /** Shows the drop's question; resolves with the answer (true: move them in the model). */
  ask: (question: ConceptAsk) => Promise<boolean>;
  /** When this frame is part of a selection of several: what the selection moves (`unitsOf`), else null. */
  groupOf: (frameId: Uuid) => { frames: Uuid[]; cards: Uuid[]; members: Uuid[] } | null;
}

const FAILED = { ok: false as const, message: "Something went wrong. Nothing was saved." };
/** A press that moved less than this is a click. */
const CLICK_SLOP = 4;

const swallowNextClick = () => {
  const swallow = (c: MouseEvent) => c.stopPropagation();
  window.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
};

const boxOf = (f: FrameData): FrameBox => ({ id: f.id, x: f.x, y: f.y, width: f.width, height: f.height });

export function useFrames(o: Options) {
  const rf = useReactFlow();
  const toast = useToast();
  const { editable, setNodes, patchCard, enqueueGroup, versions, pending, select, undo, writes, spaceDown } = o;
  const [frames, setFrames] = useState<FrameData[]>(() => [...o.initialFrames]);
  const framesRef = useRef(frames);
  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);
  const [busy, setBusy] = useState(false);
  // the drop's question, read when asked (stable callbacks)
  const askRef = useRef(o.ask);
  const groupOfRef = useRef(o.groupOf);
  const conceptNameRef = useRef(o.conceptName);
  useEffect(() => {
    askRef.current = o.ask;
    groupOfRef.current = o.groupOf;
    conceptNameRef.current = o.conceptName;
  });

  // ---- fresh frames from the server: take them, except what is still saving ----
  const { initialFrames } = o;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the server's frames arrive as props after each write
    setFrames((fs) => {
      const local = new Map(fs.map((f) => [f.id, f]));
      return initialFrames.map((f) => ((pending.current.get(f.id) ?? 0) && local.has(f.id) ? local.get(f.id)! : f));
    });
    for (const f of initialFrames) if (!(pending.current.get(f.id) ?? 0)) versions.current.set(f.id, f.version);
  }, [initialFrames, pending, versions]);

  const nodes = useCallback(() => rf.getNodes() as CardNodeT[], [rf]);
  /** The cards as saved so far (a drag in progress moves only the node, not its data). */
  const planCards = useCallback(
    (from?: ReadonlyMap<Uuid, Pt>): PlanCard[] =>
      nodes().map(({ id, data: { card } }) => ({ id, ...(from?.get(id) ?? { x: card.x, y: card.y }), width: card.width, height: cardHeight(card), frameId: card.frameId })),
    [nodes],
  );
  const patchFrames = useCallback((patch: ReadonlyMap<Uuid, Partial<FrameData>>) => {
    if (!patch.size) return;
    setFrames((fs) => fs.map((f) => (patch.has(f.id) ? { ...f, ...patch.get(f.id) } : f)));
  }, []);
  const ver = useCallback((id: Uuid) => versions.current.get(id) ?? 1, [versions]);
  const framesNow = useCallback(() => framesRef.current, []);
  const noteVersions = useCallback(
    (v: Record<string, number>) => {
      for (const [id, n] of Object.entries(v)) versions.current.set(id, n);
    },
    [versions],
  );

  // ---- every change of positions and widths ----
  const saveLayout = useCallback(
    (change: LayoutChange, opts: SaveLayoutOptions = {}) => {
      const framesBefore = framesRef.current.map((f) => ({ ...f, ...(opts.framesFrom?.get(f.id) ?? {}) }));
      const before = planCards(opts.from);
      const beforeById = new Map(before.map((c) => [c.id, c]));
      const plan = planLayout(framesBefore.map(boxOf), before, change);

      // at once on the screen
      const cardsBack = new Map<Uuid, CardPatch>();
      for (const c of plan.cards) {
        const b = beforeById.get(c.id)!;
        const node = rf.getNode(c.id) as CardNodeT | undefined;
        const shown = node?.data.card;
        if (!shown) continue;
        if (shown.x === c.x && shown.y === c.y && shown.width === c.width && shown.frameId === c.frameId && node.position.x === c.x && node.position.y === c.y) continue;
        patchCard(c.id, { x: c.x, y: c.y, width: c.width, frameId: c.frameId });
        cardsBack.set(c.id, { x: b.x, y: b.y, width: b.width, frameId: b.frameId });
      }
      const framesBack = new Map<Uuid, Partial<FrameData>>();
      const framesNext = new Map<Uuid, Partial<FrameData>>();
      for (const f of plan.frames) {
        const b = framesBefore.find((x) => x.id === f.id)!;
        const shown = framesRef.current.find((x) => x.id === f.id)!;
        if (shown.x === f.x && shown.y === f.y && shown.width === f.width && shown.height === f.height) continue;
        framesNext.set(f.id, { x: f.x, y: f.y, width: f.width, height: f.height });
        framesBack.set(f.id, { x: b.x, y: b.y, width: b.width, height: b.height });
      }
      patchFrames(framesNext);

      const moved = new Map((change.frames ?? []).map((f) => [f.id, f]));
      const touched = [...plan.carried, ...plan.changed];

      // a drag drop asks about entities that landed in a concept frame of another concept (D-05), once for all
      const planById = new Map(plan.cards.map((c) => [c.id, c]));
      const questions = opts.ask
        ? conceptQuestions(
            framesBefore.map((f) => ({ id: f.id, kind: f.kind, concept_id: f.conceptId })),
            [...plan.changed].map((id) => {
              const card = (rf.getNode(id) as CardNodeT | undefined)?.data.card;
              return {
                cardId: id,
                entityId: card?.kind === "ent" ? card.targetId : null,
                conceptId: card?.subject.entityConceptId ?? null,
                frameBefore: beforeById.get(id)!.frameId,
                frameAfter: planById.get(id)!.frameId,
              };
            }),
          )
        : [];
      const question = questions.length
        ? conceptAsk(
            questions.map((q) => {
              const card = (rf.getNode(q.cardId) as CardNodeT).data.card;
              return { name: card.name, from: conceptNameRef.current(card.subject.entityConceptId ?? ""), to: conceptNameRef.current(q.conceptId) };
            }),
          )
        : null;
      // asked at once, while the write waits in the queue (the drop is already on the screen)
      const answer = question ? askRef.current(question) : Promise.resolve(false);
      if (!touched.length && !moved.size) return;
      const widths = new Map((change.cards ?? []).filter((c) => c.width !== undefined).map((c) => [c.id, c.width]));
      const positions = new Map((change.cards ?? []).filter((c) => c.x !== undefined).map((c) => [c.id, c]));
      const frameIds = framesBefore.map((f) => f.id);
      enqueueGroup([...frameIds, ...touched], async () => {
        const moveToConcepts = await answer;
        let result: WriteResult<Versions & { movedToConcepts: number }>;
        try {
          result = await writes.moveOnCanvas({
            frames: frameIds.map((id) => ({ frameId: id, expectedVersion: ver(id), ...(moved.has(id) ? { x: moved.get(id)!.x, y: moved.get(id)!.y } : {}) })),
            items: touched.map((id) => {
              const ref = { canvasItemId: id, expectedVersion: ver(id) };
              if (plan.carried.has(id)) return widths.has(id) ? { ...ref, width: widths.get(id)! } : ref;
              const p = positions.get(id);
              return {
                ...ref,
                ...(p ? { x: p.x, y: p.y } : {}),
                ...(widths.has(id) ? { width: widths.get(id)! } : {}),
                height: beforeById.get(id)!.height,
              };
            }),
            ...(opts.onGrid ? { onGrid: true } : {}),
            ...(moveToConcepts ? { moveToConcepts: true } : {}),
          });
        } catch {
          result = FAILED;
        }
        if (result.ok) {
          noteVersions(result.value.versions);
          const u = undo();
          u?.noteSaved();
          opts.saved?.();
          if (question) toast(moveToConcepts ? question.moved : question.kept, "info", moveToConcepts && u ? { label: "Undo", run: u.undo } : undefined);
        } else {
          for (const [id, back] of cardsBack) patchCard(id, back);
          patchFrames(framesBack);
          toast(result.message, "refusal");
        }
      });
    },
    [planCards, rf, patchCard, patchFrames, enqueueGroup, writes, ver, noteVersions, undo, toast],
  );

  // ---- dragging a frame, resizing it ----
  const press = useRef<
    | {
        kind: "move";
        frameId: Uuid;
        sx: number;
        sy: number;
        zoom: number;
        /** The frames that move (this one, or every selected frame) and where each started. */
        frames: Map<Uuid, Pt>;
        /** Every card that moves and where it started; `loose` are those not carried by a moving frame. */
        members: Map<Uuid, Pt>;
        loose: Set<Uuid>;
        dx: number;
        dy: number;
        moved: boolean;
      }
    | { kind: "resize"; frameId: Uuid; sx: number; sy: number; zoom: number; start: { w: number; h: number }; w: number; h: number }
    | { kind: "click"; frameId: Uuid; sx: number; sy: number; moved: boolean }
    | null
  >(null);
  const raf = useRef<number | null>(null);

  const onFramePointerDown = useCallback(
    (e: ReactPointerEvent, frameId: Uuid, part: FramePart) => {
      if (e.button !== 0 || spaceDown.current) return; // right, middle, Space: React Flow pans
      const f = framesRef.current.find((x) => x.id === frameId);
      if (!f) return;
      e.preventDefault();
      const zoom = rf.getZoom();
      if (!editable) {
        press.current = { kind: "click", frameId, sx: e.clientX, sy: e.clientY, moved: false };
        return;
      }
      if (part === "handle") {
        e.stopPropagation();
        press.current = { kind: "resize", frameId, sx: e.clientX, sy: e.clientY, zoom, start: { w: f.width, h: f.height }, w: f.width, h: f.height };
        setBusy(true);
        return;
      }
      // part of a selection of several: the whole selection moves (D-17)
      const group = groupOfRef.current(frameId);
      const frameIds = new Set(group?.frames ?? [frameId]);
      const frames = new Map(framesRef.current.filter((x) => frameIds.has(x.id)).map((x) => [x.id, { x: x.x, y: x.y }]));
      const loose = new Set(group?.cards ?? []);
      const members = new Map(
        nodes()
          .filter((n) => loose.has(n.id) || (n.data.card.frameId !== null && frameIds.has(n.data.card.frameId)))
          .map((n) => [n.id, { ...n.position }]),
      );
      press.current = { kind: "move", frameId, sx: e.clientX, sy: e.clientY, zoom, frames, members, loose, dx: 0, dy: 0, moved: false };
    },
    [editable, rf, nodes, spaceDown],
  );

  // Window listeners subscribe once and read the latest callbacks: re-subscribing in the middle of a pointerup would
  // drop the other listeners still to run for it (see Lasso.ts).
  const live = useRef<{
    saveLayout: typeof saveLayout;
    resize: (frameId: Uuid, from: { w: number; h: number }, to: { w: number; h: number }) => void;
    select: typeof select;
    patchFrames: typeof patchFrames;
    createFrame: (rect: Rect) => Promise<void>;
    createFrameAt: (at: Pt) => void;
    endFrameTool: () => void;
  } | null>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current;
      const l = live.current;
      if (!p || !l) return;
      const { patchFrames } = l;
      if (p.kind === "click") {
        p.moved ||= Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > CLICK_SLOP;
        return;
      }
      if (p.kind === "resize") {
        const w = Math.max(FRAME_MIN_SIZE.width, snap8(p.start.w + (e.clientX - p.sx) / p.zoom));
        const h = Math.max(FRAME_MIN_SIZE.height, snap8(p.start.h + (e.clientY - p.sy) / p.zoom));
        if (w === p.w && h === p.h) return;
        p.w = w;
        p.h = h;
        patchFrames(new Map([[p.frameId, { width: w, height: h }]]));
        return;
      }
      if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) <= CLICK_SLOP) return;
      const dx = snap8((e.clientX - p.sx) / p.zoom), dy = snap8((e.clientY - p.sy) / p.zoom);
      if (dx === p.dx && dy === p.dy && p.moved) return;
      if (!p.moved) setBusy(true);
      p.moved = true;
      p.dx = dx;
      p.dy = dy;
      if (raf.current !== null) return;
      // One update per frame: the frame and its cards together, lines following (as the 2a group drag).
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        const q = press.current;
        if (q?.kind !== "move") return;
        patchFrames(new Map([...q.frames].map(([id, s]) => [id, { x: s.x + q.dx, y: s.y + q.dy }])));
        // not marked as dragging: a card marked so would ignore the server's next version of it (ModelCanvas)
        const changes: NodeChange<CardNodeT>[] = [...q.members].map(([id, s]) => ({ type: "position", id, position: { x: s.x + q.dx, y: s.y + q.dy } }));
        if (changes.length) setNodes((ns) => applyNodeChanges(changes, ns));
      });
    };
    const up = () => {
      const p = press.current;
      const l = live.current;
      if (!p || !l) return;
      const { patchFrames, select, saveLayout, resize } = l;
      press.current = null;
      if (raf.current !== null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
      setBusy(false);
      if (p.kind === "click") {
        if (!p.moved) select({ t: "frame", id: p.frameId });
        return;
      }
      if (p.kind === "resize") {
        if (p.w === p.start.w && p.h === p.start.h) return;
        swallowNextClick();
        resize(p.frameId, p.start, { w: p.w, h: p.h });
        return;
      }
      if (!p.moved || (p.dx === 0 && p.dy === 0)) {
        // put the members back exactly (a move below one grid step), then a click selects the frame
        if (p.moved) setNodes((ns) => applyNodeChanges([...p.members].map(([id, s]) => ({ type: "position", id, position: s, dragging: false })), ns));
        if (p.moved) patchFrames(p.frames);
        else select({ t: "frame", id: p.frameId });
        return;
      }
      swallowNextClick();
      const by = (s: Pt) => ({ x: s.x + p.dx, y: s.y + p.dy });
      saveLayout(
        {
          frames: [...p.frames].map(([id, s]) => ({ id, ...by(s) })),
          cards: [...p.loose].map((id) => ({ id, ...by(p.members.get(id)!) })),
        },
        // a group with cards of its own is a drag drop: they may be asked about (D-05)
        { framesFrom: p.frames, from: p.members, ...(p.loose.size ? { ask: true } : {}) },
      );
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [setNodes]);

  /** A frame given a new size: saved with the cards that join or leave it (D-06). */
  const resize = useCallback(
    (frameId: Uuid, from: { w: number; h: number }, to: { w: number; h: number }) => {
      const f = framesRef.current.find((x) => x.id === frameId);
      if (!f) return;
      const cards = planCards();
      const changes = planReframe(framesRef.current.map(boxOf), cards, { ...boxOf(f), width: to.w, height: to.h });
      const back = new Map(changes.map((c) => [c.cardId, cards.find((x) => x.id === c.cardId)!.frameId]));
      for (const c of changes) patchCard(c.cardId, { frameId: c.frameId });
      const ids = cards.map((c) => c.id);
      enqueueGroup([frameId, ...ids], async () => {
        let result: WriteResult<Versions>;
        try {
          result = await writes.resizeFrame({ frameId, expectedVersion: ver(frameId), width: to.w, height: to.h, cards: ids.map((id) => ({ canvasItemId: id, expectedVersion: ver(id) })) });
        } catch {
          result = FAILED;
        }
        if (result.ok) {
          noteVersions(result.value.versions);
          undo()?.noteSaved();
        } else {
          patchFrames(new Map([[frameId, { width: from.w, height: from.h }]]));
          for (const [id, frame] of back) patchCard(id, { frameId: frame });
          toast(result.message, "refusal");
        }
      });
    },
    [planCards, patchCard, enqueueGroup, writes, ver, noteVersions, undo, patchFrames, toast],
  );

  // ---- creating a frame: the Frame tool and “New frame here” ----
  const { onCreated } = o;
  const createFrame = useCallback(
    async (rect: Rect) => {
      if (!editable) return;
      const cards = nodes().map((n) => ({ canvasItemId: n.id, expectedVersion: ver(n.id), height: cardHeight(n.data.card) }));
      let result: WriteResult<Versions & { frameId: Uuid; claimed: number }>;
      try {
        result = await writes.createFrame({ x: rect.x, y: rect.y, width: rect.w, height: rect.h, cards });
      } catch {
        result = FAILED;
      }
      if (!result.ok) {
        toast(result.message, "refusal");
        return;
      }
      const { frameId, versions: v } = result.value;
      noteVersions(v);
      const frame: FrameData = { id: frameId, version: v[frameId] ?? 1, name: NEW_FRAME_NAME, kind: "free", conceptId: null, sourceSystemId: null, color: FREE_FRAME_COLORS[0], x: rect.x, y: rect.y, width: rect.w, height: rect.h };
      setFrames((fs) => (fs.some((f) => f.id === frameId) ? fs : [...fs, frame]));
      for (const id of Object.keys(v)) if (id !== frameId) patchCard(id, { frameId });
      select({ t: "frame", id: frameId });
      onCreated(frameId);
      const u = undo();
      u?.noteSaved();
      toast("Frame added. Name it on the right. Drag cards in to add them.", "info", u ? { label: "Undo", run: u.undo } : undefined);
    },
    [editable, nodes, ver, writes, toast, noteVersions, patchCard, select, onCreated, undo],
  );

  const createFrameAt = useCallback(
    (at: Pt) => void createFrame({ x: snap8(at.x - NEW_FRAME_SIZE.width / 2), y: snap8(at.y - NEW_FRAME_SIZE.height / 2), w: NEW_FRAME_SIZE.width, h: NEW_FRAME_SIZE.height }),
    [createFrame],
  );

  // The Frame tool: a drag draws the frame; a press without one, or one under 160 × 96, makes 480 × 320 centred on it.
  const [drawing, setDrawing] = useState<Rect | null>(null);
  const draw = useRef<{ start: Pt; end: Pt } | null>(null);
  const { frameTool, endFrameTool } = o;
  const onFrameToolPointerDown = useCallback(
    (e: ReactPointerEvent): boolean => {
      if (!frameTool || e.button !== 0 || spaceDown.current) return false;
      const el = e.target as HTMLElement;
      if (el.closest("[data-card], .overview, .react-flow__panel")) return false;
      e.preventDefault();
      e.stopPropagation();
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      draw.current = { start: p, end: p };
      return true;
    },
    [frameTool, rf, spaceDown],
  );
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = draw.current;
      if (!d) return;
      d.end = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setDrawing(rectBetween(d.start, d.end));
    };
    const up = () => {
      const d = draw.current;
      const l = live.current;
      if (!d || !l) return;
      const { endFrameTool, createFrame, createFrameAt } = l;
      draw.current = null;
      setDrawing(null);
      swallowNextClick();
      endFrameTool();
      const r = rectBetween(d.start, d.end);
      if (r.w < FRAME_MIN_SIZE.width || r.h < FRAME_MIN_SIZE.height) createFrameAt({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
      else void createFrame({ x: snap8(r.x), y: snap8(r.y), w: Math.max(FRAME_MIN_SIZE.width, snap8(r.w)), h: Math.max(FRAME_MIN_SIZE.height, snap8(r.h)) });
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !draw.current) return;
      draw.current = null;
      setDrawing(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", key, true);
    };
  }, [rf]);

  useEffect(() => {
    live.current = { saveLayout, resize, select, patchFrames, createFrame, createFrameAt, endFrameTool };
  });

  // ---- the frame's actions (toolbox, panel, Delete key) ----
  const membersOf = useCallback((frameId: Uuid) => nodes().filter((n) => n.data.card.frameId === frameId), [nodes]);

  const deleteFrame = useCallback(
    (frameId: Uuid) => {
      const f = framesRef.current.find((x) => x.id === frameId);
      if (!editable || !f) return;
      const members = membersOf(frameId).map((n) => n.id);
      enqueueGroup([frameId, ...members], async () => {
        let result: WriteResult<{ name: string; released: number }>;
        try {
          result = await writes.deleteFrame({ frameId, expectedVersion: ver(frameId), cards: members.map((id) => ({ canvasItemId: id, expectedVersion: ver(id) })) });
        } catch {
          result = FAILED;
        }
        if (!result.ok) {
          toast(result.message, "refusal");
          return;
        }
        setFrames((fs) => fs.filter((x) => x.id !== frameId));
        for (const id of members) {
          patchCard(id, { frameId: null });
          versions.current.set(id, ver(id) + 1);
        }
        select(null);
        const u = undo();
        u?.noteSaved();
        toast(`Deleted the frame ${result.value.name}. Everything inside stays on the canvas.`, "info", u ? { label: "Undo", run: u.undo } : undefined);
      });
    },
    [editable, membersOf, enqueueGroup, writes, ver, toast, patchCard, versions, select, undo],
  );

  const fitFrame = useCallback(
    (frameId: Uuid) => {
      const f = framesRef.current.find((x) => x.id === frameId);
      if (!editable || !f) return;
      const members = membersOf(frameId);
      if (!members.length) {
        toast("This frame is empty. Drag cards into it first.");
        return;
      }
      const r = frameAround(members.map((n) => ({ x: n.data.card.x, y: n.data.card.y, width: cardWidth(n.data.card), height: cardHeight(n.data.card) })));
      const rect = { id: frameId, x: r.x, y: r.y, width: Math.max(FRAME_MIN_SIZE.width, r.width), height: Math.max(FRAME_MIN_SIZE.height, r.height) };
      const cards = planCards();
      const changes = planReframe(framesRef.current.map(boxOf), cards, rect);
      const back = new Map(changes.map((c) => [c.cardId, cards.find((x) => x.id === c.cardId)!.frameId]));
      patchFrames(new Map([[frameId, rect]]));
      for (const c of changes) patchCard(c.cardId, { frameId: c.frameId });
      const ids = cards.map((c) => c.id);
      enqueueGroup([frameId, ...ids], async () => {
        let result: WriteResult<Versions>;
        try {
          result = await writes.fitFrame({ frameId, expectedVersion: ver(frameId), cards: cards.map((c) => ({ canvasItemId: c.id, expectedVersion: ver(c.id), height: c.height })) });
        } catch {
          result = FAILED;
        }
        if (result.ok) {
          noteVersions(result.value.versions);
          undo()?.noteSaved();
        } else if (!/Nothing to change/.test(result.message)) {
          patchFrames(new Map([[frameId, { x: f.x, y: f.y, width: f.width, height: f.height }]]));
          for (const [id, frame] of back) patchCard(id, { frameId: frame });
          toast(result.message, "refusal");
        }
      });
    },
    [editable, membersOf, toast, planCards, patchFrames, patchCard, enqueueGroup, writes, ver, noteVersions, undo],
  );

  const zoomToFrame = useCallback(
    (frameId: Uuid) => {
      const f = framesRef.current.find((x) => x.id === frameId);
      // room for the label above it (prototype: 30 px)
      if (f) void rf.fitBounds({ x: f.x, y: f.y - 30, width: f.width, height: f.height + 30 }, { duration: 250, padding: 0.08 });
    },
    [rf],
  );

  const { selectCards } = o;
  const selectFrameCards = useCallback((frameId: Uuid) => selectCards(membersOf(frameId).map((n) => n.id)), [selectCards, membersOf]);

  const updateFrame = useCallback(
    (frameId: Uuid, patch: FramePatch) =>
      new Promise<boolean>((resolve) => {
        if (!editable || !framesRef.current.some((x) => x.id === frameId)) {
          resolve(false);
          return;
        }
        enqueueGroup([frameId], async () => {
          let result: WriteResult<{ frame: Frame }>;
          try {
            result = await writes.updateFrame({ frameId, expectedVersion: ver(frameId), ...patch });
          } catch {
            result = FAILED;
          }
          if (!result.ok) {
            toast(result.message, "refusal");
            resolve(false);
            return;
          }
          const r = result.value.frame;
          versions.current.set(frameId, r.version);
          patchFrames(new Map([[frameId, { name: r.name, kind: r.kind, conceptId: r.concept_id, sourceSystemId: r.source_system_id, color: r.color, version: r.version }]]));
          undo()?.noteSaved();
          resolve(true);
        });
      }),
    [editable, enqueueGroup, writes, ver, toast, versions, patchFrames, undo],
  );

  /**
   * “Arrange into frames by concept and system” (prototype arrangeLayout): every card and frame of the canvas in one
   * change; the new layout comes back from the server and is shown at once, then the view fits it.
   */
  const arrangeIntoFrames = useCallback(
    (fit: () => void) => {
      if (!editable) return;
      const all = nodes();
      if (!all.length) {
        toast("Add some cards to the canvas first.");
        return;
      }
      const frameIds = framesRef.current.map((f) => f.id);
      enqueueGroup([...frameIds, ...all.map((n) => n.id)], async () => {
        let result: Awaited<ReturnType<FrameWrites["arrangeIntoFrames"]>>;
        try {
          result = await writes.arrangeIntoFrames({
            frames: frameIds.map((id) => ({ frameId: id, expectedVersion: ver(id) })),
            cards: all.map((n) => ({ canvasItemId: n.id, expectedVersion: ver(n.id), height: cardHeight(n.data.card) })),
          });
        } catch {
          result = FAILED;
        }
        if (!result.ok) {
          toast(result.message, "refusal");
          return;
        }
        const { versions: v, built, cards, frames: n } = result.value;
        noteVersions(v);
        setFrames((fs) => [...fs.filter((f) => f.kind === "free"), ...buildFrames(built)]);
        for (const c of cards) patchCard(c.id, { x: c.x, y: c.y, frameId: c.frameId });
        select(null);
        const u = undo();
        u?.noteSaved();
        setTimeout(fit, 0);
        toast(`Arranged the canvas into ${n} frames. Undo restores your previous layout.`, "info", u ? { label: "Undo", run: u.undo } : undefined);
      });
    },
    [editable, nodes, toast, enqueueGroup, writes, ver, noteVersions, patchCard, select, undo],
  );

  const viewOf = useCallback(
    (frame: FrameData, cards: readonly CardData[]): FrameView => {
      const members = cards.filter((c) => c.frameId === frame.id);
      const asFrame = { kind: frame.kind, concept_id: frame.conceptId, source_system_id: frame.sourceSystemId };
      return {
        frame,
        cardIds: members.map((c) => c.id),
        members: members.map((c) => ({ id: c.id, kind: c.kind, targetId: c.targetId, name: c.name, misplaced: isMisplaced(asFrame, c.subject) })),
        stats: frameStats(frame, members),
      };
    },
    [],
  );
  const cardsNow = useCallback(() => nodes().map((n) => n.data.card), [nodes]);
  const frameView = useCallback(
    (frameId: Uuid) => {
      const frame = framesRef.current.find((x) => x.id === frameId);
      return frame ? viewOf(frame, cardsNow()) : null;
    },
    [viewOf, cardsNow],
  );
  const framesView = useCallback(() => {
    const cards = cardsNow();
    return framesRef.current.map((f) => viewOf(f, cards));
  }, [viewOf, cardsNow]);
  const cardFrame = useCallback(
    (cardId: Uuid) => {
      const id = (rf.getNode(cardId) as CardNodeT | undefined)?.data.card.frameId;
      return (id && framesRef.current.find((f) => f.id === id)) || null;
    },
    [rf],
  );
  const frameAt = useCallback((at: Pt) => smallestFrameAt(framesRef.current, at), []);
  const frameRefs = useCallback(() => framesRef.current.map((f) => ({ frameId: f.id, expectedVersion: ver(f.id) })), [ver]);

  /** “Put in a new frame” (a selection) or “Put in a new concept / source system frame” (one card). */
  const putInNewFrame = useCallback(
    (cardIds: readonly Uuid[], fromCard: boolean) => {
      if (!editable || !cardIds.length) return;
      const all = nodes();
      const sized = (n: CardNodeT) => ({ canvasItemId: n.id, expectedVersion: ver(n.id), height: cardHeight(n.data.card) });
      const named = all.filter((n) => cardIds.includes(n.id));
      const others = fromCard ? all.filter((n) => !cardIds.includes(n.id) && n.data.card.frameId === null) : [];
      enqueueGroup([...framesRef.current.map((f) => f.id), ...all.map((n) => n.id)], async () => {
        let result: Awaited<ReturnType<FrameWrites["putInNewFrame"]>>;
        try {
          result = await writes.putInNewFrame({ cards: named.map(sized), ...(fromCard ? { others: others.map(sized) } : {}) });
        } catch {
          result = FAILED;
        }
        if (!result.ok) {
          toast(result.message, "refusal");
          return;
        }
        const { frameId, kind, versions: v } = result.value;
        noteVersions(v);
        for (const id of Object.keys(v)) if (id !== frameId) patchCard(id, { frameId });
        select({ t: "frame", id: frameId });
        onCreated(frameId);
        const u = undo();
        u?.noteSaved();
        const what = kind === "concept" ? "concept " : kind === "source_system" ? "source system " : "";
        toast(
          fromCard ? "Frame added. Name it on the right. Drag cards in to add them." : `Put ${named.length} cards in a new ${what}frame.`,
          "info",
          u ? { label: "Undo", run: u.undo } : undefined,
        );
      });
    },
    [editable, nodes, ver, enqueueGroup, writes, toast, noteVersions, patchCard, select, onCreated, undo],
  );

  return {
    frames,
    framesNow,
    patchFrames,
    busy: busy || drawing !== null,
    drawing,
    saveLayout,
    onFramePointerDown,
    onFrameToolPointerDown,
    createFrameAt,
    deleteFrame,
    fitFrame,
    zoomToFrame,
    selectFrameCards,
    updateFrame,
    arrangeIntoFrames,
    frameView,
    framesView,
    cardFrame,
    frameAt,
    frameRefs,
    putInNewFrame,
  };
}
