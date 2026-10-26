"use client";

// The view-state bar (slice 6a, D-39; prototype viewState, renderNavBar, .vstate): at the right end of a canvas page's
// breadcrumbs row, one chip for each thing that hides or fades items on this canvas, in the prototype's order and
// wording, each with × (`data-voff`). A live canvas's “Live: {name}” comes first and has no ×. The row keeps its height:
// chips that do not fit fold into “+{n}” from the end, whose menu lists them; the breadcrumbs shrink first (Łukasz's
// step 1 answer 3). “Show all” ends the bar, always visible, from two removable chips. No lens chip (slice 4b-1 removed
// the lens), no role chip (the user indicator shows it), no chip while drawing a relationship.
// The bar reads the canvas through stores and the canvas context (`focusOn`, `changesOn`, `viewCounts`, `ui.mode`), never through
// `ModelCanvas`, so a chip appearing or going re-renders only the bar (S6A-08). The fold is measured on the bar's own
// elements (AD-24 rule 4), by a ResizeObserver: nothing here reads layout during a commit.

import { usePathname } from "next/navigation";
import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CanvasUiCtx, type CanvasMode } from "@/canvas/context";
import { changesOn } from "@/canvas/changes-view";
import { focusOn } from "@/canvas/fade";
import { useCanvasLook } from "@/canvas/look";
import { useValue } from "@/canvas/value-store";
import { viewCounts } from "@/canvas/view-counts";
import { fitChips } from "@/ui/fit-chips";
import { useToast } from "@/ui/components/toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/components/dropdown-menu";

export interface ViewChip {
  /** Names its test id (`chip-<id>`, its × `chip-<id>-off`). */
  id: string;
  text: string;
  title: string;
  /** Turns the item off; none: the chip has no × (who cannot change it). */
  off?: () => void;
}

const EDITORS_ONLY = " Only editors can change this.";
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** The tools that change what a click does, as the prototype's chip names them; drawing a relationship has none. */
const TOOL_CHIP: Record<string, { text: string; title: string }> = {
  entity: { text: "Entity tool", title: "Entity tool (E): click on the canvas to create a new entity there" },
  frame: { text: "Frame tool", title: "Frame tool (A): drag on the canvas to draw a frame" },
  note: { text: "Note tool", title: "Note tool (N): click on the canvas, a card or a frame's name" },
  hand: { text: "Hand tool", title: "Hand tool (H): drag anywhere to move the canvas. V or Esc returns to selecting" },
};

/** The chips that are on, in the prototype's order (`viewState`). */
export function useViewChips(editable: boolean): ViewChip[] {
  const ui = useContext(CanvasUiCtx);
  const look = useCanvasLook();
  const focus = useValue(focusOn);
  const changes = useValue(changesOn);
  const counts = useValue(viewCounts);
  const chips: ViewChip[] = [];
  if (focus) chips.push({ id: "focus", text: "Focus", title: "Everything not connected to the selection is faded", off: () => focusOn.set(false) });
  // the Changes view (slice 7b, D-39): it and Focus exclude each other, so at most one of the two chips shows
  if (changes) chips.push({ id: "changes", text: `Changes: ${changes.chip}`, title: "Everything source changes do not touch is faded", off: () => changesOn.set(null) });
  const layer = look?.look.layer ?? "all";
  if (layer !== "all")
    chips.push({
      id: "layer",
      text: layer === "mappings" ? "Mappings only" : "Relationships only",
      title: "The other lines are hidden",
      off: () => look?.setLook({ layer: "all" }),
    });
  if (counts?.filtered)
    chips.push({
      id: "filtered",
      text: `${plural(counts.filtered, "card")} filtered`,
      title: `Some rows of these cards are hidden by their row filter.${editable ? "" : EDITORS_ONLY}`,
      off: editable ? () => void ui.resetView({ filters: true }) : undefined,
    });
  if (counts?.collapsedCards)
    chips.push({
      id: "collapsed-cards",
      text: `${plural(counts.collapsedCards, "card")} collapsed`,
      title: `These cards show their header only.${editable ? "" : EDITORS_ONLY}`,
      off: editable ? () => void ui.resetView({ expandCards: true }) : undefined,
    });
  if (counts?.collapsedFrames)
    chips.push({
      id: "collapsed-frames",
      text: `${plural(counts.collapsedFrames, "frame")} collapsed`,
      title: "These frames show as blocks",
      off: () => ui.setAllFramesCollapsed(false),
    });
  if (ui.hideResolved && counts?.resolvedNotes)
    chips.push({ id: "notes-hidden", text: "Resolved notes hidden", title: "Resolved notes are not shown on the canvas", off: () => ui.setHideResolved(false) });
  const tool = toolChip(ui.mode);
  if (tool) chips.push({ id: "tool", ...tool, off: () => ui.setMode(null) });
  return chips;
}

