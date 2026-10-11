"use client";

// The notes of a canvas (slice 3a; prototype renderNotes, .nt): their own layer in the viewport, above the frames and
// the cards (React Flow's viewport portal comes after the nodes), so a note is hit before what lies under it. Not React
// Flow nodes, not children of cards or frames: each note is placed from data (`noteAt`). Header: a note icon, “Note” or
// “on {card or frame}”, the ✓ that resolves it (↺ reopens). Body: the text, or “Empty note”; while editing a
// textarea (Ctrl+Enter or a click outside saves, Esc cancels). Footer: the date, and “resolved”. The right edge changes
// the width. Below 40 % zoom a note draws its header and a plain body of the same height (AD-24 rule 1). Colours are
// mixed in CSS, never `opacity` (AD-24 rule 4); nothing here re-renders while the canvas is idle or only panned.

import { memo, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useStore, ViewportPortal } from "@xyflow/react";
import type { Uuid } from "@/domain/ids";
import { LOD_ZOOM } from "./geometry";
import { noteDate, type NoteData } from "./note-data";

export interface ShownNote {
  note: NoteData;
  x: number;
  y: number;
  /** The card or frame it is pinned to, by name; null for a free note. */
  pinName: string | null;
  /** Its height as last measured (the plain body below 40 %). */
  height: number | undefined;
}

interface Props {
  notes: readonly ShownNote[];
  selectedId: Uuid | null;
  editingId: Uuid | null;
  canNote: boolean;
  onPointerDown: (e: ReactPointerEvent, id: Uuid, part: "body" | "resize") => void;
  onToggleStatus: (id: Uuid) => void;
  onEdit: (id: Uuid) => void;
  onCommit: (id: Uuid, text: string) => void;
  onCancel: (id: Uuid) => void;
  onHeight: (id: Uuid, h: number) => void;
}

const NoteIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden>
    <path d="M3 2.5h10v7.5l-3.5 3.5H3z" />
    <path d="M13 10H9.5v3.5" />
  </svg>
);

function NoteLayer({ notes, selectedId, editingId, canNote, onPointerDown, onToggleStatus, onEdit, onCommit, onCancel, onHeight }: Props) {
  const lod = useStore((s) => s.transform[2] < LOD_ZOOM);
  return (
    <ViewportPortal>
      <div className="note-layer" data-testid="layer-notes">
        {notes.map((s) => (
          <NoteBox
            key={s.note.id}
            shown={s}
            selected={s.note.id === selectedId}
            editing={s.note.id === editingId}
            lod={lod}
            canNote={canNote}
            onPointerDown={onPointerDown}
            onToggleStatus={onToggleStatus}
            onEdit={onEdit}
            onCommit={onCommit}
            onCancel={onCancel}
            onHeight={onHeight}
          />
        ))}
      </div>
    </ViewportPortal>
  );
}

const NoteBox = memo(function NoteBox({
  shown: { note: n, x, y, pinName, height: measured },
  selected,
  editing,
  lod,
  canNote,
  onPointerDown,
  onToggleStatus,
  onEdit,
  onCommit,
  onCancel,
  onHeight,
}: Omit<Props, "notes" | "selectedId" | "editingId"> & { shown: ShownNote; selected: boolean; editing: boolean; lod: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const resolved = n.status === "resolved";
  // its height is measured (it depends on the text) for the tether and the plain body below 40 %
  const height = useRef(0);
  useLayoutEffect(() => {
    const box = el.current;
    if (!box) return;
    const report = () => {
      const h = box.offsetHeight;
      if (h && h !== height.current) {
        height.current = h;
        onHeight(n.id, h);
      }
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(box);
    return () => ro.disconnect();
  }, [n.id, onHeight]);

  return (
    <div
      ref={el}
      className={`nt c-${n.color}${selected ? " sel" : ""}${resolved ? " resolved" : ""}${canNote ? " movable" : ""}`}
      style={{ left: x, top: y, width: n.width }}
      data-note={n.id}
      data-testid="note"
      data-status={n.status}
      data-color={n.color}
      data-pinned={pinName ? "true" : undefined}
      title={`${pinName ? `Pinned to ${pinName}. ` : ""}${canNote ? "Double-click to edit." : ""}`}
      onPointerDown={(e) => onPointerDown(e, n.id, (e.target as HTMLElement).closest("[data-note-resize]") ? "resize" : "body")}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest("button, textarea, [data-note-resize]")) return;
        onEdit(n.id);
      }}
    >
      <div className="nt-head">
        <NoteIcon />
        {/* 11 px text at about 6.5 px a character, beside the icon, the gaps and the ✓ */}
        <span className={`pin${pinName && (pinName.length + 3) * 6.5 > n.width - 64 ? " clip" : ""}`} data-testid="note-pin">
          {pinName ? `on ${pinName}` : "Note"}
        </span>
        <span className="sp" />
        {canNote && (
          <button
            type="button"
            className="ib"
            title={resolved ? "Reopen" : "Mark as resolved"}
            data-testid="button-note-resolve"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onToggleStatus(n.id)}
          >
            {resolved ? "↺" : "✓"}
          </button>
        )}
      </div>
      {editing ? (
        <NoteEditor text={n.text} onCommit={(t) => onCommit(n.id, t)} onCancel={() => onCancel(n.id)} />
      ) : lod ? (
        <div className="nt-lod" style={{ height: Math.max(20, (measured ?? 80) - 26) }} />
      ) : (
        <>
          <div className={`nt-body${n.text ? "" : " empty"}`} data-testid="note-text">
            {n.text || "Empty note"}
          </div>
          <div className="nt-foot">
            {noteDate(n.createdAt)}
            {resolved && <span className="ok">resolved</span>}
          </div>
        </>
      )}
      {canNote && <div className="nt-rs" data-note-resize title="Drag to change the width" data-testid="note-resize" />}
    </div>
  );
});

/** Writing a note in place (prototype startEditNote): grows with the text; Ctrl+Enter or leaving it saves, Esc cancels. */
function NoteEditor({ text, onCommit, onCancel }: { text: string; onCommit: (text: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const cancelled = useRef(false);
  const grow = () => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  };
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    grow();
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, []);
  return (
    <textarea
      ref={ref}
      defaultValue={text}
      placeholder="Summary, observation or question…"
      data-testid="input-note-text"
      className="nodrag nowheel"
      onInput={grow}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          cancelled.current = true;
          e.currentTarget.blur();
        } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => (cancelled.current ? onCancel() : onCommit(e.currentTarget.value))}
    />
  );
}

export default memo(NoteLayer);
