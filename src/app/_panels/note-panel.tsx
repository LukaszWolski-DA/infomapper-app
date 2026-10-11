"use client";

// The note panel (slice 3a, item 11; prototype insNote): “Note on this canvas”, its text (plain text until the editor,
// AD-30), status Open / Resolved, colour, what it is attached to (the card or frame, with “Unpin”) or “A free note”
// (with “Pin to”), “Created {date} by {name}.” (Łukasz's step 0 answer 4), and “Edit on the canvas” and “Delete note”.
// It reads the note from the canvas (`noteView`), so it shows a change at once. Readers see it read-only.

import { useContext } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import { noteDate } from "@/canvas/note-data";
import type { Uuid } from "@/domain/ids";
import { NOTE_COLORS } from "@/domain/types";
import { Actions, buttonClass, dangerClass, Field, inputClass, Kind, Li, List, Section, Seg, smallButtonClass, TextArea } from "./fields";
import { usePanel } from "./inspector";

const COLOR_LABEL = { yellow: "Yellow", blue: "Blue", green: "Green", pink: "Pink", grey: "Grey" } as const;

export function NotePanel({ noteId }: { noteId: Uuid }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const view = ui.noteView(noteId);
  if (!view) return null;
  const n = view.note;
  const can = p.canNote && !view.draft;
  const created = `Created ${noteDate(n.createdAt)}${n.createdBy ? ` by ${n.createdBy}` : ""}.`;

  if (view.draft) {
    return (
      <div data-testid="panel-note">
        <Kind>Note on this canvas</Kind>
        <p className="text-im-ink-2">A new note: write it on the canvas. It is saved when you leave it with text, and disappears when it stays empty.</p>
      </div>
    );
  }

  return (
    <div data-testid="panel-note">
      <Kind>Note on this canvas</Kind>
      <Field label="Text" htmlFor="f-nt">
        <TextArea
          key={`${n.id}:${n.version}`}
          id="f-nt"
          value={n.text}
          readOnly={!can}
          placeholder="Summary, observation or question."
          onSave={(text) => ui.updateNote(n.id, { text })}
          data-testid="input-note-panel-text"
        />
      </Field>
      <Field label="Status">
        <Seg
          value={n.status}
          options={[
            ["open", "Open"],
            ["resolved", "Resolved"],
          ]}
          disabled={!can}
          onChange={(status) => ui.updateNote(n.id, { status })}
          testId="seg-note-status"
        />
      </Field>
      <Field label="Colour">
        <div className="flex gap-2" role="group" data-testid="swatches-note-color">
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={!can}
              aria-pressed={n.color === c}
              aria-label={COLOR_LABEL[c]}
              title={COLOR_LABEL[c]}
              className={`nsw c-${c}`}
              onClick={() => n.color !== c && ui.updateNote(n.id, { color: c })}
            />
          ))}
        </div>
      </Field>

      <Section>Attached to</Section>
      {view.pinnedTo ? (
        <>
          <List>
            <Li
              meta="pinned"
              testId="item-note-pinned"
              onClick={() => {
                const to = view.pinnedTo!;
                if (to.kind === "frame") ui.select({ t: "frame", id: to.id });
                else {
                  ui.select({ t: "card", id: to.id });
                  ui.centerOn(to.id);
                }
              }}
            >
              {view.pinnedTo.name}
            </Li>
          </List>
          {can && (
            <div className="mt-1.5">
              <button type="button" className={smallButtonClass} onClick={() => ui.unpinNote(n.id)} data-testid="button-note-unpin">
                Unpin (make it a free note)
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-im-ink-2" data-testid="text-note-free">
            A free note{view.frameName ? `, inside the frame ${view.frameName}` : ""}.
          </p>
          {can && (
            <Field label="Pin to" htmlFor="f-np">
              <select
                id="f-np"
                value=""
                className={inputClass}
                data-testid="select-note-pin"
                onChange={(e) => {
                  const t = view.targets.find((x) => `${x.kind}:${x.id}` === e.target.value);
                  if (t) ui.pinNote(n.id, t.kind === "card" ? { cardId: t.id } : { frameId: t.id });
                }}
              >
                <option value="">Choose a card or frame…</option>
                {view.targets.map((t) => (
                  <option key={`${t.kind}:${t.id}`} value={`${t.kind}:${t.id}`}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </>
      )}
      <p className="mt-3 text-xs text-im-ink-3" data-testid="text-note-created">
        {created} Notes belong to this canvas and to your working layer, not to the model.
      </p>
      {can && (
        <Actions>
          <button type="button" className={buttonClass} onClick={() => ui.editNote(n.id)} data-testid="button-note-edit">
            Edit on the canvas
          </button>
          <button type="button" className={dangerClass} onClick={() => ui.deleteNote(n.id)} data-testid="button-note-delete">
            Delete note
          </button>
        </Actions>
      )}
    </div>
  );
}
