"use client";

// The “Notes” section of the card and frame panels (slice 3a, item 12; prototype notesHere): the notes pinned to this
// card or frame on this canvas, each by its first line (or “Empty note”) with “open” or “resolved”, a link that selects
// the note; then “Add a note” for those who may write notes (readers see the section only when there are notes). It
// reads the notes from the canvas, so it follows them; a note with a draft shows its draft (slice 14a, `NoteRow`).

import { useContext } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import { List, Section, smallButtonClass } from "./fields";
import { usePanel } from "./inspector";
import { NoteRow } from "./note-row";

export function NotesHere({ pin }: { pin: { cardId: Uuid } | { frameId: Uuid } }) {
  const ui = useContext(CanvasUiCtx);
  const p = usePanel();
  const notes = ui.notesView().filter((n) => ("cardId" in pin ? n.pinCardId === pin.cardId : n.pinFrameId === pin.frameId));
  // readers: nothing to show without notes
  if (!notes.length && !p.canNote) return null;
  return (
    <div data-testid="section-notes">
      <Section>Notes</Section>
      {notes.length > 0 && (
        <List testId="list-notes-here">
          {notes.map((n) => (
            <NoteRow key={n.id} id={n.id} text={n.text} meta={n.status === "resolved" ? "resolved" : "open"} onClick={() => ui.showNote(n.id)} testId="item-note-here" />
          ))}
        </List>
      )}
      {p.canNote && (
        <div className="mt-1.5">
          <button type="button" className={smallButtonClass} onClick={() => ui.newNote(pin)} data-testid="button-add-note">
            Add a note
          </button>
        </div>
      )}
    </div>
  );
}
