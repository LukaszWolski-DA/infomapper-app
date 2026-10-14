"use client";

// The editor inside the rich-text dialog (slice 4a, PRD items 16–17, prototype #rte): toolbar, an inline link field,
// the content, and the footer. Loaded only when a dialog opens for the first time (`rich-text-dialog.tsx`), so the
// canvas page does not carry Tiptap. Esc and Cancel with unsaved changes ask first; Ctrl + Enter saves.

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { editorExtensions, linkTarget, TEXT_COLORS, type TextColor } from "./extensions";

export const FOOTER_HINT = "Ctrl + Enter saves, Esc cancels";
export const UNSAVED_WARNING = "Unsaved changes. Press Esc or Cancel again to discard them.";

/** What the dialog shell asks of the editor: Esc goes through it, so it can close the link field or warn first. */
export interface RichTextEditorHandle {
  escape: () => void;
  /** Ctrl + Enter with the focus elsewhere in the dialog (on a toolbar button). */
  save: () => void;
  /** Puts the focus back into the text (after a click outside the dialog moved it away). */
  focus: () => void;
}

export interface RichTextEditorProps {
  /** The stored HTML, or empty. */
  html: string;
  /** For a requirement description: its kind's template (empty content opens with it; “Insert template” appends it). */
  template: string | null;
  saving: boolean;
  onSave: (html: string, changed: boolean) => void;
  onDiscard: () => void;
  handle?: Ref<RichTextEditorHandle>;
}

const COLOR_TITLES: Record<TextColor, string> = { warn: "Colour: warning", attn: "Colour: attention", ok: "Colour: confirmed", info: "Colour: information" };

/** The first empty paragraph that carries a template hint, as a position inside it. */
function firstEmptyHint(editor: Editor): number | null {
  let at: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (at !== null) return false;
    if (node.type.name === "paragraph" && node.attrs.hint && node.content.size === 0) at = pos + 1;
    return true;
  });
  return at;
}

