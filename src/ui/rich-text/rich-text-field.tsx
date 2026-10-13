"use client";

// A rich-text field in a panel (slice 4a, PRD item 19, prototype richField): the stored text shown formatted and
// shortened, “Edit”, and “Show more” only when the text is cut; a click on the text opens the editor dialog. Empty, it
// shows a hint. Reviewers and readers see the text without “Edit”, and a click opens nothing. The HTML comes from the
// server, which sanitized it when it was stored (AD-17). Saving is one undo step and toasts “Saved.”

import { useLayoutEffect, useRef, useState } from "react";
import { useToast } from "@/ui/components/toast";
import { RichTextDialog } from "./rich-text-dialog";

export interface RichTextFieldProps {
  label: string;
  /** The stored HTML, or null. */
  html: string | null;
  /** The hint when empty. */
  empty: string;
  editable: boolean;
  subtitle: string;
  title: string;
  template?: string | null;
  /** Saves the editor's HTML; resolves to true when the server took it. */
  onSave: (html: string) => Promise<boolean>;
  testId: string;
}

export function RichTextField({ label, html, empty, editable, subtitle, title, template = null, onSave, testId }: RichTextFieldProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [more, setMore] = useState(false);
  const [cut, setCut] = useState(false);
  const view = useRef<HTMLDivElement>(null);
  const has = !!html?.trim();

  useLayoutEffect(() => {
    const el = view.current;
    // measured after layout: whether the preview is cut
    if (el) setCut(el.scrollHeight > el.clientHeight + 2);
  }, [html, more]);

  const save = async (value: string, changed: boolean) => {
    if (!changed) {
      setOpen(false);
      return;
    }
    setSaving(true);
    const ok = await onSave(value);
    setSaving(false);
    if (ok) {
      setOpen(false);
      toast("Saved.");
    }
  };

  return (
    <div className="mt-3" data-testid={testId}>
      <div className="mb-1 block text-[11.5px] text-im-ink-3">{label}</div>
      <div
        ref={view}
        role={editable ? "button" : undefined}
        tabIndex={editable ? 0 : undefined}
        title={editable ? "Click to edit (opens the editor)" : undefined}
        onClick={editable ? () => setOpen(true) : undefined}
        onKeyDown={editable ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(true)) : undefined}
        className={`rt-view rich ${more ? "open" : ""} ${has ? "" : "empty"} ${editable ? "cursor-text hover:border-im-ink-3" : "cursor-default"}`}
        data-testid={`${testId}-view`}
        // sanitized by the server when stored (AD-17)
        {...(has ? { dangerouslySetInnerHTML: { __html: html! } } : { children: empty })}
      />
      {(editable || cut || more) && (
        <div className="mt-1 flex gap-1.5">
          {editable && (
            <button type="button" className="h-6 rounded-md border border-im-line bg-im-surface px-2 text-xs hover:bg-im-hover" onClick={() => setOpen(true)} data-testid={`${testId}-edit`}>
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
        <RichTextDialog open subtitle={subtitle} title={title} html={html ?? ""} template={template} saving={saving} onSave={(v, c) => void save(v, c)} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
