// Measuring to the screen (slice 4b-1, step 2; method from step 0, `docs/perf/04b1-step0-switch-trace.md`): pure functions
// on the events of a Chrome trace (Chrome DevTools Protocol, `Tracing.dataCollected`). Used by the measuring specs
// (`e2e/measure/`), by `scripts/to-screen.ts` on saved traces, and by `scripts/measure-canvas.ts`'s summary.
//
// - A switch is bracketed in the page by a `performance.measure` named `sw:<on|off>:<k>`. Its time to the screen ends
//   at the first GPU present that ends after the compositor's activation (`ActivateLayerTree`) of the switch's commit:
//   the first `ActivateLayerTree` after the start of the first main-thread `Commit` after the switch's start. Not the end
//   of the `Commit` slice: it blocks until the compositor has the commit, and a cheap frame (C-10's hover) is activated,
//   drawn and presented before it ends (step 0's analyser fix).
// - Settled: no GPU raster runs at the switch's start, and the last raster before it has been presented. With switches
//   back to back a switch inherits the previous one's raster; the specs pause 1.2 s between switches so it does not.
// - The split, from the start to that present: the renderer main thread's busy time, the GPU main thread's raster
//   outside it, and the rest (compositor, Viz, present, waiting).
// - Presented frames (pan and zoom): the GPU presents inside a window bracketed by `performance.measure("pan:<name>")`.

export interface TraceEvent {
  name: string;
  ph: string;
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  cat?: string;
  args?: Record<string, unknown>;
}

export interface Stats {
  n: number;
  median: number;
  p95: number;
  max: number;
}

export interface SwitchResult {
  name: string;
  dir: string;
  k: number;
  /** The page's own time (as 4p's specs measure it), from the measure's bracket. */
  inPageMs: number;
  /** null when no present followed in the trace (the trace ended first). */
  toScreenMs: number | null;
  mainMs: number;
  rasterMs: number;
  restMs: number;
  settled: boolean;
}

export interface PresentedFrames {
  durationMs: number;
  presents: number;
  fps: number;
  /** Intervals between presents over 50 ms (the first present counts from the window's start). */
  over50ms: number;
  maxIntervalMs: number;
  p95IntervalMs: number;
  /** What marks a present in this trace: the GPU's swap chain present (Windows), else Viz's draw and swap. */
  source: string;
  /** Chrome's frame reporter states inside the window, when the trace has them (`graphics.pipeline`). */
  pipelineStates: Record<string, number>;
}

/** The categories for interactions to the screen (step 0's set) and the lighter set for pans. */
export const FULL_CATEGORIES = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "blink.user_timing",
  "v8.execute",
  "toplevel",
  "benchmark",
  "cc",
  "gpu",
  "viz",
  "__metadata",
];
export const LIGHT_CATEGORIES = ["viz", "gpu", "benchmark", "graphics.pipeline", "blink.user_timing", "__metadata"];

const PRESENT = "DXGISwapChainImageBacking::Present";
const DRAW_AND_SWAP = "Display::DrawAndSwap";
const RASTER = new Set(["RasterDecoderImpl::DoRasterCHROMIUM", "RasterDecoderImpl::DoEndRasterCHROMIUM"]);

/** The median, p95 and maximum of a list (the method since slice 4p: median, p95 and max). */
export function stats(xs: readonly number[]): Stats {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return { n: 0, median: NaN, p95: NaN, max: NaN };
  const r = (v: number) => +v.toFixed(1);
  return { n: s.length, median: r(s[Math.floor(s.length / 2)]!), p95: r(s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]!), max: r(s[s.length - 1]!) };
}

/** The total length of intervals, overlaps counted once, clipped to [a, b]. */
export function union(intervals: readonly (readonly [number, number])[], a: number, b: number): number {
  const xs = intervals
    .map(([s, e]) => [Math.max(s, a), Math.min(e, b)] as const)
    .filter(([s, e]) => e > s)
    .sort((x, y) => x[0] - y[0]);
  let total = 0, cs = -Infinity, ce = -Infinity;
  for (const [s, e] of xs) {
    if (s > ce) {
      if (ce > cs) total += ce - cs;
      cs = s;
      ce = e;
    } else ce = Math.max(ce, e);
  }
  if (ce > cs) total += ce - cs;
  return total;
}

