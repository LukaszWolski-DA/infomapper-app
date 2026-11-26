"use client";

// The right-click toolbox on the canvas (slice 1b, D-19; prototype #cmenu): a short menu for what was clicked, at the
// mouse, kept on the screen. Headings, actions (with their shortcut, checked, disabled, danger, or a second click to
// confirm), segmented choices
// and, on the empty canvas, “Add an entity or table here…”: a search whose first result Enter picks. ↑/↓ move between
// actions, Esc or a click elsewhere closes it.

import { keepsBrowserMenu } from "@/ui/browser-menu";
import { inputVariants } from "@/ui/components/input";
import { MENU_CONTENT, MENU_HEAD, MENU_ITEM } from "@/ui/components/menu";
import { SEGMENTED_BUTTON, SEGMENTED_TRACK } from "@/ui/components/segmented";
import { cn } from "@/ui/lib/utils";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ToolboxItem =
  | { head: string }
  | { sep: true }
  | {
      label: string;
      act: () => void;
      kbd?: string;
      danger?: boolean;
      disabled?: boolean;
      checked?: boolean;
      testId?: string;
      /** Asks for a second click first, with this text (as the panels' delete buttons do). */
      confirm?: string;
    }
  | { seg: string; testId?: string; options: { label: string; on: boolean; act: () => void }[] }
  | { search: (query: string) => SearchResult[] };

export interface SearchResult {
  key: string;
  label: string;
  meta: string;
  kind: "ent" | "src" | "new";
  pick: () => void;
}

const isAction = (i: ToolboxItem): i is Extract<ToolboxItem, { label: string }> => "label" in i;

/** Drops separators at the ends and doubled ones, like the prototype. */
function tidy(items: ToolboxItem[]): ToolboxItem[] {
  const out: ToolboxItem[] = [];
  for (const i of items) {
    if ("sep" in i && (out.length === 0 || "sep" in out[out.length - 1]!)) continue;
    out.push(i);
  }
  while (out.length && "sep" in out[out.length - 1]!) out.pop();
  return out;
}

export function Toolbox({ items, at, onClose }: { items: ToolboxItem[]; at: { x: number; y: number }; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);
  const [query, setQuery] = useState("");
  /** The action waiting for its second click. */
  const [armed, setArmed] = useState<number | null>(null);
  const list = tidy(items);
  const search = list.find((i): i is Extract<ToolboxItem, { search: unknown }> => "search" in i);
  const results = search ? search.search(query) : [];

  // Measured after the results are in, so it never spills off the screen; then the first field or action has focus.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: Math.max(8, Math.min(at.x, window.innerWidth - r.width - 8)), y: Math.max(8, Math.min(at.y, window.innerHeight - r.height - 8)) });
    el.querySelector<HTMLElement>("input, button:not([disabled])")?.focus();
  }, [at]);

  useEffect(() => {
    const away = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    // Esc closes it also when nothing in it has the focus.
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("wheel", away, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("wheel", away, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("keydown", escape, true);
    };
  }, [onClose]);

  const run = (act: () => void) => {
    onClose();
    act();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = [...(box.current?.querySelectorAll<HTMLElement>("[role^=menuitem]:not([disabled])") ?? [])];
    if (!buttons.length) return;
    e.preventDefault();
    const i = buttons.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % buttons.length : (i <= 0 ? buttons.length : i) - 1;
    buttons[next]!.focus();
  };

  return createPortal(
    <div
      ref={box}
      role="menu"
      data-testid="menu-toolbox"
      className={cn("fixed z-50 w-[260px]", MENU_CONTENT)}
      style={{ left: pos.x, top: pos.y }}
      onKeyDown={onKeyDown}
      // its search field keeps the browser's menu (slice 16, item 7)
      onContextMenu={(e) => {
        if (!keepsBrowserMenu(e)) e.preventDefault();
      }}
    >
      {list.map((item, i) => {
        if ("head" in item) {
          return (
            <div key={i} className={MENU_HEAD}>
              {item.head}
            </div>
          );
        }
        if ("sep" in item) return <hr key={i} className="my-1 border-im-line" />;
        if ("search" in item) {
          return (
            <div key={i} className="pb-1">
              <input
                className={inputVariants()}
                placeholder="Add an entity or table here…"
                autoComplete="off"
                spellCheck={false}
                value={query}
                data-testid="input-toolbox-search"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && results[0]) {
                    e.preventDefault();
                    run(results[0].pick);
                  }
                }}
              />
              <div className="mt-1">
                {results.length ? (
                  results.map((r, j) => (
                    <button
                      key={r.key}
                      type="button"
                      role="menuitem"
                      data-testid="toolbox-result"
                      className={cn(MENU_ITEM, "w-full px-2 py-1", j === 0 && "bg-im-hover")}
                      onClick={() => run(r.pick)}
                    >
                      <span
                        className={`size-2 flex-none rounded-[2px] ${r.kind === "src" ? "bg-im-physical" : r.kind === "ent" ? "bg-im-logical" : "shadow-[inset_0_0_0_1.5px_var(--im-logical)]"}`}
                      />
                      <span className={`min-w-0 flex-1 truncate ${r.kind === "src" ? "font-mono text-xs" : ""} ${r.kind === "new" ? "font-medium text-im-logical" : ""}`}>
                        {r.label}
                      </span>
                      <span className="flex-none text-[11px] text-im-ink-3">{r.meta}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-1 text-im-ink-3">Nothing matches.</div>
                )}
              </div>
              <hr className="mt-1 border-im-line" />
            </div>
          );
        }
        if ("seg" in item) {
          return (
            <div key={i} className="px-2 py-1" data-testid={item.testId}>
              <div className="mb-1 text-small text-im-ink-3">{item.seg}</div>
              <div className={cn("flex", SEGMENTED_TRACK)}>
                {item.options.map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    aria-pressed={o.on}
                    className={cn(SEGMENTED_BUTTON, "flex-1 px-1")}
                    onClick={() => run(o.act)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        if (!isAction(item)) return null;
        return (
          <button
            key={i}
            type="button"
            role={item.checked === undefined ? "menuitem" : "menuitemradio"}
            aria-checked={item.checked}
            disabled={item.disabled}
            data-testid={item.testId ?? "toolbox-item"}
            data-armed={armed === i || undefined}
            className={cn(MENU_ITEM, "w-full px-2 py-1.5", item.danger && "text-im-warn")}
            onClick={() => (item.confirm && armed !== i ? setArmed(i) : run(item.act))}
          >
            <span className="w-3 flex-none text-im-logical">{item.checked ? "✓" : ""}</span>
            {/* an armed item's text wraps: it may name what the delete changes (slice 10c, F7) */}
            <span className={`min-w-0 flex-1 ${armed === i ? "whitespace-normal" : "truncate"}`}>{armed === i ? item.confirm : item.label}</span>
            {item.kbd && <kbd className="flex-none font-sans text-small text-im-ink-3">{item.kbd}</kbd>}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
