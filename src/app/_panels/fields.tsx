"use client";

// Building blocks of the right panel, styled after the prototype (.fld, .seg, .flags, .note, .list, .li, .pill,
// .actions). Text fields save when they lose the focus (prototype "change"). The panels save through `saveRow`
// (`useAction`, slice 9): one row's saves one after the other, each with the newest version known when it is sent.
// Slice 13 (D-66): a text field keeps what the person typed (its draft, `useDraft`) across the page's fresh values and
// after a refusal; a choice field shows the newest stored value after a refusal (`useChoice`). Fields are keyed by their
// object and field (`fieldKey`), never by their stored value.

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref, type TextareaHTMLAttributes } from "react";
import { useToast } from "@/ui/components/toast";
import { choiceLanded, choiceShown, FieldDraft, storedBy, type Chosen, type SaveAnswer } from "@/ui/field-draft";
import { dropDraft, isGone, keepDraft, markGone, takeDraft, unmarkGone, updateDraft } from "@/ui/field-drafts";
import { guard, release } from "@/ui/leave-guard";

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

/** Where a field keeps its draft when its panel closes (slice 13, item 5a): its key, and its name for the toast. */
export interface DraftKeep {
  key: string;
  field: string;
  object: string;
}

/**
 * What a field shows under it after a refusal (slice 13, items 7–9): the other value, "Not saved", or "Not saved. You
 * can still copy it." (a permission or the archive: the field is read-only, its draft readable).
 */
export type DraftMark = { kind: "conflict"; other: string } | { kind: "notSaved" } | { kind: "copy" } | null;

/** Refusals after which the field shows its mark: a stale version, and a save cut behind one. */
const MARKED = new Set(["stale_version", "cut"]);
/** Refusals after which the draft stays readable while the page turns the field read-only (item 9). */
const READ_ONLY = new Set(["forbidden", "archived"]);

/**
 * A refused draft's state: `mark` (stale or cut: conflict or "Not saved" by its base), `locked` (a locked organization:
 * "Not saved", still editable), `copy` (read-only), `gone` (its object was deleted: the draft goes with it).
 */
type Refusal = { kind: "mark" | "locked" | "copy" | "gone"; base: string };

const refusalOf = (code: string, base: string): Refusal | null =>
  MARKED.has(code) ? { kind: "mark", base } : code === "locked" ? { kind: "locked", base } : READ_ONLY.has(code) ? { kind: "copy", base } : code === "not_found" ? { kind: "gone", base } : null;

const codeOf = (answer: SaveAnswer): string => (answer && typeof answer === "object" ? (answer.code ?? "") : "");

/**
 * A draft kept outside the field (slice 14a: a note's text, kept by the canvas for the note and shown on it): the field
 * shows it and its refusal's mark while it has neither the focus nor its own different text, and drops it with "Use
 * this" or Escape. Its saves go through the field's `save` as usual; the keeper records them.
 */
export interface OutsideDraft {
  draft: { text: string; base: string; refusal: "mark" | "locked" | "copy" | null } | null;
  drop: () => void;
}

/** Points an object ref at the element (a field's `inputRef`). */
function setRef<E>(ref: { current: E | null } | object, el: E | null): void {
  (ref as { current: E | null }).current = el;
}

/** The toast of a draft refused after its panel closed (slice 13, item 5a). */
export const notSavedAway = (field: string, object: string): string => `Not saved: ${field} of ${object}. Open it again to see your text.`;

/**
 * A text field's draft (slice 13, D-66; the rules in `src/ui/field-draft.ts`): the element is uncontrolled, so typing
 * renders nothing. A stored value reaches it in an effect, written into the element only while it has neither the
 * focus nor a draft. `commit` (on leaving the field) saves the text when it differs from the value on its way or the
 * stored one; `prepare` trims or parses it (null: nothing to save); an empty `required` field goes back to the stored
 * value (D-59), with `onEmpty` (a toast) where one is wanted.
 *
 * After a stale refusal, or a save cut behind one, the refusal's fresh page decides the mark (F5): the field's stored
 * value differs from the one its draft started from (a conflict: the other value, "Use this", "Keep mine"; leaving the
 * field saves nothing, F6), or it does not ("Not saved": leaving the field saves it again). Escape puts the stored value
 * back (while a conflict shows, it is "Use this"). With `keep`, a draft whose field unmounts stays for the page
 * (`src/ui/field-drafts.ts`) and comes back when the field mounts again.
 */
