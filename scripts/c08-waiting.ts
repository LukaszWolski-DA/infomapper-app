// C-08's waiting after the document, from S4P-10's raw traces (slice 4p, step 5; diagnosis only):
//
//   npx tsx scripts/c08-waiting.ts .data/measure/s4p10-traces/<time>
//
// For each load, in the window from the end of the HTML response to the stable frame:
//   - the network requests in flight (what, start, end; times from navigation start);
//   - the time the compositor, raster (tile workers), GPU main and Viz compositor threads were busy (the union of their
//     tasks, so nested events count once);
//   - the renderer main thread's busy time and its idle gaps between tasks.
// Writes waiting.json and waiting.md next to the traces.

import fs from "node:fs";
import path from "node:path";

type TraceEvent = { name: string; ph: string; ts: number; dur?: number; pid: number; tid: number; cat: string; args?: Record<string, unknown> };
interface Load {
  nav: { stableAt: number; responseEnd: number; lastScriptEnd: number };
  navStart: number;
  mainPid: number;
  mainTid: number;
  events: TraceEvent[];
}

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) throw new Error("Usage: npx tsx scripts/c08-waiting.ts <folder of load-N.json>");

/** The total length of a set of intervals, overlaps counted once, clipped to [a, b]. */
function union(intervals: [number, number][], a: number, b: number): number {
  const xs = intervals.map(([s, e]) => [Math.max(s, a), Math.min(e, b)] as [number, number]).filter(([s, e]) => e > s).sort((x, y) => x[0] - y[0]);
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

const ms = (us: number) => Math.round(us / 1000);
const results: Record<string, unknown>[] = [];
for (const file of fs.readdirSync(dir).filter((f) => /^load-\d+\.json$/.test(f)).sort()) {
  const load = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as Load;
  const { events, navStart } = load;
  const from = navStart + load.nav.responseEnd * 1000, to = navStart + load.nav.stableAt * 1000;
  // thread names
  const names = new Map<string, string>();
  for (const e of events) if (e.ph === "M" && e.name === "thread_name") names.set(`${e.pid}:${e.tid}`, String((e.args as { name?: string })?.name ?? ""));
  const threadOf = (e: TraceEvent) => names.get(`${e.pid}:${e.tid}`) ?? "";
  const slices = events.filter((e) => e.ph === "X" && e.dur);
  const busy = (match: (e: TraceEvent) => boolean) => ms(union(slices.filter(match).map((e) => [e.ts, e.ts + e.dur!]), from, to));
  const inRenderer = (e: TraceEvent) => e.pid === load.mainPid;
  const mainBusy = busy((e) => inRenderer(e) && e.tid === load.mainTid);
  // network: requests sent by the renderer and still open in the window
  const sent = new Map<string, { url: string; start: number; end?: number }>();
  for (const e of events) {
    const d = (e.args as { data?: { requestId?: string; url?: string; finishTime?: number } })?.data;
    if (!d?.requestId) continue;
    if (e.name === "ResourceSendRequest" && d.url) sent.set(d.requestId, { url: d.url, start: e.ts });
    if (e.name === "ResourceFinish" && sent.has(d.requestId)) sent.get(d.requestId)!.end = d.finishTime ? d.finishTime * 1e6 : e.ts;
  }
  const network = [...sent.values()]
    .filter((r) => r.start < to && (r.end ?? to) > from)
    .map((r) => ({ what: r.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 80), startMs: ms(r.start - navStart), endMs: r.end ? ms(r.end - navStart) : null }));
  const window = ms(to - from);
  results.push({
    load: file,
    stableAt: load.nav.stableAt,
    documentEnd: load.nav.responseEnd,
    windowMs: window,
    network,
    networkInFlightMs: ms(union(network.map((r) => [navStart + r.startMs * 1000, navStart + (r.endMs ?? load.nav.stableAt) * 1000]), from, to)),
    compositorMs: busy((e) => inRenderer(e) && threadOf(e) === "Compositor"),
    rasterMs: busy((e) => inRenderer(e) && threadOf(e).startsWith("CompositorTileWorker")),
    gpuMainMs: busy((e) => threadOf(e) === "CrGpuMain"),
    vizCompositorMs: busy((e) => threadOf(e) === "VizCompositorThread"),
    mainBusyMs: mainBusy,
    mainIdleMs: window - mainBusy,
  });
}

const md = [
  `C-08's waiting after the document (${dir}): from the end of the HTML response to the stable frame, per load.`,
  "",
  "| Load | Stable | Document end | Window | Network in flight | Compositor | Raster | GPU main | Viz compositor | Main busy | Main idle |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...results.map((r) => `| ${r.load} | ${r.stableAt} | ${r.documentEnd} | ${r.windowMs} | ${r.networkInFlightMs} | ${r.compositorMs} | ${r.rasterMs} | ${r.gpuMainMs} | ${r.vizCompositorMs} | ${r.mainBusyMs} | ${r.mainIdleMs} |`),
  "",
  ...results.flatMap((r) => [`${r.load}: requests in flight`, ...(r.network as { what: string; startMs: number; endMs: number | null }[]).map((n) => `- ${n.what}: ${n.startMs}–${n.endMs ?? "open"} ms`), ""]),
].join("\n");
fs.writeFileSync(path.join(dir, "waiting.json"), JSON.stringify(results, null, 2));
fs.writeFileSync(path.join(dir, "waiting.md"), md + "\n");
console.log(md);
