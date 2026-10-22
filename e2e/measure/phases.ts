// Phase traces (slice 6a, S6A-09-hand; shared since slice 6b, S6B-10): the main thread's work after a mark, by phase
// (script, style with its element count, layout with its dirty and total objects, pre-paint, paint, layerize, commit).
// Once an addition costs a few milliseconds, these are compared with and without it, not unprepared medians to the
// screen (CLAUDE.md).

import type { TraceEvent } from "../../scripts/lib/to-screen";

export const PHASE_CATEGORIES = ["devtools.timeline", "disabled-by-default-devtools.timeline", "blink.user_timing", "v8.execute"];

const PHASES: Record<string, string> = {
  FunctionCall: "script",
  EventDispatch: "script",
  TimerFire: "script",
  FireAnimationFrame: "script",
  RunMicrotasks: "script",
  UpdateLayoutTree: "style",
  Layout: "layout",
  PrePaint: "prePaint",
  Paint: "paint",
  Layerize: "layerize",
  Commit: "commit",
};

/** The main thread's phases in the `windowMs` after a mark (`performance.mark(name)`), or null without the mark. */
export function phasesAfter(events: readonly TraceEvent[], name: string, windowMs = 300) {
  const mark = events.find((e) => e.name === name && (e.ph === "R" || e.ph === "I" || e.ph === "i" || e.ph === "b" || e.ph === "n"));
  if (!mark) return null;
  const from = mark.ts, to = mark.ts + windowMs * 1000;
  const main = events.filter((e) => e.pid === mark.pid && e.tid === mark.tid && e.ph === "X" && e.ts >= from && e.ts <= to);
  const ms: Record<string, number> = {};
  let styleElements = 0, layoutDirty = 0, layoutTotal = 0, paints = 0, forced = 0;
  // only the outermost event of each phase counts (a nested FunctionCall inside EventDispatch is not added twice)
  const open: { end: number; phase: string }[] = [];
  for (const e of [...main].sort((a, b) => a.ts - b.ts)) {
    const phase = PHASES[e.name];
    if (!phase) continue;
    while (open.length && open[open.length - 1]!.end <= e.ts) open.pop();
    const inside = open.some((o) => o.phase === phase);
    // style or layout inside a script call: forced by a read of layout
    if ((phase === "style" || phase === "layout") && open.some((o) => o.phase === "script")) forced++;
    open.push({ end: e.ts + (e.dur ?? 0), phase });
    if (inside) continue;
    ms[phase] = (ms[phase] ?? 0) + (e.dur ?? 0) / 1000;
    const args = (e.args ?? {}) as { elementCount?: number; beginData?: { dirtyObjects?: number; totalObjects?: number } };
    if (e.name === "UpdateLayoutTree") styleElements += args.elementCount ?? 0;
    if (e.name === "Layout") {
      layoutDirty += args.beginData?.dirtyObjects ?? 0;
      layoutTotal += args.beginData?.totalObjects ?? 0;
    }
    if (e.name === "Paint") paints++;
  }
  for (const k of Object.keys(ms)) ms[k] = +ms[k]!.toFixed(2);
  return { ms, styleElements, layoutDirty, layoutTotal, paints, forced };
}

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? +s[Math.floor(s.length / 2)]!.toFixed(2) : 0;
};

/** The medians of several runs' phases. */
export function medianPhases(runs: readonly NonNullable<ReturnType<typeof phasesAfter>>[]) {
  const phases = [...new Set(runs.flatMap((r) => Object.keys(r.ms)))];
  return {
    medianMs: Object.fromEntries(phases.map((ph) => [ph, median(runs.map((r) => r.ms[ph] ?? 0))])),
    styleElements: median(runs.map((r) => r.styleElements)),
    layoutDirtyObjects: median(runs.map((r) => r.layoutDirty)),
    layoutTotalObjects: median(runs.map((r) => r.layoutTotal)),
    paints: median(runs.map((r) => r.paints)),
    forced: median(runs.map((r) => r.forced)),
  };
}