/** What the analysis needs from a trace, looked up once. */
export function traceIndex(events: readonly TraceEvent[], rendererPid?: number) {
  const names = new Map<string, string>();
  for (const e of events) if (e.ph === "M" && e.name === "thread_name") names.set(`${e.pid}:${e.tid}`, String(e.args?.name ?? ""));
  const thread = (e: TraceEvent) => names.get(`${e.pid}:${e.tid}`) ?? "";
  const marks = events.filter((e) => e.cat?.includes("user_timing") && (e.ph === "b" || e.ph === "e"));
  const renderer = rendererPid ?? marks[0]?.pid ?? events.find((e) => thread(e) === "CrRendererMain")?.pid;
  const slices = events.filter((e) => e.ph === "X" && e.dur);
  const sorted = (xs: number[]) => xs.sort((a, b) => a - b);
  const presentsOf = (name: string) => sorted(slices.filter((e) => thread(e) === "CrGpuMain" && e.name === name).map((e) => e.ts + e.dur!));
  let presents = presentsOf(PRESENT);
  let source = PRESENT;
  if (!presents.length) {
    presents = sorted(slices.filter((e) => thread(e) === "VizCompositorThread" && e.name === DRAW_AND_SWAP).map((e) => e.ts + e.dur!));
    source = DRAW_AND_SWAP;
  }
  return {
    thread,
    marks,
    renderer,
    source,
    presents,
    commits: sorted(slices.filter((e) => e.pid === renderer && thread(e) === "CrRendererMain" && e.name === "Commit").map((e) => e.ts)),
    activations: sorted(events.filter((e) => e.pid === renderer && thread(e) === "Compositor" && e.name === "ActivateLayerTree").map((e) => e.ts)),
    main: slices.filter((e) => e.pid === renderer && thread(e) === "CrRendererMain" && e.name === "RunTask").map((e) => [e.ts, e.ts + e.dur!] as const),
    raster: slices.filter((e) => thread(e) === "CrGpuMain" && RASTER.has(e.name)).map((e) => [e.ts, e.ts + e.dur!] as const),
    pipeline: events.filter((e) => e.name === "PipelineReporter" && (e.ph === "b" || e.ph === "X")),
  };
}
export type TraceIndex = ReturnType<typeof traceIndex>;

/**
 * The present that shows what the page changed at `start` (trace time, µs): the first present ending after the
 * activation of the first commit that starts after `start`. null if the trace has none.
 */
export function presentAfter(ix: TraceIndex, start: number): number | null {
  const commit = ix.commits.find((c) => c > start);
  if (commit === undefined) return null;
  const activation = ix.activations.find((a) => a > commit);
  if (activation === undefined) return null;
  return ix.presents.find((p) => p > activation) ?? null;
}

/** How long before a switch the last raster must have ended when no present followed it (µs). */
const SETTLE_US = 50_000;

/**
 * Settled at `start`: no raster running, and the last raster before it either ended at least 50 ms earlier or was
 * presented before the start. Chrome often rasters a few tiles after the last present that change nothing on the screen
 * (no present follows them); a raster just before the start that was presented is the lasso's drag (step 0).
 */
export function settledAt(ix: TraceIndex, start: number): boolean {
  if (ix.raster.some(([s, e]) => s < start && e > start)) return false;
  const last = ix.raster.reduce((m, [, e]) => (e <= start && e > m ? e : m), -Infinity);
  return last <= start - SETTLE_US || ix.presents.some((p) => p > last && p <= start);
}

/** Main thread, raster and rest between `start` and `end` (ms). */
export function split(ix: TraceIndex, start: number, end: number) {
  const total = (end - start) / 1000;
  const main = union(ix.main, start, end) / 1000;
  const both = union([...ix.main, ...ix.raster], start, end) / 1000;
  const r = (v: number) => +v.toFixed(1);
  return { mainMs: r(main), rasterMs: r(both - main), restMs: r(total - both) };
}

