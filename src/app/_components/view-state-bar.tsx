"use client";

// The view-state bar (slice 6a, D-39; prototype viewState, renderNavBar, .vstate): at the right end of a canvas page's
// breadcrumbs row, one chip for each thing that hides or fades items on this canvas, in the prototype's order and
// wording, each with × (`data-voff`). A live canvas's “Live: {name}” comes first and has no ×. The row keeps its height:
// chips that do not fit fold into “+{n}” from the end, whose menu lists them; the breadcrumbs shrink first (Łukasz's
// step 1 answer 3). No lens chip (slice 4b-1 removed the lens), no role chip (the user indicator shows it), no chip
// while drawing a relationship.
// The bar reads the canvas through stores and the canvas context (`focusOn`, `viewCounts`, `ui.mode`), never through
// `ModelCanvas`, so a chip appearing or going re-renders only the bar (S6A-08). The fold is measured on the bar's own
// elements (AD-24 rule 4).

import { useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CanvasUiCtx, type CanvasMode } from "@/canvas/context";
import { focusOn } from "@/canvas/fade";
import { useCanvasLook } from "@/canvas/look";
import { useValue } from "@/canvas/value-store";
import { viewCounts } from "@/canvas/view-counts";
import { fitChips } from "@/ui/fit-chips";
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
  const counts = useValue(viewCounts);
  const chips: ViewChip[] = [];
  if (focus) chips.push({ id: "focus", text: "Focus", title: "Everything not connected to the selection is faded", off: () => focusOn.set(false) });
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
    });
  if (counts?.collapsedCards)
    chips.push({
      id: "collapsed-cards",
      text: `${plural(counts.collapsedCards, "card")} collapsed`,
      title: `These cards show their header only.${editable ? "" : EDITORS_ONLY}`,
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
  const barRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(chips.length);
  const shownRef = useRef(shown);
  const key = chips.map((c) => c.text).join("|");

  /** How many chips fit: the breadcrumbs keep their current crumb, the ones above it shrink first. */
  const fold = useCallback(() => {
    const bar = barRef.current, measure = measureRef.current;
    const row = bar?.parentElement;
    if (!bar || !measure || !row) return;
    let crumbs = 0;
    const list = row.querySelector("ol");
    if (list) {
      const items = [...list.children] as HTMLElement[];
      items.forEach((li, i) => (crumbs += (i ? CRUMB_GAP : 0) + (i === items.length - 1 || li.getAttribute("aria-hidden") ? li.offsetWidth : CRUMB_MIN)));
    }
    const widths = [...measure.children].map((el) => (el as HTMLElement).offsetWidth);
    const plus = widths.pop() ?? 0;
    const liveWidth = live ? widths.shift()! + CHIP_GAP : 0;
    const room = row.clientWidth - ROW_PADDING - ROW_GAP - crumbs - liveWidth;
    const k = fitChips({ widths, gap: CHIP_GAP, plus, room, shown: shownRef.current, hysteresis: HYSTERESIS });
    shownRef.current = k;
    setShown(k);
  }, [live]);

  useLayoutEffect(() => {
    shownRef.current = chips.length;
    fold();
  }, [key, fold, chips.length]);
  useLayoutEffect(() => {
    const row = barRef.current?.parentElement;
    if (!row) return;
    const observer = new ResizeObserver(() => fold());
    observer.observe(row);
    return () => observer.disconnect();
  }, [fold]);

  const visible = chips.slice(0, shown);
  const folded = chips.slice(shown);
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
      {folded.length > 0 && <MoreChips chips={folded} />}
      {/* the chips at their natural widths, for the fold; never seen, never focused */}
      <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex w-max">
        {live && <span className={`${chipClass} border border-dashed pr-2`}>Live: {live.labelName}</span>}
        {chips.map((c) => (
          <Chip key={c.id} chip={c} measure />
        ))}
        <span className={`${chipClass} pr-2`}>+{chips.length}</span>
      </div>
    </div>
  );
}

const chipClass =
  "inline-flex h-[22px] flex-none items-center gap-[3px] whitespace-nowrap rounded-[11px] bg-im-surface pl-2 text-im-ink-2 shadow-[0_0_0_1px_var(--im-line)]";
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
