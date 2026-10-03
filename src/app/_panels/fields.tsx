"use client";

// Building blocks of the right panel, styled after the prototype (.fld, .seg, .flags, .note, .list, .li, .pill,
// .actions). Text fields save when they lose the focus (prototype "change"); the panel remounts them, keyed by the
// row's version, once the server has the new value.

import { useEffect, useState, type ReactNode, type TextareaHTMLAttributes } from "react";

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

/** A text field that saves on Enter or when it loses the focus. An empty required field goes back. */
export function TextField({
  id,
  value,
  onSave,
  readOnly,
  required,
  testId,
  inputRef,
  mono,
}: {
  id?: string;
  value: string;
  onSave: (value: string) => void;
  readOnly?: boolean;
  required?: boolean;
  testId?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  mono?: boolean;
}) {
  return (
    <input
      id={id}
      ref={inputRef}
      defaultValue={value}
      readOnly={readOnly}
      data-testid={testId}
      autoComplete="off"
      className={`${inputClass} ${mono ? "font-mono text-xs" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onBlur={(e) => {
        if (readOnly) return;
        const v = e.currentTarget.value.trim();
        if (required && !v) {
          e.currentTarget.value = value;
          return;
        }
        if (v !== value) onSave(v);
      }}
    />
  );
}

/** A plain-text area (definitions, notes, rules; AD-30) that saves when it loses the focus. */
export function TextArea({
  value,
  onSave,
  code,
  ...rest
}: { value: string; onSave: (value: string) => void; code?: boolean } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "defaultValue">) {
  return (
    <textarea
      {...rest}
      defaultValue={value}
      className={`${inputClass} min-h-[60px] resize-y ${code ? "font-mono text-xs" : ""}`}
      onBlur={(e) => {
        rest.onBlur?.(e);
        if (!rest.readOnly && !rest.disabled && e.currentTarget.value !== value) onSave(e.currentTarget.value);
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
 * A delete button that asks for a second click (until undo arrives in slice 1b): the first click turns it into
 * “Click again to delete”, with what goes along; it turns back after a few seconds or when the focus leaves.
 */
export function ConfirmDelete({ label, also, onConfirm, testId }: { label: string; also?: string; onConfirm: () => void; testId?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`${dangerClass} ${armed ? "border-im-warn bg-im-warn-soft" : ""}`}
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
      {armed ? `Click again to delete${also ? `, with ${also}` : ""}` : label}
    </button>
  );
}