/** Every switch the page bracketed (`sw:<dir>:<k>`), to the screen and split. */
export function switchesOf(events: readonly TraceEvent[], ix: TraceIndex = traceIndex(events)): SwitchResult[] {
  const begins = new Map<string, number>();
  const out: SwitchResult[] = [];
  for (const m of [...ix.marks].sort((a, b) => a.ts - b.ts)) {
    if (!m.name.startsWith("sw:")) continue;
    if (m.ph === "b") begins.set(m.name, m.ts);
    else if (begins.has(m.name)) {
      const start = begins.get(m.name)!;
      begins.delete(m.name);
      const [, dir = "", k = "0"] = m.name.split(":");
      const present = presentAfter(ix, start);
      const parts = present === null ? { mainMs: NaN, rasterMs: NaN, restMs: NaN } : split(ix, start, present);
      out.push({ name: m.name, dir, k: Number(k), inPageMs: +((m.ts - start) / 1000).toFixed(1), toScreenMs: present === null ? null : +((present - start) / 1000).toFixed(1), ...parts, settled: settledAt(ix, start) });
    }
  }
  return out;
}

/** Presented frames inside the window bracketed by `performance.measure(name)` (or the whole trace without a name). */
export function presentedFrames(events: readonly TraceEvent[], windowName?: string, ix: TraceIndex = traceIndex(events)): PresentedFrames | null {
  let from = -Infinity, to = Infinity;
  if (windowName) {
    const b = ix.marks.find((m) => m.name === windowName && m.ph === "b"), e = ix.marks.find((m) => m.name === windowName && m.ph === "e");
    if (!b || !e) return null;
    from = b.ts;
    to = e.ts;
  } else if (ix.presents.length) {
    from = ix.presents[0]!;
    to = ix.presents[ix.presents.length - 1]!;
  }
  const inside = ix.presents.filter((p) => p > from && p <= to);
  const durationMs = (to - from) / 1000;
  const gaps = inside.map((p, i) => (p - (i ? inside[i - 1]! : from)) / 1000);
  const sorted = [...gaps].sort((a, b) => a - b);
  const states: Record<string, number> = {};
  for (const e of ix.pipeline) {
    if (e.ts < from || e.ts > to) continue;
    const state = String((e.args?.chrome_frame_reporter as { state?: string } | undefined)?.state ?? (e.args?.data as { state?: string } | undefined)?.state ?? "");
    if (state) states[state] = (states[state] ?? 0) + 1;
  }
  return {
    durationMs: +durationMs.toFixed(0),
    presents: inside.length,
    fps: durationMs > 0 ? +((inside.length * 1000) / durationMs).toFixed(1) : NaN,
    over50ms: gaps.filter((g) => g > 50).length,
    maxIntervalMs: +(sorted[sorted.length - 1] ?? 0).toFixed(1),
    p95IntervalMs: +(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0).toFixed(1),
    source: ix.source,
    pipelineStates: states,
  };
}

/** Per direction: in page and to the screen (median, p95, max), the split's medians, and the switches not settled. */
export function summariseSwitches(results: readonly SwitchResult[]) {
  const out: Record<string, { inPage: Stats; toScreen: Stats; mainMs: number; rasterMs: number; restMs: number; notSettled: number; noPresent: number }> = {};
  for (const dir of [...new Set(results.map((r) => r.dir))]) {
    const g = results.filter((r) => r.dir === dir);
    const done = g.filter((r) => r.toScreenMs !== null);
    out[dir] = {
      inPage: stats(g.map((r) => r.inPageMs)),
      toScreen: stats(done.map((r) => r.toScreenMs!)),
      mainMs: stats(done.map((r) => r.mainMs)).median,
      rasterMs: stats(done.map((r) => r.rasterMs)).median,
      restMs: stats(done.map((r) => r.restMs)).median,
      notSettled: g.filter((r) => !r.settled).length,
      noPresent: g.length - done.length,
    };
  }
  return out;
}
