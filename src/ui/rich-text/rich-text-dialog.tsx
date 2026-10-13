"use client";

// The rich-text editor dialog (slice 4a, PRD item 16, prototype #rte, D-42): a subtitle and a title, then the editor,
// which is loaded the first time any dialog opens (React.lazy), so pages carry no Tiptap until then. Keys typed in the
// dialog never reach the canvas or the app's shortcuts (Delete, Ctrl+Z, arrows, Space, E, H): the dialog stops every
// key event from bubbling past it. Esc goes through the editor: it closes the link field, or warns about unsaved
// changes before a second Esc discards them.

import { Dialog as DialogPrimitive } from "radix-ui";
import { lazy, Suspense, useRef } from "react";
import type { RichTextEditorHandle } from "./rich-text-editor";

const RichTextEditor = lazy(() => import("./rich-text-editor"));

export interface RichTextDialogProps {
  open: boolean;
  subtitle: string;
  title: string;
  html: string;
  template?: string | null;
  saving?: boolean;
  /** Saves the HTML; `changed` is false when nothing was edited (the caller then only closes). */
  onSave: (html: string, changed: boolean) => void;
  onClose: () => void;
}

export function RichTextDialog({ open, subtitle, title, html, template = null, saving = false, onSave, onClose }: RichTextDialogProps) {
  const editor = useRef<RichTextEditorHandle>(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && editor.current?.escape()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-[rgba(15,20,30,.45)]" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[90] flex max-h-[90vh] w-[min(760px,96vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-im-surface text-im-ink shadow-[0_0_0_1px_var(--im-line),0_24px_60px_-20px_rgba(0,0,0,.45)] outline-none"
          data-testid="dialog-rich-text"
          aria-describedby={undefined}
          // the editor focuses its first empty section itself
          onOpenAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            editor.current?.escape();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            editor.current?.escape();
          }}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-2.5 border-b border-im-line px-4 pb-2.5 pt-3.5">
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] text-im-ink-3" data-testid="text-rte-subtitle">
                {subtitle}
              </div>
              <DialogPrimitive.Title className="text-[15px] font-semibold">{title}</DialogPrimitive.Title>
            </div>
            <button
              type="button"
              className="size-7 rounded-md text-im-ink-2 hover:bg-im-hover"
              aria-label="Close"
              title="Close (Esc)"
              onClick={() => editor.current?.escape()}
            >
              ✕
            </button>
          </div>
          <Suspense fallback={<div className="min-h-[300px] px-4 py-4 text-im-ink-3">Loading the editor…</div>}>
            <RichTextEditor handle={editor} html={html} template={template} saving={saving} onSave={onSave} onDiscard={onClose} />
          </Suspense>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
