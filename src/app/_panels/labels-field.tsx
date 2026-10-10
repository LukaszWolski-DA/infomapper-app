"use client";

// The Labels field (slice 3a, prototype labelField, showLblSug, applyLabel, removeLabel): the item's working labels as
// chips (tag icon, the name opens the label, × takes it off) and an input with suggestions: what you type first as
// “Create “{name}”” when no label has that name, then existing labels (exact match, then by item count, then by name,
// at most 8) with their item counts. ↑/↓ move, Enter (or a comma, or Tab with text) picks, Backspace in the empty input
// takes the last label off, Esc closes the list; the input keeps the focus after adding or removing. Labels are kept
// apart from the model (D-08). One component for every panel that labels something: it takes the item, the labels
// and the links, and calls the label actions itself.

import { useMemo, useRef, useState } from "react";
import { addLabelAction, removeLabelAction } from "@/app/_actions/label";
import { useAction } from "@/app/_components/use-action";
import type { Uuid } from "@/domain/ids";
import { labelItemCounts, labelSuggestions, marks, normalizeLabelName, type LabelTarget } from "@/domain/model/labels";
import type { Label, LabelLink } from "@/domain/types";
import { Field } from "./fields";

/** How the × names the item: “Remove from this {noun}”. */
const NOUN: Record<LabelTarget["kind"], string> = {
  entity: "entity",
  attribute: "attribute",
  mapping: "mapping",
  source_table: "table",
  source_column: "column",
};

export const TagIcon = ({ className = "size-3" }: { className?: string }) => (
  <svg viewBox="0 0 16 16" aria-hidden className={`flex-none fill-none stroke-current [stroke-linejoin:round] [stroke-width:1.5] ${className}`}>
    <path d="M8.5 2.5h5v5l-6 6-5-5z" />
    <circle cx="11" cy="5" r="0.9" />
  </svg>
);

type Item = { kind: "new"; name: string } | { kind: "use"; label: Label; items: number };

export interface LabelsFieldProps {
  workspaceId: Uuid;
  target: LabelTarget;
  /** The workspace's live labels and links. */
  labels: readonly Label[];
  links: readonly LabelLink[];
  /** May change labels (owner, admin, modeler; not archived). Others see the chips only. */
  editable: boolean;
  /** Opens a label's panel (a chip's name). */
  onOpen: (labelId: Uuid) => void;
}