export function useDraft<E extends HTMLInputElement | HTMLTextAreaElement>(
  stored: string,
  save: FieldSave<string> | undefined,
  o: {
    prepare?: (text: string) => string | null;
    required?: boolean;
    onEmpty?: () => void;
    readOnly?: boolean;
    elementRef?: Ref<E>;
    keep?: DraftKeep;
    outside?: OutsideDraft;
  } = {},
) {
  const toast = useToast();
  const element = useRef<E | null>(null);
  const [draft] = useState(() => new FieldDraft(stored));
  const [initial] = useState(stored);
  /** The refusal the mark comes from, with the stored value the refused draft started from. */
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  // mirrors for what runs after the field unmounted (a late answer, the cleanup)
  const refusalNow = useRef<Refusal | null>(null);
  const mounted = useRef(true);
  const lastText = useRef<string | null>(null);
  const keepNow = useRef<DraftKeep | undefined>(undefined);
  const toastNow = useRef(toast);
  /**
   * The leave guard (slice 14b): held while the field has a refused draft (any mark but a deleted object's) or the focus
   * with typed text not yet sent; a sent text is a save on its way, which the save chain holds.
   */
  const [guardNow] = useState(() => (focused?: boolean) => {
    const el = element.current;
    const r = refusalNow.current;
    const typed = !!el && (focused ?? document.activeElement === el) && draft.hasDraft(el.value);
    guard(draft, (!!r && r.kind !== "gone") || typed);
  });
  const [setRefusalNow] = useState(() => (r: Refusal | null) => {
    refusalNow.current = r;
    guardNow();
  });
  const refuse = (r: Refusal | null) => {
    setRefusalNow(r);
    setRefusal(r);
  };

  useEffect(() => {
    keepNow.current = o.keep;
    toastNow.current = toast;
  });
  useEffect(() => {
    const el = element.current;
    // a DOM write after the commit, never a layout read (CLAUDE.md, slice 6a)
    const take = el ? draft.receive(stored, el.value, document.activeElement === el) : "keep";
    if (el && take === "take") el.value = stored;
    if (take === "end" && refusalNow.current && refusalNow.current.kind !== "copy") {
      setRefusalNow(null);
      // the stored value came to equal the draft: its mark goes
      setRefusal(null);
    }
  }, [stored, draft, setRefusalNow]);
  // a draft kept outside the field (slice 14a): taken while the field has neither the focus nor a text of its own
  const outside = o.outside?.draft;
  const hasOutside = !!o.outside;
  useEffect(() => {
    const el = element.current;
    if (!hasOutside || !el || document.activeElement === el) return;
    if (outside) {
      if (el.value !== outside.text) el.value = outside.text;
      const r: Refusal | null = outside.refusal ? { kind: outside.refusal, base: outside.base } : null;
      if (refusalNow.current?.kind !== r?.kind || refusalNow.current?.base !== r?.base) {
        setRefusalNow(r);
        setRefusal(r);
      }
    } else if (refusalNow.current || draft.hasDraft(el.value)) {
      // the draft ended outside (stored, or "Use this" on the canvas): the stored value shows
      el.value = stored;
      draft.reset(stored);
      setRefusalNow(null);
      setRefusal(null);
    }
  }, [outside, hasOutside, stored, draft, setRefusalNow]);
  const keepKey = o.keep?.key;
  useEffect(() => {
    mounted.current = true;
    const page = window.location.pathname;
    if (keepKey) unmarkGone(keepKey);
    const back = keepKey ? takeDraft(keepKey) : null;
    const el = element.current;
    if (back && el) {
      el.value = back.text;
      draft.reset(back.base);
      setRefusalNow(back.refused ? { kind: "mark", base: back.base } : null);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a draft kept while the panel was closed (item 5a)
      if (back.refused) setRefusal({ kind: "mark", base: back.base });
    }
    return () => {
      mounted.current = false;
      const text = lastText.current;
      const keep = keepNow.current;
      if (!keepKey || text === null || !draft.hasDraft(text)) return;
      // a deleted object takes its draft with it (answer 8); a read-only draft stays until the panel closes (item 9)
      if (refusalNow.current?.kind === "gone" || refusalNow.current?.kind === "copy" || isGone(keepKey)) return;
      // the field went with its page (a link, Back): its draft goes, as on another page (D-66); the address is already
      // the next page's, so a draft kept now would count as that page's (slice 14b, the leave guard)
      if (window.location.pathname !== page) return;
      const refused = !!refusalNow.current;
      keepDraft(keepKey, { text, base: refusalNow.current?.base ?? draft.taken, refused });
      // a refused draft whose panel closes (the refusal may land in the same commit as the new selection: a pending
      // save's transition holds the selection's): the toast says where it is
      if (refused && keep) toastNow.current(notSavedAway(keep.field, keep.object), "refusal");
    };
  }, [keepKey, draft, setRefusalNow]);

  // the field unmounted: a draft it leaves to `field-drafts` is held there
  useEffect(() => () => release(draft), [draft]);
  /** Typing, focus and blur change what the guard holds: read from the element, so no render is needed. */
  const [onType] = useState(() => (e: Event) => guardNow(e.type === "blur" ? false : undefined));

  const { elementRef } = o;
  /** The element's ref callback; the text it had when it was last detached is what an unmount keeps. */
  const bind = (el: E | null) => {
    if (!el && element.current) lastText.current = element.current.value;
    for (const type of ["input", "focus", "blur"]) {
      element.current?.removeEventListener(type, onType);
      el?.addEventListener(type, onType);
    }
    element.current = el;
    if (typeof elementRef === "function") elementRef(el);
    else if (elementRef) setRef(elementRef, el);
  };

  const mark: DraftMark = !refusal
    ? null
    : refusal.kind === "copy"
      ? { kind: "copy" }
      : refusal.kind === "mark" && stored !== refusal.base
        ? { kind: "conflict", other: stored }
        : refusal.kind === "gone"
          ? null
          : { kind: "notSaved" };

  const send = (value: string) => {
    const n = draft.send(value);
    const answered = (answer: SaveAnswer) => {
      const ok = storedBy(answer);
      draft.answered(n, ok);
      const keep = keepNow.current;
      const code = codeOf(answer);
      // a deleted object (answer 8): its drafts go, and a save cut behind its refusal says nothing more
      if (ok === false && code === "not_found" && keep) markGone(keep.key);
      if (!mounted.current) {
        // the field's panel closed meanwhile: the kept draft is stored, or refused (item 5a)
        if (keep && ok === true) dropDraft(keep.key);
        else if (keep && ok === false && !isGone(keep.key) && updateDraft(keep.key, { refused: MARKED.has(code) })) {
          toastNow.current(notSavedAway(keep.field, keep.object), "refusal");
        }
        return;
      }
      const r = ok === false ? refusalOf(code, draft.taken) : null;
      if (r) refuse(r);
    };
    Promise.resolve(save!(value)).then(answered, () => answered(false));
  };

  const commit = () => {
    const el = element.current;
    if (!el || o.readOnly || !save) return;
    // a conflict is settled by "Use this" or "Keep mine", never by leaving the field (F6); a read-only draft is for
    // copying only
    if (mark?.kind === "conflict" || mark?.kind === "copy") return;
    const raw = el.value;
    const value = o.prepare ? o.prepare(raw) : raw;
    if (value === null) return;
    if (o.required && !value) {
      el.value = stored;
      draft.reset(stored);
      refuse(null);
      o.onEmpty?.();
      return;
    }
    if (value !== raw) el.value = value;
    if (!draft.shouldSave(value, stored)) return;
    send(value);
  };

  /** "Use this": the field takes the newest stored value; the draft ends. */
  const takeStored = () => {
    const el = element.current;
    if (el) el.value = stored;
    draft.reset(stored);
    refuse(null);
    if (keepKey) dropDraft(keepKey);
    o.outside?.drop();
  };
  /** "Keep mine": the draft is saved on the newest version, a deliberate overwrite. */
  const keepMine = () => {
    const el = element.current;
    if (!el || !save) return;
    draft.reset(stored);
    refuse(null);
    const value = o.prepare ? o.prepare(el.value) : el.value;
    if (value !== null && value !== stored) send(value);
  };
  /** Escape puts the stored value back; while a conflict shows, it is "Use this". */
  const keyDown = (e: KeyboardEvent<E>) => {
    if (e.key !== "Escape" || o.readOnly || mark?.kind === "copy") return;
    if (mark?.kind === "conflict" || e.currentTarget.value !== stored) takeStored();
  };
  return { bind, defaultValue: initial, commit, keyDown, mark, takeStored, keepMine };
}

