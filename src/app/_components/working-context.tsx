"use client";

// The active working context (slice 3b, D-26; prototype renderCtxBtn, setCtx, renderCtxList, pickCtx, #tCtx): while it
// is on, everything the person creates or changes in the model gets its label, in the same undo step (the server does
// that, `completeLiveWrites`). It is a preference of one person in one workspace, kept in their browser (a cookie the
// browser writes, so every write carries it; `working-context-cookie.ts`) until they switch it off. Only owners,
// admins and modelers get the switch (AD-05). A deleted label switches it off with a toast.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { createLabelAction } from "@/app/_actions/label";
import { contextMenuEntries, type CountedLabel } from "@/domain/model/labels";
import { useToast } from "@/ui/components/toast";
import {
  useWorkingContext,
  WorkingContextCtx,
  type WorkingContextApi,
} from "@/ui/working-context";
import {
  CONTEXT_COOKIE_MAX_AGE,
  contextCookieName,
  formatContextCookie,
} from "@/ui/working-context-cookie";
import { useAction } from "./use-action";
import { TagIcon } from "../_panels/labels-field";

const writeCookie = (name: string, value: string | null) => {
  document.cookie =
    value === null
      ? `${name}=; path=/; max-age=0; samesite=lax`
      : `${name}=${value}; path=/; max-age=${CONTEXT_COOKIE_MAX_AGE}; samesite=lax`;
};

export function WorkingContextProvider({
  workspaceId,
  userId,
  labels,
  initial,
  canLabel,
  children,
}: {
  workspaceId: string;
  userId: string;
  /** The workspace's live labels with how many items each marks (fresh with every page). */
  labels: CountedLabel[];
  /** The context as the browser's cookie had it when the page was made. */
  initial: { labelId: string; name: string } | null;
  /** Owners, admins and modelers of a workspace that is not archived. */
  canLabel: boolean;
  children: ReactNode;
}) {
  const toast = useToast();
  const { run } = useAction();
  const cookie = contextCookieName(userId, workspaceId);
  const [activeId, setActiveId] = useState<string | null>(
    canLabel ? (initial?.labelId ?? null) : null,
  );
  /** A label created here that the page does not list yet (its fresh page is on its way). */
  const [created, setCreated] = useState<CountedLabel | null>(null);
  /** The active label's last known name, for the toast when it was deleted. */
  const nameRef = useRef(initial?.name ?? "");

  const active = useMemo(
    () =>
      labels.find((l) => l.id === activeId) ??
      (created && created.id === activeId ? created : null),
    [labels, activeId, created],
  );
  useEffect(() => {
    if (active) nameRef.current = active.name;
  }, [active]);

  // roles without label rights never send a context (a stale cookie would make every write refused)
  useEffect(() => {
    if (!canLabel && initial) writeCookie(cookie, null);
  }, [canLabel, initial, cookie]);

  // a label created here is listed by the fresh page; a deleted one switches the context off
  useEffect(() => {
    if (created && labels.some((l) => l.id === created.id)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the fresh page now lists the created label
      setCreated(null);
      return;
    }
    if (
      !activeId ||
      labels.some((l) => l.id === activeId) ||
      created?.id === activeId
    )
      return;
    writeCookie(cookie, null);
    setActiveId(null);
    toast(
      `The working context ${nameRef.current || "label"} was deleted, so it is off now.`,
    );
  }, [labels, activeId, created, cookie, toast]);

  const turnOn = useCallback(
    (label: { id: string; name: string }) => {
      writeCookie(cookie, formatContextCookie(label.id, label.name));
      nameRef.current = label.name;
      setActiveId(label.id);
      toast(
        `Working on ${label.name}: everything you create or change in the model gets this label. Layout changes don't.`,
      );
    },
    [cookie, toast],
  );

  const set = useCallback(
    (labelId: string | null) => {
      if (labelId === null) {
        writeCookie(cookie, null);
        setActiveId(null);
        toast("Working context switched off.");
        return;
      }
      const label = labels.find((l) => l.id === labelId);
      if (label) turnOn(label);
    },
    [labels, cookie, toast, turnOn],
  );

  const create = useCallback(
    (name: string) => {
      void run(() => createLabelAction(workspaceId, { name })).then((r) => {
        if (!r.ok) return;
        setCreated({ id: r.value.labelId, name: r.value.name, items: 0 });
        turnOn({ id: r.value.labelId, name: r.value.name });
      });
    },
    [run, workspaceId, turnOn],
  );

  const api = useMemo<WorkingContextApi | null>(
    () => (canLabel ? { active, labels, set, create } : null),
    [canLabel, active, labels, set, create],
  );
  return (
    <WorkingContextCtx.Provider value={api}>
      {children}
    </WorkingContextCtx.Provider>
  );
}

const btn =
  "inline-flex h-[30px] flex-none items-center gap-1.5 rounded-md px-2 text-im-ink-2 hover:bg-im-hover hover:text-im-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-im-logical aria-pressed:bg-im-logical-soft aria-pressed:text-im-ink";

