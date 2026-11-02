"use client";

// A rich-text field in a panel (slice 4a, PRD item 19, prototype richField): the stored text shown formatted and
// shortened, “Edit”, and “Show more” only when the text is cut; a click on the text opens the editor dialog. Empty, it
// shows a hint. Reviewers and readers see the text without “Edit”, and a click opens nothing. The HTML comes from the
// server, which sanitized it when it was stored (AD-17). Saving is one undo step and toasts “Saved.”

import { useLayoutEffect, useRef, useState } from "react";
import { shownHtml } from "@/domain/model/plain-text";
import { useToast } from "@/ui/components/toast";
import { storedBy, type SaveAnswer } from "@/ui/field-draft";
import { RichTextDialog } from "./rich-text-dialog";
import type { RichTextEditorHandle } from "./rich-text-editor";

export interface RichTextFieldProps {
  label: string;
  /** The stored HTML and its plain text (`shownHtml` shows plain text as escaped paragraphs, never as HTML). */
  html: string | null;
  text?: string | null;
  /** The hint when empty. */
  empty: string;
  editable: boolean;
  subtitle: string;
  title: string;
  template?: string | null;
  /** Saves the editor's HTML; the answer says whether the server took it, and why not (slice 13). */
  onSave: (html: string) => Promise<SaveAnswer>;
  testId: string;
}

export function RichTextField({ label, html: stored, text = null, empty, editable, subtitle, title, template = null, onSave, testId }: RichTextFieldProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [more, setMore] = useState(false);
  const [cut, setCut] = useState(false);
  const view = useRef<HTMLDivElement>(null);
  const editor = useRef<RichTextEditorHandle>(null);
  const html = shownHtml(stored, text);
  const has = !!html;
  /** The stored HTML the dialog was opened on (or last took), and a refused save's mark (slice 13, F4). */
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);
  const conflict = refused && stored !== openedOn;
  const openEditor = () => {
    setOpenedOn(stored);
    setRefused(false);
    setOpen(true);
  };

  useLayoutEffect(() => {
    const el = view.current;
    // measured after layout: whether the preview is cut
    if (el) setCut(el.scrollHeight > el.clientHeight + 2);
  }, [html, more]);

  const save = async (value: string, changed: boolean) => {
    // a conflict is settled by "Use this" or "Keep mine", never by Save (F6)
    if (conflict) return;
    if (!changed) {
      setOpen(false);
      return;
    }
    setSaving(true);
    const answer = await onSave(value);
    setSaving(false);
    if (storedBy(answer)) {
      setOpen(false);
      setRefused(false);
      toast("Saved.");
    } else if (answer && typeof answer === "object" && (answer.code === "stale_version" || answer.code === "cut")) setRefused(true);
  };
  /** "Use this": the editor takes the newest stored text and stays open. */
  const takeStored = () => {
    editor.current?.replace(html ?? "");
    setOpenedOn(stored);
    setRefused(false);
  };
  /** "Keep mine": the editor's text is saved on the newest version. */
  const keepMine = () => {
    setOpenedOn(stored);
    setRefused(false);
    // the next render has no conflict: Save goes through
    setTimeout(() => editor.current?.save(), 0);
  };
  const notice = refused ? (
    conflict ? (
      <RichConflict html={html} text={text ?? ""} onUse={takeStored} onKeep={keepMine} />
    ) : (
      <div className="border-t border-im-line px-4 py-2 text-xs font-medium text-im-warn" data-testid="draft-not-saved">
        Not saved
      </div>
    )
  ) : null;

  return (
    <div className="mt-3" data-testid={testId}>
      <div className="mb-1 block text-[11.5px] text-im-ink-3">{label}</div>
      <div
        ref={view}
        role={editable ? "button" : undefined}
        tabIndex={editable ? 0 : undefined}
        title={editable ? "Click to edit (opens the editor)" : undefined}
        onClick={editable ? openEditor : undefined}
        onKeyDown={editable ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openEditor()) : undefined}
        className={`rt-view rich ${more ? "open" : ""} ${has ? "" : "empty"} ${editable ? "cursor-text hover:border-im-ink-3" : "cursor-default"}`}
        data-testid={`${testId}-view`}
        // sanitized by the server when stored (AD-17)
        {...(has ? { dangerouslySetInnerHTML: { __html: html! } } : { children: empty })}
      />
      {(editable || cut || more) && (
        <div className="mt-1 flex gap-1.5">
          {editable && (
            <button type="button" className="h-6 rounded-md border border-im-line bg-im-surface px-2 text-xs hover:bg-im-hover" onClick={openEditor} data-testid={`${testId}-edit`}>
              Edit
            </button>
          )}
          {(cut || more) && (
            <button type="button" className="h-6 rounded-md border border-im-line bg-im-surface px-2 text-xs hover:bg-im-hover" onClick={() => setMore((m) => !m)} data-testid={`${testId}-more`}>
              {more ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
      {open && (
        <RichTextDialog
          open
          subtitle={subtitle}
          title={title}
          html={html ?? ""}
          template={template}
          saving={saving || conflict}
          onSave={(v, c) => void save(v, c)}
          onClose={() => {
            setOpen(false);
            setRefused(false);
          }}
          notice={notice}
          editorRef={editor}
        />
      )}
    </div>
  );
}

/** The other text's fold: more than three lines or about 240 characters, counted from its plain text (no layout read). */
const isLong = (text: string): boolean => text.split("\n").length > 3 || text.length > 240;

/**
 * A conflict's line inside the editor dialog (slice 13, F4): "Changed meanwhile to:" with the newest stored text,
 * formatted and folded to three lines by CSS (`line-clamp`), as under a field, or "Cleared meanwhile."; "Use this" and
 * "Keep mine".
 */
function RichConflict({ html, text, onUse, onKeep }: { html: string | null; text: string; onUse: () => void; onKeep: () => void }) {
  const [more, setMore] = useState(false);
  const long = isLong(text);
  const button = "h-[26px] rounded-md border border-im-line bg-im-surface px-[9px] text-xs text-im-ink hover:bg-im-hover";
  return (
    <div className="border-t border-im-line bg-im-warn-soft px-4 py-2 text-xs text-im-ink" data-testid="draft-conflict" role="status">
      {html ? (
        <>
          <div>Changed meanwhile to:</div>
          <div
            // folded: three lines by CSS, the paragraphs' margins off so the clamp ends on the third line (no layout read)
            className={`rich mt-0.5 ${long && !more ? "line-clamp-3 [&_*]:my-0" : "max-h-[30vh] overflow-auto"}`}
            data-testid="draft-other"
            // sanitized by the server when stored (AD-17)
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </>
      ) : (
        <div data-testid="draft-other">Cleared meanwhile.</div>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button type="button" className={button} onClick={onUse} data-testid="button-use-this">
          Use this
        </button>
        <button type="button" className={button} onClick={onKeep} data-testid="button-keep-mine">
          Keep mine
        </button>
        {long && (
          <button type="button" className={button} onClick={() => setMore((m) => !m)} data-testid="button-draft-more">
            {more ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}
