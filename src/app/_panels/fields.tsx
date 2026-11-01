"use client";

// Building blocks of the right panel, styled after the prototype (.fld, .seg, .flags, .note, .list, .li, .pill,
// .actions). Text fields save when they lose the focus (prototype "change"). The panels save through `saveRow`
// (`useAction`, slice 9): one row's saves one after the other, each with the newest version known when it is sent.
// Slice 13 (D-66): a text field keeps what the person typed (its draft, `useDraft`) across the page's fresh values and
// after a refusal; a choice field shows the newest stored value after a refusal (`useChoice`). Fields are keyed by their
// object and field (`fieldKey`), never by their stored value.

import { useEffect, useRef, useState, type ReactNode, type Ref, type TextareaHTMLAttributes } from "react";
import { choiceShown, FieldDraft, storedBy, type Chosen, type SaveAnswer } from "@/ui/field-draft";

export const Kind = ({ children }: { children: ReactNode }) => <div className="mb-1.5 text-[11.5px] text-im-ink-3">{children}</div>;

export const Section = ({ children }: { children: ReactNode }) => (
  <h3 className="mb-2 mt-5 text-xs font-semibold text-im-ink-2">{children}</h3>
);

export const Hint = ({ children }: { children: ReactNode }) => <p className="mt-1 text-im-ink-2">{children}</p>;

