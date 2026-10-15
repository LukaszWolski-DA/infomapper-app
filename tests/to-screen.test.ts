// The to-screen analysis (slice 4b-1, step 2): hand-written traces shaped like step 0's (times in ms, converted to µs).
import { describe, expect, it } from "vitest";
import { presentAfter, presentedFrames, settledAt, stats, summariseSwitches, switchesOf, traceIndex, union, type TraceEvent } from "../scripts/lib/to-screen";

const R = 10, GPU = 20; // renderer and GPU process ids
const MAIN = 1, COMP = 2, GPU_MAIN = 3;
const us = (ms: number) => Math.round(ms * 1000);
const meta = (pid: number, tid: number, name: string): TraceEvent => ({ name: "thread_name", ph: "M", ts: 0, pid, tid, args: { name } });
const header: TraceEvent[] = [meta(R, MAIN, "CrRendererMain"), meta(R, COMP, "Compositor"), meta(GPU, GPU_MAIN, "CrGpuMain")];
const slice = (name: string, pid: number, tid: number, from: number, to: number): TraceEvent => ({ name, ph: "X", ts: us(from), dur: us(to - from), pid, tid });
const task = (from: number, to: number) => slice("RunTask", R, MAIN, from, to);
const commit = (from: number, to: number) => slice("Commit", R, MAIN, from, to);
const activate = (at: number): TraceEvent => ({ name: "ActivateLayerTree", ph: "I", ts: us(at), pid: R, tid: COMP });
const raster = (from: number, to: number) => slice("RasterDecoderImpl::DoRasterCHROMIUM", GPU, GPU_MAIN, from, to);
const present = (at: number) => slice("DXGISwapChainImageBacking::Present", GPU, GPU_MAIN, at - 0.1, at);
const measure = (name: string, from: number, to: number): TraceEvent[] => [
  { name, ph: "b", ts: us(from), pid: R, tid: MAIN, cat: "blink.user_timing" },
  { name, ph: "e", ts: us(to), pid: R, tid: MAIN, cat: "blink.user_timing" },
];

describe("to the screen", () => {
  it("a switch whose raster takes long (F1's lift): the present after the raster, the split in main, raster and rest", () => {
    // step 0, F1's large lens on:3: commit 14.6–16.2, activation 22.3, raster 19–431, present 436.3
    const events = [...header, ...measure("sw:on:3", 0, 16.6), task(0, 16.4), commit(14.6, 16.2), activate(22.3), raster(19, 431), present(436.3)];
    const [s] = switchesOf(events);
    expect(s).toMatchObject({ dir: "on", k: 3, inPageMs: 16.6, toScreenMs: 436.3, settled: true });
    expect(s!.mainMs).toBeCloseTo(16.4, 1);
    expect(s!.rasterMs).toBeCloseTo(412, 0);
    expect(s!.rasterMs + s!.mainMs + s!.restMs).toBeCloseTo(436.3, 1);
  });

  it("a cheap frame presented while the main thread's commit still blocks (C-10's hover): that present, not the next switch's", () => {
    // step 0, hover on:1: commit 14.1–22.2, activation 15.1, present 22.0; the next switch's present at 1,243.7
    const events = [...header, ...measure("sw:on:1", 0, 22.5), task(0, 22.4), commit(14.1, 22.2), activate(15.1), present(22), commit(1240.5, 1241), activate(1241.3), present(1243.7)];
    expect(switchesOf(events)[0]!.toScreenMs).toBe(22);
  });

  it("an empty commit right after the start activates nothing (the lasso): the frame with the change is the one presented", () => {
    // step 0, lasso on:1: an empty commit at 1.1, the marks' commit at 34.2, activation 36.4, present 47.1
    const events = [...header, ...measure("sw:on:1", 0, 26.1), commit(1.1, 1.2), commit(34.2, 34.9), activate(36.4), raster(36.9, 37), present(47.1)];
    expect(switchesOf(events)[0]!.toScreenMs).toBe(47.1);
  });

  it("no present after the commit: null, and summarised as without a present", () => {
    const events = [...header, ...measure("sw:off:0", 0, 10), commit(5, 6), activate(7)];
    const [s] = switchesOf(events);
    expect(s!.toScreenMs).toBeNull();
    expect(summariseSwitches([s!]).off).toMatchObject({ noPresent: 1 });
  });
});

describe("settled", () => {
  const ix = (events: TraceEvent[]) => traceIndex([...header, ...measure("sw:on:0", 100, 110), ...events]);
  it("is settled with no raster before", () => expect(settledAt(ix([]), us(100))).toBe(true));
  it("is not settled while a raster runs at the start (switches back to back)", () => expect(settledAt(ix([raster(50, 150)]), us(100))).toBe(false));
  it("is settled when the last raster was presented before the start, however close (the lasso's drag)", () =>
    expect(settledAt(ix([raster(60, 60.1), present(63)]), us(100))).toBe(true));
  it("is not settled when the last raster ended less than 50 ms before and has not been presented", () => expect(settledAt(ix([raster(60, 70)]), us(100))).toBe(false));
  it("is settled when the last raster ended long before, even without a present after it (tiles that change nothing)", () =>
    expect(settledAt(ix([raster(10, 20)]), us(100))).toBe(true));
});

describe("presented frames", () => {
  it("counts the presents in the pan's window, the gaps over 50 ms and the maximum gap", () => {
    // a 1 s window, presents every ~16.7 ms except one 80 ms gap
    const ps: TraceEvent[] = [];
    let t = 0;
    for (let i = 0; i < 50; i++) ps.push(present((t += i === 25 ? 80 : 16.7)));
    const events = [...header, ...measure("pan:overview", 0, 1000), ...ps, present(1500)];
    const f = presentedFrames(events, "pan:overview")!;
    expect(f.presents).toBe(50);
    expect(f.fps).toBe(50);
    expect(f.over50ms).toBe(1);
    expect(f.maxIntervalMs).toBe(80);
    expect(f.source).toBe("DXGISwapChainImageBacking::Present");
  });

  it("falls back to Viz's draw and swap when the trace has no swap chain presents", () => {
    const viz = (at: number) => slice("Display::DrawAndSwap", GPU, 4, at - 1, at);
    const events = [...header, meta(GPU, 4, "VizCompositorThread"), ...measure("pan:x", 0, 100), viz(20), viz(40), viz(60)];
    expect(presentedFrames(events, "pan:x")).toMatchObject({ presents: 3, source: "Display::DrawAndSwap" });
  });

  it("returns null without the window's marks", () => expect(presentedFrames([...header], "pan:none")).toBeNull());
});

describe("helpers", () => {
  it("union counts overlaps once and clips", () => expect(union([[0, 10], [5, 15], [20, 30]], 2, 25)).toBe(18));
  it("stats: median, p95, max", () => expect(stats([5, 1, 3, 2, 4])).toEqual({ n: 5, median: 3, p95: 5, max: 5 }));
  it("presentAfter is null without an activation", () => expect(presentAfter(traceIndex([...header, commit(1, 2), present(5)]), 0)).toBeNull());
});