export function LabelsField({ workspaceId, target, labels, links, editable, onOpen }: LabelsFieldProps) {
  const { run, pending } = useAction();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const byId = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const mine = useMemo(
    () => links.filter((k) => marks(k, target) && byId.has(k.label_id)).map((k) => ({ link: k, label: byId.get(k.label_id)! })),
    [links, target, byId],
  );
  const items = useMemo<Item[]>(() => {
    const s = labelSuggestions(labels, links, text, new Set(mine.map((m) => m.label.id)));
    const counts = labelItemCounts(links);
    return [...(s.create ? [{ kind: "new" as const, name: s.create }] : []), ...s.labels.map((label) => ({ kind: "use" as const, label, items: counts.get(label.id) ?? 0 }))];
  }, [labels, links, text, mine]);
  const at = Math.min(index, Math.max(0, items.length - 1));
  const keepFocus = () => setTimeout(() => input.current?.focus(), 0);

  async function apply(item: Item | undefined) {
    if (!item || pending) return;
    setText("");
    setIndex(0);
    await run(() => addLabelAction(workspaceId, item.kind === "use" ? { target, labelId: item.label.id } : { target, name: item.name }));
    keepFocus();
  }

  async function remove(link: LabelLink) {
    if (pending) return;
    await run(() => removeLabelAction(workspaceId, { labelLinkId: link.id, expectedVersion: link.version }));
    keepFocus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    e.stopPropagation();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      setOpen(true);
      setIndex((at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    } else if (e.key === "Enter" || e.key === "," || (e.key === "Tab" && text.trim())) {
      e.preventDefault();
      const typed = normalizeLabelName(text);
      void apply(open && items[at] ? items[at] : typed ? { kind: "new", name: typed } : undefined);
    } else if (e.key === "Backspace" && !text && mine.length) {
      e.preventDefault();
      void remove(mine[mine.length - 1]!.link);
    } else if (e.key === "Escape") {
      if (open && items.length) setOpen(false);
      else input.current?.blur();
    }
  }

  return (
    <Field label="Labels" htmlFor={editable ? "f-labels" : undefined}>
      <div
        className={`flex min-h-[34px] flex-wrap items-center gap-1.5 rounded-md border border-im-line bg-im-surface px-1.5 py-1 ${editable ? "cursor-text focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-im-logical" : ""}`}
        data-testid="field-labels"
        onPointerDown={(e) => {
          if (editable && e.target === e.currentTarget) {
            e.preventDefault();
            input.current?.focus();
          }
        }}
      >
        {mine.map(({ link, label }) => (
          <span
            key={link.id}
            className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-xl border border-dashed border-im-ink-3 bg-im-hover pl-[7px] pr-0.5 text-xs text-im-ink"
            data-testid="chip-label"
            data-label={label.name}
          >
            <span className="text-im-ink-3">
              <TagIcon />
            </span>
            <button type="button" className="hover:underline" title="Open the label: see everything it marks" onClick={() => onOpen(label.id)} data-testid="button-label-open">
              {label.name}
            </button>
            {editable ? (
              <button
                type="button"
                className="size-[18px] rounded-full p-0 text-sm leading-none text-im-ink-3 hover:bg-im-line hover:text-im-ink"
                aria-label={`Remove label ${label.name}`}
                title={`Remove from this ${NOUN[target.kind]}`}
                onClick={() => void remove(link)}
                data-testid="button-label-remove"
              >
                ×
              </button>
            ) : (
              <span className="w-1" />
            )}
          </span>
        ))}
        {editable && (
          <input
            ref={input}
            id="f-labels"
            value={text}
            placeholder={mine.length ? "Add another…" : "Add a label, e.g. CR-23"}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls="f-labels-suggestions"
            className="min-w-[120px] flex-1 border-0 bg-transparent px-0.5 py-[3px] outline-none"
            data-testid="input-label"
            onChange={(e) => {
              setText(e.target.value);
              setIndex(0);
              setOpen(true);
            }}
            onFocus={() => {
              setIndex(0);
              setOpen(true);
            }}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
          />
        )}
        {!editable && !mine.length && <span className="px-0.5 text-im-ink-3">None</span>}
      </div>
      {editable && open && items.length > 0 && (
        <div
          id="f-labels-suggestions"
          role="listbox"
          className="mt-1 flex flex-col rounded-lg bg-im-surface p-1 shadow-[0_0_0_1px_var(--im-line),0_10px_24px_-12px_var(--im-shadow)]"
          data-testid="list-label-suggestions"
        >
          {items.map((it, i) => (
            <button
              key={it.kind === "new" ? "new" : it.label.id}
              type="button"
              role="option"
              aria-selected={i === at}
              tabIndex={-1}
              className={`flex items-center gap-2 rounded-[5px] px-2 py-1.5 text-left text-im-ink hover:bg-im-hover ${i === at ? "bg-im-hover" : ""}`}
              data-testid="option-label"
              data-kind={it.kind}
              onPointerDown={(e) => {
                e.preventDefault();
                void apply(it);
              }}
            >
              {it.kind === "use" && (
                <span className="text-im-ink-3">
                  <TagIcon />
                </span>
              )}
              <span className={`min-w-0 flex-1 truncate ${it.kind === "new" ? "font-medium text-im-logical" : ""}`}>
                {it.kind === "new" ? `Create “${it.name}”` : it.label.name}
              </span>
              <span className="text-[11.5px] text-im-ink-3">{it.kind === "new" ? "new label" : `${it.items} item${it.items === 1 ? "" : "s"}`}</span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-[5px] text-[11.5px] text-im-ink-3">Working labels for tickets and change requests. Kept apart from the model definition.</p>
    </Field>
  );
}
