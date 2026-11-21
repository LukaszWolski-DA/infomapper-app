"use client";

// Slice 34 (D-86, the prototype's `#mdDlg`): the document as one Markdown file. The editor builds the text at the click
// from its own tree (D1: the snapshot read when the editor opened, with the text fields' drafts; no request) and hands it
// here; the dialog shows it in a monospaced box with its lines, size and file name, Copy (a toast only once the browser
// took it, F25) and Download .md (F9's name).

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/ui/components/dialog";
import { useToast } from "@/ui/components/toast";

export const MARKDOWN_TEXTS = {
  button: "Markdown",
  title: "Markdown",
  sentence: "This document as one Markdown file: the same sections and language as the PDF; diagrams as Mermaid blocks, page layout left out. For people (a wiki, Git) and for AI.",
  copy: "Copy",
  download: "Download .md",
  copied: "Markdown copied.",
  refused: "The browser did not allow copying. Select the text and copy it.",
  line: (lines: number, kb: string, file: string) => `${lines} lines · ${kb} KB · ${file}`,
} as const;

/** What the dialog shows: the text and its file's name, made at the click. */
export interface MarkdownShown {
  text: string;
  file: string;
}

/** The size as the prototype writes it: the UTF-8 bytes in KB, one decimal. */
export const markdownKb = (text: string): string => (new TextEncoder().encode(text).length / 1024).toFixed(1);

const btnClass = "inline-flex h-[26px] items-center rounded-md border border-im-line bg-im-surface px-[9px] text-xs text-im-ink hover:bg-im-hover";
const primaryClass = "inline-flex h-[26px] items-center rounded-md bg-im-logical px-[9px] text-xs font-medium text-white hover:opacity-90";

export function MarkdownDialog({ shown, onClose }: { shown: MarkdownShown | null; onClose: () => void }) {
  const toast = useToast();
  if (!shown) return null;
  const { text, file } = shown;
  const copy = () => {
    const done = () => toast(MARKDOWN_TEXTS.copied);
    const refused = () => toast(MARKDOWN_TEXTS.refused, "refusal");
    try {
      if (!navigator.clipboard) return refused();
      void navigator.clipboard.writeText(text).then(done, refused);
    } catch {
      refused();
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[min(860px,94vw)] max-w-none grid-cols-[minmax(0,1fr)] gap-0 border-im-line bg-im-surface text-[13px] text-im-ink sm:max-w-none" data-testid="dialog-markdown">
        <DialogTitle className="text-base font-semibold">{MARKDOWN_TEXTS.title}</DialogTitle>
        <DialogDescription asChild>
          <p className="mt-3 text-[13px] text-im-ink">{MARKDOWN_TEXTS.sentence}</p>
        </DialogDescription>
        <pre
          data-testid="text-markdown"
          tabIndex={0}
          className="mt-3 max-h-[56vh] overflow-auto rounded-md border border-im-line bg-im-panel px-3.5 py-3 font-mono text-[12px] leading-normal [overflow-wrap:anywhere] whitespace-pre-wrap text-im-ink"
        >
          {text}
        </pre>
        <p data-testid="text-markdown-line" className="mt-2 text-[12px] text-im-ink-3">
          {MARKDOWN_TEXTS.line(text.split("\n").length, markdownKb(text), file)}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" data-testid="button-markdown-copy" className={btnClass} onClick={copy}>
            {MARKDOWN_TEXTS.copy}
          </button>
          <button type="button" data-testid="button-markdown-download" className={primaryClass} onClick={download}>
            {MARKDOWN_TEXTS.download}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