/** The top bar's switch left of Undo, and its menu (PRD item 1). */
export function WorkingContextButton() {
  const api = useWorkingContext();
  /** Where the menu opens (under the button; the menu is in a portal, so the top bar's overflow does not clip or scroll it). */
  const [open, setOpen] = useState<{ left: number; top: number } | null>(null);
  const [typed, setTyped] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (
        !box.current?.contains(e.target as Node) &&
        !menu.current?.contains(e.target as Node)
      )
        setOpen(null);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const entries = useMemo(
    () => contextMenuEntries(api?.labels ?? [], api?.active?.id ?? null, typed),
    [api, typed],
  );
  if (!api) return null;
  const { active } = api;
  const close = () => {
    setOpen(null);
    setTyped("");
  };
  const toggle = () => {
    if (open) return close();
    const r = box.current!.getBoundingClientRect();
    setOpen({
      left: Math.max(8, Math.min(r.left, window.innerWidth - 308)),
      top: r.bottom + 6,
    });
  };
  const pick = (choice: { create: string } | CountedLabel) => {
    close();
    if ("create" in choice) api.create(choice.create);
    else api.set(choice.id);
  };
  const first =
    entries.create !== null ? { create: entries.create } : entries.labels[0];
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      if (first) pick(first);
    } else if (e.key === "Escape") close();
  };

  return (
    <div ref={box} className="relative flex-none">
      <button
        type="button"
        className={btn}
        aria-pressed={!!active}
        aria-expanded={!!open}
        title="Working context: while active, everything you create or change in the model gets this label"
        data-testid="button-context"
        onClick={toggle}
      >
        {active ? (
          <>
            <span
              className="size-2 flex-none rounded-full bg-im-logical"
              aria-hidden
            />
            <span className="max-w-[180px] truncate">
              Working on {active.name}
            </span>
          </>
        ) : (
          <>
            <TagIcon className="size-4" />
            <span className="hidden min-[1400px]:inline">
              No working context
            </span>
          </>
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            style={{ left: open.left, top: open.top }}
            className="fixed z-50 flex w-[300px] flex-col rounded-lg bg-im-surface p-1.5 text-[13px] text-im-ink shadow-[0_0_0_1px_var(--im-line),0_10px_24px_-12px_var(--im-shadow)]"
            data-testid="menu-context"
          >
            <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-im-ink-3">
              Working context
            </div>
            <p className="px-2 pb-2 text-xs leading-snug text-im-ink-2">
              While a context is on, everything you create or change in the
              model gets its label, and shows up on its live canvas. Layout
              changes are not labeled.
            </p>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={onKey}
              placeholder="Find or create a label, e.g. CR-23"
              autoComplete="off"
              spellCheck={false}
              className="mx-1 mb-1 rounded-md border border-im-line bg-im-surface px-2 py-1.5 outline-none focus:outline-2 focus:-outline-offset-1 focus:outline-im-logical"
              data-testid="input-context"
            />
            <div
              role="listbox"
              className="flex flex-col"
              data-testid="list-context"
            >
              {entries.create !== null && (
                <button
                  type="button"
                  role="option"
                  aria-selected
                  className="flex items-center gap-2 rounded-[5px] bg-im-hover px-2 py-1.5 text-left"
                  onClick={() => pick({ create: entries.create! })}
                  data-testid="option-context-create"
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-im-logical">
                    Create “{entries.create}”
                  </span>
                  <span className="text-xs text-im-ink-3">new label</span>
                </button>
              )}
              {entries.labels.map((l, i) => (
                <button
                  key={l.id}
                  type="button"
                  role="option"
                  aria-selected={entries.create === null && i === 0}
                  className={`flex items-center gap-2 rounded-[5px] px-2 py-1.5 text-left hover:bg-im-hover ${entries.create === null && i === 0 ? "bg-im-hover" : ""}`}
                  onClick={() => pick(l)}
                  data-testid="option-context"
                >
                  <span className="text-im-ink-3">
                    <TagIcon />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{l.name}</span>
                  <span className="text-xs text-im-ink-3">
                    {l.id === active?.id ? "active" : `${l.items} items`}
                  </span>
                </button>
              ))}
              {entries.create === null && !entries.labels.length && (
                <div className="px-2 py-1.5 text-im-ink-3">
                  No labels yet. Type a name to create one.
                </div>
              )}
            </div>
            {active && (
              <>
                <hr className="my-1 border-im-line" />
                <button
                  type="button"
                  className="rounded-[5px] px-2 py-1.5 text-left hover:bg-im-hover"
                  onClick={() => (close(), api.set(null))}
                  data-testid="button-context-off"
                >
                  Stop working on {active.name}
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** The status bar's part (prototype .ctxw): “Working on {name}, items labeled N”. */
export function WorkingContextStatus() {
  const api = useWorkingContext();
  if (!api?.active) return null;
  return (
    <span data-testid="status-context" className="[&_b]:!text-im-ink">
      Working on <b>{api.active.name}</b>, items labeled{" "}
      <b>{api.active.items}</b>
    </span>
  );
}
