"use client";

// The picker (slice 17, D-72; prototype #pickpop): one at a time for the page, opened with `openPick` and drawn by
// `PickHost` in the root layout. It opens hidden at its point; a ResizeObserver on itself reports its size after the
// browser's own layout, and only then is it kept on the screen and shown, so nothing reads layout during a commit
// (CLAUDE.md). Esc or a press outside closes it with nothing done; keys typed in it never reach the canvas.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { buttonVariants } from "@/ui/components/button";
import { inputVariants } from "@/ui/components/input";
import { MENU_CONTENT, MENU_HEAD, MENU_ITEM } from "@/ui/components/menu";
import { cn } from "@/ui/lib/utils";
import { clampAt, createText, enterAction, nextFocus, noneText, visibleItems, type PickOptions } from "./pick";

export type { PickItem, PickOptions } from "./pick";

let current: { options: PickOptions; key: number } | null = null;
let counter = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Opens the picker, replacing any open one. */
export function openPick(options: PickOptions): void {
  current = { options, key: ++counter };
  emit();
}

/** Closes the picker, if one is open. */
export function closePick(): void {
  if (!current) return;
  current = null;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Draws the open picker; mounted once, in the root layout. */
export function PickHost() {
  const open = useSyncExternalStore(subscribe, () => current, () => null);
  if (!open) return null;
  return <Picker key={open.key} options={open.options} />;
}

function Picker({ options }: { options: PickOptions }) {
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const multi = !!options.multi;
  const shown = visibleItems(options.items, query);
  const enabled = shown.filter((i) => !i.done);
  // slice 21 (D-76): the create item, last, while the typed text names no item
  const create = multi ? "" : createText(options, query);

  // kept on the screen once its size is known (after layout), then shown
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const size = entry!.borderBoxSize?.[0];
      const width = size ? size.inlineSize : entry!.contentRect.width;
      const height = size ? size.blockSize : entry!.contentRect.height;
      setPos(clampAt(options.at, { width, height }, { width: window.innerWidth, height: window.innerHeight }));
    });
    ro.observe(el);
    const away = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) closePick();
    };
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("resize", closePick);
    return () => {
      ro.disconnect();
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("resize", closePick);
    };
  }, [options.at]);

  // the field takes the focus once the picker is shown (a hidden element cannot have it)
  const shownOnce = pos !== null;
  useEffect(() => {
    if (shownOnce) field.current?.focus();
  }, [shownOnce]);

  const choose = (ids: string[]) => {
    const pick = options.pick;
    closePick();
    pick(ids);
  };
  const createNow = (text: string) => {
    const act = options.create?.act;
    closePick();
    if (act && text) act(text);
  };
  const toggle = (id: string) =>
    setChecked((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const buttons = () => [...(box.current?.querySelectorAll<HTMLButtonElement>("[data-pick-item]:not(:disabled)") ?? [])];
  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      closePick();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const list = buttons();
      const to = nextFocus(list.indexOf(document.activeElement as HTMLButtonElement), list.length, e.key);
      (to < 0 ? field.current : list[to])?.focus();
      return;
    }
    if (e.key === "Enter" && e.target === field.current) {
      e.preventDefault();
      const act = enterAction(multi, enabled, checked.size, create);
      if (!act) return;
      if ("confirm" in act) choose([...checked]);
      else if ("create" in act) createNow(act.create);
      else choose([act.pick]);
    }
  };

  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label={options.title}
      data-testid={options.testId ?? "picker"}
      data-shown={pos ? "true" : undefined}
      className={cn("fixed z-50 flex max-h-[min(70vh,520px)] min-w-[260px] max-w-[340px] flex-col overflow-hidden", MENU_CONTENT)}
      style={{ left: pos?.x ?? options.at.x, top: pos?.y ?? options.at.y, visibility: pos ? "visible" : "hidden" }}
      onKeyDown={onKeyDown}
      onKeyUp={(e) => e.stopPropagation()}
    >
      <div className={MENU_HEAD} data-testid="picker-title">
        {options.title}
      </div>
      {options.note && <div className="px-2 pb-1 text-small text-im-ink-3">{options.note}</div>}
      <div className="px-1 pb-1">
        <input
          ref={field}
          className={inputVariants()}
          placeholder={options.placeholder}
          autoComplete="off"
          spellCheck={false}
          value={query}
          data-testid="picker-filter"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="min-h-0 flex-auto overflow-auto" role={multi ? "group" : "listbox"}>
        {shown.length ? (
          shown.map((it) => {
            const on = !!it.done || checked.has(it.id);
            return (
              <button
                key={it.id}
                type="button"
                data-pick-item={it.id}
                data-testid="picker-item"
                data-key={it.key}
                data-label={it.label}
                role={multi ? "menuitemcheckbox" : "option"}
                aria-checked={multi ? on : undefined}
                aria-selected={multi ? undefined : false}
                disabled={it.done}
                title={it.done ? options.doneTitle : undefined}
                className={cn(MENU_ITEM, "w-full px-2 py-1.5 disabled:opacity-60")}
                onClick={() => (multi ? toggle(it.id) : choose([it.id]))}
              >
                {multi && (
                  <span
                    className={`grid size-3.5 flex-none place-items-center rounded-[3px] text-[11px] leading-none text-white ${on ? "bg-im-logical" : "shadow-[0_0_0_1.5px_var(--im-ink-3)]"}`}
                  >
                    {on ? "✓" : ""}
                  </span>
                )}
                {it.color && <span className="size-2.5 flex-none rounded-[3px]" style={{ background: it.color }} />}
                {it.key && <span className="flex-none font-mono text-[11.5px] text-im-ink-3">{it.key}</span>}
                <span className="min-w-0 flex-auto truncate">{it.label}</span>
              </button>
            );
          })
        ) : create ? null : (
          <div className="px-2.5 py-2 text-[12.5px] text-im-ink-3" data-testid="picker-none">
            {noneText(options, query)}
          </div>
        )}
        {create && (
          <button
            type="button"
            data-pick-item=""
            data-testid="picker-create"
            role="option"
            aria-selected={false}
            className={cn(MENU_ITEM, "w-full px-2 py-1.5 text-im-logical", shown.length > 0 && "mt-0.5 rounded-t-none border-t border-im-line")}
            onClick={() => createNow(create)}
          >
            <span className="w-3 flex-none text-center font-semibold" aria-hidden>
              +
            </span>
            <span className="min-w-0 flex-auto truncate">{options.create!.label(create)}</span>
          </button>
        )}
      </div>
      {(multi || options.extra) && (
        <div className="mt-1 flex items-center justify-between gap-1.5 border-t border-im-line px-1 pb-0.5 pt-1.5">
          {options.extra ? (
            <button
              type="button"
              data-testid="picker-extra"
              className={buttonVariants({ size: "sm" })}
              onClick={() => {
                const act = options.extra!.act;
                closePick();
                act();
              }}
            >
              {options.extra.label}
            </button>
          ) : (
            <span />
          )}
          {multi && (
            <button
              type="button"
              data-testid="picker-confirm"
              disabled={!checked.size}
              className={buttonVariants({ variant: "primary", size: "sm" })}
              onClick={() => choose([...checked])}
            >
              {(options.confirm ?? ((n: number) => (n ? `Link ${n}` : "Link")))(checked.size)}
            </button>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