export default function RichTextEditor({ html, template, saving, onSave, onDiscard, handle }: RichTextEditorProps) {
  const [armed, setArmed] = useState(false);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("");
  const start = useRef<string | null>(null);
  const urlInput = useRef<HTMLInputElement>(null);
  const initial = html.trim() ? html : (template ?? "");
  /** Ctrl + Enter saves; read by the editor's key handling, which runs before Tiptap's own shortcuts (a hard break). */
  const saveRef = useRef<() => void>(() => {});

  const editor = useEditor({
    extensions: editorExtensions(),
    content: initial,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "rte-ed rich", "data-testid": "rte-content", spellcheck: "true", "aria-label": "Text" },
      handleKeyDown: (_view, event) => {
        if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return false;
        event.preventDefault();
        saveRef.current();
        return true;
      },
    },
    onCreate: ({ editor: e }) => {
      start.current = e.getHTML();
      const hint = firstEmptyHint(e);
      if (hint !== null) e.chain().focus().setTextSelection(hint).run();
      else e.commands.focus("end");
    },
    onUpdate: () => setArmed(false),
  });
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            bulletList: e.isActive("bulletList"),
            orderedList: e.isActive("orderedList"),
            superscript: e.isActive("superscript"),
            subscript: e.isActive("subscript"),
            link: e.isActive("link"),
          }
        : null,
  });

  const changed = () => !!editor && editor.getHTML() !== start.current;
  const save = () => {
    if (editor && !saving) onSave(editor.getHTML(), changed());
  };
  useEffect(() => {
    saveRef.current = save;
  });
  const tryCancel = () => {
    if (changed() && !armed) {
      setArmed(true);
      return;
    }
    onDiscard();
  };
  const closeLink = () => {
    setLinking(false);
    editor?.commands.focus();
  };

  useImperativeHandle(handle, () => ({ escape: () => (linking ? closeLink() : tryCancel()), save, focus: () => editor?.commands.focus() }));
  useEffect(() => {
    if (linking) urlInput.current?.focus();
  }, [linking]);

  const addLink = () => {
    const raw = url.trim();
    if (!editor || !raw) return;
    const href = linkTarget(raw);
    const chain = editor.chain().focus();
    if (editor.state.selection.empty) chain.insertContent({ type: "text", text: raw, marks: [{ type: "link", attrs: { href } }] }).run();
    else chain.extendMarkRange("link").setLink({ href }).run();
    setLinking(false);
  };
  const insertTemplate = () => {
    if (!editor || !template) return;
    if (!editor.getText().trim()) editor.commands.setContent(template, { emitUpdate: true });
    else editor.commands.insertContentAt(editor.state.doc.content.size, template);
    const hint = firstEmptyHint(editor);
    if (hint !== null) editor.chain().focus().setTextSelection(hint).scrollIntoView().run();
  };

  const tool = (label: React.ReactNode, title: string, run: () => void, on = false, testId?: string, extra = "") => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={on || undefined}
      data-testid={testId}
      className={`h-7 min-w-7 rounded-[5px] px-1.5 text-[13px] text-im-ink-2 hover:bg-im-hover hover:text-im-ink aria-pressed:bg-im-hover aria-pressed:text-im-ink ${extra}`}
      // keep the selection in the editor
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      disabled={!editor}
    >
      {label}
    </button>
  );
  const sep = <span className="mx-1 h-[18px] w-px bg-im-line" />;
  const chain = () => editor!.chain().focus();

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(e) => {
        if (e.key === "Enter" && !(e.ctrlKey || e.metaKey) && e.target === urlInput.current) {
          e.preventDefault();
          addLink();
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-im-line bg-im-panel px-2.5 py-1.5" role="toolbar" aria-label="Formatting">
        {tool(<b>B</b>, "Bold (Ctrl B)", () => chain().toggleBold().run(), active?.bold, "button-rte-bold")}
        {tool(<i>I</i>, "Italic (Ctrl I)", () => chain().toggleItalic().run(), active?.italic, "button-rte-italic")}
        {sep}
        {TEXT_COLORS.map((c) => (
          <span key={c}>{tool("A", COLOR_TITLES[c], () => chain().setMark("textColor", { color: c }).run(), false, `button-rte-color-${c}`, `font-bold tc-${c}`)}</span>
        ))}
        {tool("⌫", "Clear formatting", () => chain().unsetMark("bold").unsetMark("italic").unsetMark("textColor").unsetMark("superscript").unsetMark("subscript").run(), false, "button-rte-clear")}
        {sep}
        {tool(
          <svg viewBox="0 0 16 16" className="inline size-3.5 fill-none stroke-current stroke-[1.6] [stroke-linecap:round]" aria-hidden>
            <path d="M6.5 9.5l3-3M7 4.5l1.2-1.2a2.8 2.8 0 014 4L11 8.5M9 11.5l-1.2 1.2a2.8 2.8 0 01-4-4L5 7.5" />
          </svg>,
          "Link",
          () => {
            setUrl("");
            setLinking(true);
          },
          active?.link,
          "button-rte-link",
        )}
        {tool("•≡", "Bulleted list", () => chain().toggleBulletList().run(), active?.bulletList, "button-rte-bullets")}
        {tool("1≡", "Numbered list", () => chain().toggleOrderedList().run(), active?.orderedList, "button-rte-numbers")}
        {sep}
        {tool("x²", "Superscript", () => chain().toggleSuperscript().run(), active?.superscript, "button-rte-sup")}
        {tool("x₂", "Subscript", () => chain().toggleSubscript().run(), active?.subscript, "button-rte-sub")}
        <span className="flex-1" />
        {template && (
          <button
            type="button"
            title="Insert the template for this kind of requirement"
            className="h-7 rounded-[5px] border border-im-line bg-im-surface px-2 text-xs text-im-ink-2 hover:bg-im-hover"
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertTemplate}
            data-testid="button-rte-template"
          >
            Insert template
          </button>
        )}
      </div>
      {linking && (
        <div className="flex gap-1.5 border-b border-im-line px-2.5 py-1.5">
          <input
            ref={urlInput}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… or mailto:…"
            autoComplete="off"
            className="h-[30px] flex-1 rounded-md border border-im-line bg-im-surface px-2 text-im-ink outline-none focus:border-im-logical"
            data-testid="input-rte-url"
          />
          <button type="button" className="h-[30px] rounded-md border border-im-line bg-im-surface px-2.5 text-xs hover:bg-im-hover" onClick={addLink} data-testid="button-rte-link-ok">
            Add link
          </button>
          <button type="button" className="h-[30px] rounded-md border border-im-line bg-im-surface px-2.5 text-xs hover:bg-im-hover" onClick={closeLink}>
            Cancel
          </button>
        </div>
      )}
      <div className="min-h-[300px] flex-1 overflow-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
      <div className="flex items-center gap-2 border-t border-im-line px-4 py-2.5 text-xs text-im-ink-3">
        <span className={armed ? "font-medium text-im-warn" : ""} data-testid="text-rte-message" role={armed ? "alert" : undefined}>
          {armed ? UNSAVED_WARNING : FOOTER_HINT}
        </span>
        <span className="flex-1" />
        <button type="button" className="h-8 rounded-md border border-im-line bg-im-surface px-3 text-[13px] text-im-ink hover:bg-im-hover" onClick={tryCancel} data-testid="button-rte-cancel">
          Cancel
        </button>
        <button
          type="button"
          className="h-8 rounded-md bg-im-logical px-3 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          onClick={save}
          disabled={!editor || saving}
          data-testid="button-rte-save"
        >
          Save
        </button>
      </div>
    </div>
  );
}
