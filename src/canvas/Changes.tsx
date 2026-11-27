"use client";

// The Changes view (slice 7b, items 26–27, P11; prototype #tChg, chgSet, renderChgBar): fades everything that source
// changes do not touch, all open changes or one import's, through the fade layer (`fade.ts`); a view, never an edit.
// On and off from the toolbar button (after Focus, into “More” at Focus's step), “Show what it touched on the canvas”
// in the system panel's imports (F16), its bar's Close and its chip in the view-state bar (×, and “Show all”).
// Momentary like Focus (D-22): off after a reload and when switching canvas, outside undo. The Changes view and Focus
// turn each other off (Q6, D-39): one owner of the fade request at a time.
// The state is a store of its own (`changesOn`) and `ChangesDriver` turns it and the page's data into the request and
// the bar's counts (`changesCounts`), so switching it never re-renders the canvas; only the fading and the bar draw.

import { memo, useEffect, useMemo, useRef } from "react";
import { touchedBy, touchedKey } from "@/domain/source-changes/touched";
import { ALL_OPEN, CHANGES_TITLE, changesCounts, changesOn, NOTHING_ON_RECORD, toggleChanges } from "./changes-view";
import type { ChangesImport } from "./changes-import";
import { currentFade, fadeKey, requestFade } from "./fade";
import type { FadeData } from "./fade-canvas";
import { useValue } from "./value-store";
import { Select } from "@/ui/components/select";
import { toolButtonVariants } from "@/ui/components/tool-button";

const isChangesRequest = () => fadeKey(currentFade()).startsWith("lit:changes:");

/**
 * Turns the Changes view and the page's data into the fade request and the bar's counts. Renders nothing. Turning the
 * view off clears only its own request (Focus may own it by then); leaving or switching the canvas turns it off.
 */
export const ChangesDriver = memo(function ChangesDriver({ data, canvasId }: { data: FadeData | undefined; canvasId: string }) {
  const view = useValue(changesOn);
  const model = data?.model, changes = data?.changes;
  const touched = useMemo(() => (view && model ? touchedBy(model, changes ?? [], view.sel) : null), [view, model, changes]);
  const was = useRef(false);
  useEffect(() => {
    if (view && touched) {
      requestFade({ lit: touched.lit, key: touchedKey(view.sel, touched) });
      changesCounts.set({ tables: touched.tables, mappings: touched.mappings, attributes: touched.attributes });
    } else if (was.current) {
      if (isChangesRequest()) requestFade(null);
      changesCounts.set(null);
    }
    was.current = !!view;
  }, [view, touched]);
  useEffect(
    () => () => {
      changesOn.set(null);
      changesCounts.set(null);
      if (isChangesRequest()) requestFade(null);
    },
    [canvasId],
  );
  return null;
});

/** The toolbar's Changes button (prototype #tChg): after Focus; every role has it. */
export function ChangesButton() {
  const on = !!useValue(changesOn);
  return (
    <button
      type="button"
      aria-pressed={on}
      title={CHANGES_TITLE}
      aria-label="Changes"
      data-testid="button-changes"
      onClick={toggleChanges}
      className={toolButtonVariants({ tone: "warn", size: "toolbar" })}
    >
      <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.4] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden>
        <path d="M8 2l6 11H2z" />
        <path d="M8 6.5v3M8 11.3v.2" />
      </svg>
    </button>
  );
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * The view's bar (prototype renderChgBar): “Changes”, the select (all open changes or one import), what it lights or
 * “Nothing on record”, and Close. Over the canvas at the top, centred, under the canvas toolbar (slice 38: 8 px below
 * its bottom); it reads no layout.
 */
export function ChangesBar({ imports }: { imports: readonly ChangesImport[] }) {
  const view = useValue(changesOn);
  const counts = useValue(changesCounts);
  if (!view) return null;
  return (
    <div
      className="absolute left-1/2 top-[58px] z-40 flex max-w-[calc(100%-20px)] -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-lg border border-im-warn bg-im-surface py-1.5 pl-3 pr-2.5 text-[12.5px] shadow-[0_4px_16px_var(--im-shadow)]"
      data-testid="bar-changes"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <b className="font-semibold">Changes</b>
      <Select
        size="sm"
        aria-label="Which changes"
        className="w-auto max-w-[260px]"
        value={view.sel}
        onChange={(e) => {
          const i = imports.find((x) => x.id === e.target.value);
          changesOn.set(i ? { sel: i.id, chip: i.chip } : ALL_OPEN);
        }}
        data-testid="select-changes"
      >
        <option value="open">All open changes</option>
        {imports.map((i) => (
          <option key={i.id} value={i.id}>
            {i.label}
          </option>
        ))}
      </Select>
      <span className="text-im-ink-3" data-testid="text-changes-counts">
        {!counts ? "" : counts.tables ? `${plural(counts.tables, "table")}, ${plural(counts.mappings, "mapping")}, ${plural(counts.attributes, "attribute")}` : NOTHING_ON_RECORD}
      </span>
      <button type="button" className="text-im-logical hover:underline" onClick={() => changesOn.set(null)} data-testid="button-changes-close">
        Close
      </button>
    </div>
  );
}