/** The other value's fold: more than three lines or about 240 characters, counted from the text (no layout read). */
const isLong = (text: string): boolean => text.split("\n").length > 3 || text.length > 240;

/**
 * The mark under a field after a refusal (slice 13, items 7–8): "Changed meanwhile to: {value}" (or "Cleared
 * meanwhile.") with "Use this" and "Keep mine", or "Not saved". A long value is folded to three lines by CSS, with "Show
 * more" / "Show less".
 */
export function DraftLine({ mark, onUse, onKeep, mono, inline }: { mark: DraftMark; onUse: () => void; onKeep: () => void; mono?: boolean; inline?: boolean }) {
  const [more, setMore] = useState(false);
  if (!mark) return null;
  if (inline) return <InlineDraftLine mark={mark} onUse={onUse} onKeep={onKeep} />;
  if (mark.kind === "notSaved" || mark.kind === "copy")
    return (
      <div className="mt-1 text-xs font-medium text-im-warn" data-testid="draft-not-saved">
        {mark.kind === "copy" ? "Not saved. You can still copy it." : "Not saved"}
      </div>
    );
  const long = isLong(mark.other);
  return (
    <div className="mt-1 rounded-md bg-im-warn-soft px-2.5 py-2 text-xs text-im-ink" data-testid="draft-conflict" role="status">
      {mark.other ? (
        <>
          <div>Changed meanwhile to:</div>
          <div className={`mt-0.5 whitespace-pre-line break-words ${mono ? "font-mono" : ""} ${long && !more ? "line-clamp-3" : ""}`} data-testid="draft-other">
            {mark.other}
          </div>
        </>
      ) : (
        <div data-testid="draft-other">Cleared meanwhile.</div>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button type="button" className={smallButtonClass} onClick={onUse} data-testid="button-use-this">
          Use this
        </button>
        <button type="button" className={smallButtonClass} onClick={onKeep} data-testid="button-keep-mine">
          Keep mine
        </button>
        {long && (
          <button type="button" className={smallButtonClass} onClick={() => setMore((m) => !m)} data-testid="button-draft-more">
            {more ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}

const inlineButtonClass = "h-[22px] flex-none rounded border border-im-line bg-im-surface px-2 text-xs font-normal text-im-ink hover:bg-im-hover";

/**
 * The same mark on one row after a field (slice 14b, a canvas's name in its tab, F4): the other value cut to fit, its full
 * text in the title; no fold, no layout read. The tab list clips anything below a tab, so it never goes under the field.
 */
function InlineDraftLine({ mark, onUse, onKeep }: { mark: NonNullable<DraftMark>; onUse: () => void; onKeep: () => void }) {
  if (mark.kind === "notSaved" || mark.kind === "copy")
    return (
      <span className="flex-none text-xs font-medium text-im-warn" data-testid="draft-not-saved">
        {mark.kind === "copy" ? "Not saved. You can still copy it." : "Not saved"}
      </span>
    );
  return (
    <span className="flex h-[28px] flex-none items-center gap-1.5 rounded-md bg-im-warn-soft px-2 text-xs font-normal text-im-ink" data-testid="draft-conflict" role="status">
      {mark.other ? (
        <>
          <span>Changed meanwhile to:</span>
          <span className="max-w-[180px] truncate font-medium" title={mark.other} data-testid="draft-other">
            {mark.other}
          </span>
        </>
      ) : (
        <span data-testid="draft-other">Cleared meanwhile.</span>
      )}
      <button type="button" className={inlineButtonClass} onClick={onUse} data-testid="button-use-this">
        Use this
      </button>
      <button type="button" className={inlineButtonClass} onClick={onKeep} data-testid="button-keep-mine">
        Keep mine
      </button>
    </span>
  );
}

/**
 * A choice field (a select, a check box; slice 13, R4): the choice shows from the click until the stored value changes;
 * after a refusal the field shows the stored value, which the refusal's fresh page brings.
 */
export function useChoice<T>(stored: T, save: FieldSave<T>) {
  const [chosen, setChosen] = useState<Chosen<T> | null>(null);
  // the choice is stored (slice 15b): forget it, so an undo that brings the old value back shows it (A → B → A showed B)
  if (chosen && choiceLanded(chosen, stored)) setChosen(null);
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
  keep,
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
  /** Keep the draft when the panel closes (slice 13, item 5a). */
  keep?: DraftKeep;
}) {
  const { bind, defaultValue: initial, commit, keyDown, mark, takeStored, keepMine } = useDraft<HTMLInputElement>(value, onSave, {
    prepare: (t) => t.trim(),
    required,
    onEmpty,
    readOnly,
    elementRef: inputRef,
    keep,
  });
  return (
    <>
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
          keyDown(e);
        }}
        onBlur={commit}
      />
      <DraftLine mark={mark} onUse={takeStored} onKeep={keepMine} mono={mono} />
    </>
  );
}

/** A plain-text area (definitions, notes, rules; AD-30) that saves when it loses the focus. */
export function TextArea({
  value,
  onSave,
  code,
  ...rest
}: { value: string; onSave: FieldSave<string>; code?: boolean; keep?: DraftKeep; outside?: OutsideDraft } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "defaultValue">) {
  const { keep, outside, ...props } = rest;
  const { bind, defaultValue: initial, commit, keyDown, mark, takeStored, keepMine } = useDraft<HTMLTextAreaElement>(value, onSave, {
    readOnly: !!props.readOnly || !!props.disabled,
    keep,
    outside,
  });
  return (
    <>
      <textarea
        {...props}
        ref={bind}
        defaultValue={initial}
        className={`${inputClass} min-h-[60px] resize-y ${code ? "font-mono text-xs" : ""}`}
        onKeyDown={(e) => {
          props.onKeyDown?.(e);
          keyDown(e);
        }}
        onBlur={(e) => {
          props.onBlur?.(e);
          commit();
        }}
      />
      <DraftLine mark={mark} onUse={takeStored} onKeep={keepMine} mono={code} />
    </>
  );
}

/** Segmented buttons (prototype .seg): one of a few values. */
export function Seg<V extends string>({
  value,
  options,
  onChange,
  disabled,
  testId,
  columns,
}: {
  value: V;
  options: readonly (readonly [V, string])[];
  onChange: (v: V) => void;
  disabled?: boolean;
  testId?: string;
  /** Slice 19 (prototype .seg.g2): the choices in a grid of two columns. */
  columns?: 2;
}) {
  const layout = columns === 2 ? "grid grid-cols-2 gap-0.5" : "inline-flex";
  return (
    <div className={`${layout} rounded-[7px] bg-im-hover p-0.5`} role="group" data-testid={testId}>
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
/**
 * The parts of an attribute's second click (slice 15b, R4): its mappings and a module's rows ("2 mappings and 1
 * measure"), its copies and what a module's rows change elsewhere, joined with "; "; undefined when there is none.
 */
export function attributeDeleteParts(
  mappings: number,
  copies: string | undefined,
  modules: { also: readonly string[]; then: readonly string[] } | undefined,
  /** Slice 18 (F12): the calculations that read it ("the calculation of net_amount loses this input"). */
  calculations?: string | null,
) {
  const also = [...(mappings ? [`${mappings} mapping${mappings > 1 ? "s" : ""}`] : []), ...(modules?.also ?? [])];
  const then = [...(copies ? [copies] : []), ...(calculations ? [calculations] : []), ...(modules?.then ?? [])];
  return { also: also.length ? also.join(" and ") : undefined, then: then.length ? then.join("; ") : undefined };
}

/** Slice 18 (F14): the Delete key on a relationship with lookups through it deletes nothing and says where to. */
export const relationshipDeleteAsks = (then: string): string => `Delete it from its menu or its panel: ${then}.`;

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
export function Fold({ title, count, children, testId, openOn, flash, sectionRef }: {
  title: string;
  count?: number;
  children: ReactNode;
  testId?: string;
  /** Slice 20: a request to show the section opened (a counter; 0 asks nothing): unfolded, and remembered so. */
  openOn?: number;
  /** Slice 20: the section flashes once (the status bar's jump). */
  flash?: boolean;
  sectionRef?: React.Ref<HTMLElement>;
}) {
  const key = sectionKey(title);
  const [shut, setShut] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only preference, read after mount
    setShut(readShut().has(key));
  }, [key]);
  useEffect(() => {
    if (!openOn) return;
    const all = readShut();
    if (all.delete(key)) {
      try {
        window.localStorage.setItem(SECTIONS_KEY, JSON.stringify([...all]));
      } catch {
        // not remembered
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- asked for from outside (the status bar's count)
    setShut(false);
  }, [openOn, key]);
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
    <section data-testid={testId} ref={sectionRef} data-flash={flash || undefined} className={flash ? "rounded bg-im-warn-soft transition-colors duration-300" : "transition-colors duration-300"}>
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
