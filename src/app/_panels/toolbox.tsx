"use client";

// The right-click toolbox on the canvas (slice 1b, D-19; prototype #cmenu): a short menu for what was clicked, at the
// mouse, kept on the screen. Headings, actions (with their shortcut, checked, disabled, danger), segmented choices
// and, on the empty canvas, “Add an entity or table here…”: a search whose first result Enter picks. ↑/↓ move between
// actions, Esc or a click elsewhere closes it.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ToolboxItem =
  | { head: string }
  | { sep: true }
  | { label: string; act: () => void; kbd?: string; danger?: boolean; disabled?: boolean; checked?: boolean; testId?: string }
  | { seg: string; options: { label: string; on: boolean; act: () => void }[] }
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
      className="fixed z-50 w-[260px] rounded-lg border border-im-line bg-im-surface p-1 text-[13px] shadow-lg"
      style={{ left: pos.x, top: pos.y }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {list.map((item, i) => {
        if ("head" in item) {
          return (
            <div key={i} className="truncate px-2 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-im-ink-3">
              {item.head}
            </div>
          );
        }
        if ("sep" in item) return <hr key={i} className="my-1 border-im-line" />;
        if ("search" in item) {
          return (
            <div key={i} className="pb-1">
              <input
                className="h-8 w-full rounded-md border border-im-line bg-im-surface px-2 text-[13px] outline-none focus:border-im-logical"
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
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-im-hover ${j === 0 ? "bg-im-hover" : ""}`}
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
            <div key={i} className="px-2 py-1">
              <div className="mb-1 text-[11px] text-im-ink-3">{item.seg}</div>
              <div className="flex rounded-[7px] bg-im-hover p-0.5">
                {item.options.map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    aria-pressed={o.on}
                    className="h-6 flex-1 rounded-[5px] text-[12px] text-im-ink-2 aria-pressed:bg-im-surface aria-pressed:text-im-ink aria-pressed:shadow-[0_0_0_1px_var(--im-line)]"
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
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-im-hover focus-visible:bg-im-hover focus-visible:outline-none disabled:opacity-40 disabled:hover:bg-transparent ${item.danger ? "text-im-warn" : ""}`}
            onClick={() => run(item.act)}
          >
            <span className="w-3 flex-none text-im-logical">{item.checked ? "✓" : ""}</span>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.kbd && <kbd className="flex-none font-sans text-[11px] text-im-ink-3">{item.kbd}</kbd>}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
