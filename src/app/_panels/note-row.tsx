"use client";

// A note's row in the panels' lists (slice 14a, N4 as completed in step 4, answer (a)): "Notes on this canvas", a card's
// or frame's "Notes" and the selection's list show a note by the first line of its draft when it has one, as the canvas
// does, and a refused draft's row says "Not saved", the text of the note's mark. Each row reads only its own note's draft
// (`useNoteDraft`), so a draft re-renders that row, never the list or the canvas; typing renders nothing until a save
// starts.

import { useContext, type ReactNode } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import { firstLine } from "@/canvas/note-data";
import { useNoteDraft } from "@/canvas/note-drafts";
import type { Uuid } from "@/domain/ids";
import { Li } from "./fields";

export function NoteRow({ id, text, meta, onClick, testId }: { id: Uuid; text: string; meta?: ReactNode; onClick?: () => void; testId?: string }) {
  const ui = useContext(CanvasUiCtx);
  const draft = useNoteDraft(ui.noteDrafts(), id);
  const shown = draft ? draft.text : text;
  const marked = draft?.refusal
    ? <span className="font-medium text-im-warn" data-testid="note-row-not-saved">Not saved</span>
    : meta;
  return (
    <Li meta={marked} onClick={onClick} testId={testId}>
      {firstLine(shown) || "Empty note"}
    </Li>
  );
}