export function Field({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="mt-3">
      <label htmlFor={htmlFor} className="mb-1 block text-[11.5px] text-im-ink-3">
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputClass =
  "min-h-8 w-full rounded-md border border-im-line bg-im-surface px-2 py-1.5 text-im-ink outline-none focus:border-im-logical disabled:opacity-50 read-only:bg-im-panel";

/**
 * The key of a panel field that shows the field `field` of the object `id`: stable while the object lives, so a save's
 * answer, an undo or another person's write never mounts it anew (slice 13; keyed by the stored value, text typed
 * during a save's round trip was lost with the field, and keyed by the object's version, a save on leaving one field
 * mounted the next one anew and took the focus Tab had just put there).
 */
export const fieldKey = (id: string, field: string): string => `${id}:${field}`;

/** What a field's save gives back: the action's answer (`ok`, `code`), so the field knows whether it was stored. */
export type FieldSave<V> = (value: V) => SaveAnswer | Promise<SaveAnswer>;

/**
 * A text field's draft (slice 13, D-66; the rules in `src/ui/field-draft.ts`): the element is uncontrolled, so typing
 * renders nothing. A stored value reaches it in an effect, written into the element only while it has neither the
 * focus nor a draft. `commit` (on leaving the field) saves the text when it differs from the value on its way or the
 * stored one; `prepare` trims or parses it (null: nothing to save); an empty `required` field goes back to the stored
 * value (D-59), with `onEmpty` (a toast) where one is wanted.
 */
export function useDraft<E extends HTMLInputElement | HTMLTextAreaElement>(
  stored: string,
  save: FieldSave<string> | undefined,
  o: { prepare?: (text: string) => string | null; required?: boolean; onEmpty?: () => void; readOnly?: boolean; elementRef?: Ref<E> } = {},
) {
  const element = useRef<E | null>(null);
  const [draft] = useState(() => new FieldDraft(stored));
  const [initial] = useState(stored);
  useEffect(() => {
    const el = element.current;
    // a DOM write after the commit, never a layout read (CLAUDE.md, slice 6a)
    if (el && draft.receive(stored, el.value, document.activeElement === el) === "take") el.value = stored;
  }, [stored, draft]);
  const { elementRef } = o;
  /** The element's ref callback. */
  const bind = (el: E | null) => {
    element.current = el;
    if (typeof elementRef === "function") elementRef(el);
    else if (elementRef) (elementRef as { current: E | null }).current = el;
  };
  const commit = () => {
    const el = element.current;
    if (!el || o.readOnly || !save) return;
    const raw = el.value;
    const value = o.prepare ? o.prepare(raw) : raw;
    if (value === null) return;
    if (o.required && !value) {
      el.value = stored;
      draft.reset(stored);
      o.onEmpty?.();
      return;
    }
    if (value !== raw) el.value = value;
    if (!draft.shouldSave(value, stored)) return;
    const n = draft.send(value);
    Promise.resolve(save(value)).then(
      (answer) => draft.answered(n, storedBy(answer)),
      () => draft.answered(n, false),
    );
  };
  return { bind, defaultValue: initial, commit };
}

/**
 * A choice field (a select, a check box; slice 13, R4): the choice shows from the click until the stored value changes;
 * after a refusal the field shows the stored value, which the refusal's fresh page brings.
 */
export function useChoice<T>(stored: T, save: FieldSave<T>) {
  const [chosen, setChosen] = useState<Chosen<T> | null>(null);
  const value = choiceShown(chosen, stored);
  const choose = (next: T) => {
    if (Object.is(next, value)) return;
    const mine = { value: next, on: stored };
    setChosen(mine);
    const back = () => setChosen((c) => (c === mine ? null : c));
    Promise.resolve(save(next)).then((answer) => storedBy(answer) !== true && back(), back);
  };
  return { value, choose };
}

/** A text field that saves on Enter or when it loses the focus. An empty required field goes back (D-59). */
export function TextField({
  id,
  value,
  onSave,
  readOnly,
  required,
  onEmpty,
  testId,
  inputRef,
  mono,
  placeholder,
}: {
  id?: string;
  value: string;
  onSave: FieldSave<string>;
  readOnly?: boolean;
  required?: boolean;
  /** An empty required field went back (a toast, where the server would have refused it: slice 13, F14). */
  onEmpty?: () => void;
  testId?: string;
  inputRef?: Ref<HTMLInputElement>;
  mono?: boolean;
  placeholder?: string;
}) {
  const { bind: bind, defaultValue: initial, commit: commit } = useDraft<HTMLInputElement>(value, onSave, { prepare: (t) => t.trim(), required, onEmpty, readOnly, elementRef: inputRef });
  return (
    <input
      id={id}
      ref={bind}
      defaultValue={initial}
      readOnly={readOnly}
      placeholder={placeholder}
      data-testid={testId}
      autoComplete="off"
      className={`${inputClass} ${mono ? "font-mono text-xs" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onBlur={commit}
    />
  );
}

/** A plain-text area (definitions, notes, rules; AD-30) that saves when it loses the focus. */
export function TextArea({
  value,
  onSave,
  code,
  ...rest
}: { value: string; onSave: FieldSave<string>; code?: boolean } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "defaultValue">) {
  const { bind: bind, defaultValue: initial, commit: commit } = useDraft<HTMLTextAreaElement>(value, onSave, { readOnly: !!rest.readOnly || !!rest.disabled });
  return (
    <textarea
      {...rest}
      ref={bind}
      defaultValue={initial}
      className={`${inputClass} min-h-[60px] resize-y ${code ? "font-mono text-xs" : ""}`}
      onBlur={(e) => {
        rest.onBlur?.(e);
        commit();
      }}
    />
  );
}

/** Segmented buttons (prototype .seg): one of a few values. */
export function Seg<V extends string>({
  value,
  options,
  onChange,
  disabled,
  testId,
}: {
  value: V;
  options: readonly (readonly [V, string])[];
  onChange: (v: V) => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <div className="inline-flex rounded-[7px] bg-im-hover p-0.5" role="group" data-testid={testId}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          disabled={disabled}
          onClick={() => v !== value && onChange(v)}
          className="h-[26px] whitespace-nowrap rounded-[5px] px-2.5 text-im-ink-2 disabled:cursor-not-allowed aria-pressed:bg-im-surface aria-pressed:text-im-ink aria-pressed:shadow-[0_0_0_1px_var(--im-line),0_1px_2px_var(--im-shadow)]"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** A flag that toggles (prototype .flag). */
export function Flag({ on, label, onToggle, disabled }: { on: boolean; label: string; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onToggle}
      className="rounded-[14px] border border-im-line bg-im-surface px-2.5 py-[3px] text-im-ink-2 disabled:cursor-not-allowed aria-pressed:border-transparent aria-pressed:bg-im-logical-soft aria-pressed:font-medium aria-pressed:text-im-logical"
    >
      {label}
    </button>
  );
}

export const Note = ({ warn, children, testId }: { warn?: boolean; children: ReactNode; testId?: string }) => (
  <div data-testid={testId} className={`mt-3 rounded-md px-2.5 py-2 text-xs text-im-ink ${warn ? "bg-im-warn-soft" : "bg-im-map-soft"}`}>
    {children}
  </div>
);

export const List = ({ children, testId }: { children: ReactNode; testId?: string }) => (
  <div className="flex flex-col gap-0.5" data-testid={testId}>
    {children}
  </div>
);

/** A list row (prototype .li): name, then a muted meta text. Without onClick it is not a button. */
export function Li({ children, meta, onClick, title, testId }: { children: ReactNode; meta?: ReactNode; onClick?: () => void; title?: string; testId?: string }) {
  const body = (
    <>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {meta !== undefined && <span className="whitespace-nowrap text-[11.5px] text-im-ink-3">{meta}</span>}
    </>
  );
  const cls = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left";
  return onClick ? (
    <button type="button" className={`${cls} hover:bg-im-hover`} onClick={onClick} title={title} data-testid={testId}>
      {body}
    </button>
  ) : (
    <div className={cls} title={title} data-testid={testId}>
      {body}
    </div>
  );
}

/** Status dot of a mapping (prototype .st): green fits, orange has a type problem. */
export const TypeDot = ({ ok }: { ok: boolean }) => <span className={`size-2.5 flex-none rounded-full ${ok ? "bg-im-map" : "bg-im-warn"}`} />;

export const Actions = ({ children }: { children: ReactNode }) => <div className="mt-5 flex flex-wrap gap-2">{children}</div>;

export const buttonClass = "h-8 rounded-md border border-im-line bg-im-surface px-3 text-im-ink hover:bg-im-hover disabled:opacity-50";
export const smallButtonClass = "h-[26px] rounded-md border border-im-line bg-im-surface px-[9px] text-xs text-im-ink hover:bg-im-hover";
export const dangerClass = `${buttonClass} text-im-warn`;
export const primaryClass = "h-8 rounded-md border border-im-logical bg-im-logical px-3 font-medium text-im-surface disabled:opacity-50";

/** A select with option groups (columns by table). */
export function GroupedSelect({
  id,
  placeholder,
  groups,
  onPick,
  disabled,
  testId,
}: {
  id?: string;
  placeholder: string;
  groups: { label: string; columns: { id: string; label: string }[] }[];
  onPick: (id: string) => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <select
      id={id}
      value=""
      disabled={disabled}
      data-testid={testId}
      className={inputClass}
      onChange={(e) => e.target.value && onPick(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/**
 * A delete button that asks for a second click (slice 1b keeps it for an attribute with mappings and a table with
 * columns; other deletes go at once with Undo in the toast): the first click turns it into
 * “Click again to delete”, with what goes along; it turns back after a few seconds or when the focus leaves.
 */
/**
 * The second click's text of a delete (slice 1b; slice 10c, F7): "Click again to delete", ", with {also}" for what goes
 * with it, "; {then}" for what it changes elsewhere (an attribute's copies).
 */
export const armedDeleteText = (also?: string, then?: string): string => `Click again to delete${also ? `, with ${also}` : ""}${then ? `; ${then}` : ""}`;

/** A delete that asks for a second click; `armedText` replaces the armed default (slice 12a: "Click again to delete the project"). */
export function ConfirmDelete({
  label,
  also,
  then,
  armedText,
  onConfirm,
  testId,
}: {
  label: string;
  also?: string;
  then?: string;
  armedText?: string;
  onConfirm: () => void;
  testId?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      // armed, the text may name an attribute's copies (slice 10c, F7): the button grows to hold it
      className={armed ? `${dangerClass.replace("h-8", "min-h-8 py-1.5 text-left")} border-im-warn bg-im-warn-soft` : dangerClass}
      data-testid={testId}
      data-armed={armed || undefined}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) setArmed(true);
        else {
          setArmed(false);
          onConfirm();
        }
      }}
    >
      {armed ? (armedText ?? armedDeleteText(also, then)) : label}
    </button>
  );
}

// ---- folding sections and long lists (D-35) ----

const SECTIONS_KEY = "infomapper:sections-shut";
/** Sections fold per title, numbers aside (“Other sources for email” and “… for name” are different titles). */
const sectionKey = (title: string) => title.replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

function readShut(): Set<string> {
  try {
    const v = JSON.parse(window.localStorage.getItem(SECTIONS_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(v) ? v.filter((k): k is string => typeof k === "string") : []);
  } catch {
    return new Set();
  }
}

/** A panel section whose heading folds it; the state is remembered per title in this browser. */
export function Fold({ title, count, children, testId }: { title: string; count?: number; children: ReactNode; testId?: string }) {
  const key = sectionKey(title);
  const [shut, setShut] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only preference, read after mount
    setShut(readShut().has(key));
  }, [key]);
  const toggle = () => {
    const all = readShut();
    if (!all.delete(key)) all.add(key);
    try {
      window.localStorage.setItem(SECTIONS_KEY, JSON.stringify([...all]));
    } catch {
      // not remembered
    }
    setShut(all.has(key));
  };
  return (
    <section data-testid={testId}>
      <h3 className="-ml-1 mb-2 mt-5 text-xs font-semibold text-im-ink-2">
        <button
          type="button"
          aria-expanded={!shut}
          onClick={toggle}
          className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-im-hover hover:text-im-ink"
        >
          <svg viewBox="0 0 16 16" aria-hidden className={`size-2.5 flex-none fill-none stroke-current stroke-[1.8] transition-transform ${shut ? "-rotate-90" : ""}`}>
            <path d="M4 6l4 4 4-4" />
          </svg>
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {count !== undefined && count > 0 && <span className="text-[11.5px] font-normal text-im-ink-3">{count}</span>}
        </button>
      </h3>
      <div hidden={shut}>{children}</div>
    </section>
  );
}

/** Lists over 20 rows get a filter and “Show all” (D-35, prototype foldSections). */
export function LongList<T>({
  items,
  text,
  render,
  testId,
}: {
  items: readonly T[];
  text: (item: T) => string;
  render: (item: T) => ReactNode;
  testId?: string;
}) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const long = items.length > 20;
  const query = q.trim().toLowerCase();
  const hits = query ? items.filter((i) => text(i).toLowerCase().includes(query)) : items;
  const shown = long && !all && !query ? hits.slice(0, 20) : hits;
  return (
    <>
      {long && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Filter ${items.length} items…`}
          aria-label="Filter the list"
          data-testid="input-list-filter"
          className="mb-1.5 h-7 w-full rounded-md border border-im-line bg-im-surface px-2 text-xs outline-none focus:border-im-logical"
        />
      )}
      <List testId={testId}>{shown.map(render)}</List>
      {long && !all && !query && hits.length > 20 && (
        <button type="button" className={`${smallButtonClass} mt-1`} onClick={() => setAll(true)} data-testid="button-show-all">
          Show all ({hits.length})
        </button>
      )}
    </>
  );
}