/**
 * “Show all” (slice 6a, item 5 as amended; prototype `data-vall`): turns off Focus, the Changes view (slice 7b), the layer, hidden notes and the tool
 * in the browser, and sends the layout part (filters, collapsed cards and frames) as one change, one undo step, only
 * when something changes; the toast offers Undo when that step exists. Reviewers and readers remove only what they may:
 * frames expand in their tab. A live canvas's Labeled filter stays.
 */
function useShowAll(): () => void {
  const ui = useContext(CanvasUiCtx);
  const look = useCanvasLook();
  const toast = useToast();
  return useCallback(() => {
    focusOn.set(false);
    changesOn.set(null);
    if (look && look.look.layer !== "all") look.setLook({ layer: "all" });
    if (ui.hideResolved) ui.setHideResolved(false);
    if (ui.mode) ui.setMode(null);
    void ui.resetView({ filters: true, expandCards: true, expandFrames: true }).then((saved) => {
      const u = saved ? ui.undo() : null;
      toast(SHOW_ALL_TOAST, "info", u ? { label: "Undo", run: u.undo } : undefined);
    });
  }, [ui, look, toast]);
}

export const SHOW_ALL_TOAST = "Showing everything on this canvas.";

const toolChip = (mode: CanvasMode) => (mode && mode.kind !== "relate" ? (TOOL_CHIP[mode.kind] ?? null) : null);

/** Room a chip at the edge needs beyond its width before it comes back from “+{n}”, so it cannot flip on every resize. */
const HYSTERESIS = 16;
/** The row's padding (`px-2`) and its gap between the breadcrumbs and the bar (`gap-1.5`). */
const ROW_PADDING = 16;
const ROW_GAP = 6;
/** The gap between chips (`gap-[5px]`, prototype `.vstate`). */
const CHIP_GAP = 5;
/** A breadcrumb above the current one shrinks to this width (`min-w-10`). */
const CRUMB_MIN = 40;
/** The gap between breadcrumbs and their separators (`gap-0.5`). */
const CRUMB_GAP = 2;

export function ViewStateBar({ editable, live }: { editable: boolean; live: { labelName: string } | null }) {
  const chips = useViewChips(editable);
  const showAll = useShowAll();
  // from two items that this person can remove (prototype: two items; Łukasz's step 1 answer 8)
  const withShowAll = chips.filter((c) => c.off).length >= 2;
  const barRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  // how many chips are folded into “+{n}”, from the end: a chip that appears shows at once (clipped for a frame at most)
  // and folds when the observer has measured it
  const [folded, setFolded] = useState(0);
  const foldedRef = useRef(folded);
  const key = `${chips.map((c) => `${c.text}${c.off ? "×" : ""}`).join("|")}${withShowAll ? "|all" : ""}`;

  /**
   * How many chips fit: the breadcrumbs keep their current crumb, the ones above it shrink first. Every width comes from
   * the ResizeObserver below (`sizes`), never from reading layout here: a chip that appears in the same commit as a
   * canvas restyle (a tool's class) would otherwise force that restyle and a layout of the page inside the commit
   * (S6A-09-hand, slice 6a step 4). A chip may show clipped for one frame before it folds; the row's height never changes.
   */
  const sizes = useRef(new Map<Element, number>());
  const fold = useCallback(() => {
    const bar = barRef.current, measure = measureRef.current;
    const row = bar?.parentElement;
    const rowWidth = row ? sizes.current.get(row) : undefined;
    if (!bar || !measure || !row || rowWidth === undefined) return;
    const size = (el: Element) => sizes.current.get(el);
    // Back and Forward before the breadcrumbs (slice 6b): fixed, never folded
    let crumbs = 0;
    const history = row.querySelector("[data-testid='nav-history']");
    if (history) {
      const w = size(history);
      if (w === undefined) return;
      crumbs += w + ROW_GAP;
    }
    const items = [...(row.querySelector("ol")?.children ?? [])];
    for (const [i, li] of items.entries()) {
      const w = i === items.length - 1 || li.getAttribute("aria-hidden") ? size(li) : CRUMB_MIN;
      if (w === undefined) return;
      crumbs += (i ? CRUMB_GAP : 0) + w;
    }
    const widths = [...measure.children].map(size);
    if (widths.some((w) => w === undefined)) return;
    const known = widths as number[];
    const all = withShowAll ? known.pop()! + CHIP_GAP : 0;
    const plus = known.pop() ?? 0;
    const liveWidth = live ? known.shift()! + CHIP_GAP : 0;
    const room = rowWidth - ROW_PADDING - ROW_GAP - crumbs - liveWidth - all;
    const n = known.length;
    const k = fitChips({ widths: known, gap: CHIP_GAP, plus, room, shown: n - Math.min(foldedRef.current, n), hysteresis: HYSTERESIS });
    foldedRef.current = n - k;
    setFolded(n - k);
  }, [live, withShowAll]);

  // The row, its breadcrumbs and the chips at their natural widths (the hidden copy), observed again whenever the chips
  // or the page change: observing reads nothing, and the observer reports each element's size after the browser's own
  // layout, then the fold runs.
  const pathname = usePathname();
  useEffect(() => {
    const row = barRef.current?.parentElement, measure = measureRef.current;
    if (!row || !measure) return;
    sizes.current = new Map();
    const observer = new ResizeObserver((entries) => {
      for (const e of entries) sizes.current.set(e.target, e.borderBoxSize[0]?.inlineSize ?? e.contentRect.width);
      fold();
    });
    observer.observe(row);
    const history = row.querySelector("[data-testid='nav-history']");
    for (const el of [...(history ? [history] : []), ...(row.querySelector("ol")?.children ?? []), ...measure.children]) observer.observe(el);
    return () => observer.disconnect();
  }, [key, fold, pathname]);

  const shown = chips.length - Math.min(folded, chips.length);
  const visible = chips.slice(0, shown);
  const inMore = chips.slice(shown);
  return (
    <div ref={barRef} data-testid="bar-view-state" className="relative ml-auto flex min-w-0 flex-none items-center gap-[5px]">
      {live && (
        <span data-testid="chip-live" title="This canvas follows the label" className={`${chipClass} border border-dashed border-im-ink-3 pr-2`}>
          Live: {live.labelName}
        </span>
      )}
      {visible.map((c) => (
        <Chip key={c.id} chip={c} />
      ))}
      {inMore.length > 0 && <MoreChips chips={inMore} />}
      {withShowAll && (
        <button type="button" data-testid="button-view-show-all" title="Remove everything that hides or fades things on this canvas" onClick={showAll} className={showAllClass}>
          Show all
        </button>
      )}
      {/* the chips at their natural widths, for the fold; never seen, never focused */}
      <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex w-max">
        {live && <span className={`${chipClass} border border-dashed pr-2`}>Live: {live.labelName}</span>}
        {chips.map((c) => (
          <Chip key={c.id} chip={c} measure />
        ))}
        <span className={`${chipClass} pr-2`}>+{chips.length}</span>
        {withShowAll && <span className={showAllClass}>Show all</span>}
      </div>
    </div>
  );
}

const chipClass =
  "inline-flex h-[22px] flex-none items-center gap-[3px] whitespace-nowrap rounded-[11px] bg-im-surface pl-2 text-im-ink-2 shadow-[0_0_0_1px_var(--im-line)]";
/** The prototype's `.btn.sm.vreset`. */
const showAllClass =
  "inline-flex h-6 flex-none items-center whitespace-nowrap rounded-md border border-im-line bg-im-surface px-2.5 text-xs text-im-ink hover:bg-im-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-im-logical";
const offClass =
  "grid size-[18px] place-items-center rounded-full text-im-ink-3 hover:bg-im-hover hover:text-im-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-im-logical";

function Chip({ chip, measure = false }: { chip: ViewChip; measure?: boolean }) {
  return (
    <span data-testid={measure ? undefined : `chip-${chip.id}`} title={chip.title} className={`${chipClass} ${chip.off ? "pr-[3px]" : "pr-2"}`}>
      {chip.text}
      {chip.off && (
        <button
          type="button"
          title="Remove"
          aria-label={`Remove ${chip.text}`}
          data-testid={measure ? undefined : `chip-${chip.id}-off`}
          tabIndex={measure ? -1 : undefined}
          onClick={chip.off}
          className={offClass}
        >
          ×
        </button>
      )}
    </span>
  );
}

/** “+{n}”: the chips that do not fit, each with its × (or its tooltip, for who cannot change it). */
function MoreChips({ chips }: { chips: ViewChip[] }): ReactNode {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="chip-more"
        title={chips.map((c) => c.text).join(", ")}
        className={`${chipClass} pr-2 outline-none hover:bg-im-hover focus-visible:ring-2 focus-visible:ring-im-logical`}
      >
        +{chips.length}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        data-testid="menu-chips-more"
        className="min-w-[200px] rounded-lg border-0 bg-im-surface p-1 text-[12.5px] text-im-ink shadow-[0_0_0_1px_var(--im-line),0_12px_28px_-10px_var(--im-shadow)]"
      >
        {chips.map((c) => (
          <DropdownMenuItem
            key={c.id}
            data-testid="menu-item-chip"
            data-chip={c.id}
            title={c.title}
            disabled={!c.off}
            onSelect={() => c.off?.()}
            aria-label={c.off ? `Remove ${c.text}` : c.text}
            className="flex cursor-pointer items-center justify-between gap-4 rounded-[5px] px-2.5 py-[6px] focus:bg-im-hover data-[disabled]:cursor-default data-[highlighted]:bg-im-hover"
          >
            <span>{c.text}</span>
            {c.off && <span className="text-im-ink-3">×</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
