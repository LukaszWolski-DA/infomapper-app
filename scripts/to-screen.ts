// Analyses saved traces again (slice 4b-1, step 2): every switch to the screen and every pan's presented frames.
//
//   npx tsx scripts/to-screen.ts <folder>        # every *.json under it with an `events` array
//
// A trace file is what `e2e/measure/trace.ts` saves: { name, events, … }. Writes to-screen.json and to-screen.md into
// the folder and prints the table: per file and direction the switches in page and to the screen (median / p95 /
// max), the split's medians and the switches not settled; per pan window (`pan:<name>`) the presented fps, the gaps
// over 50 ms and the longest gap.

import fs from "node:fs";
import path from "node:path";
import { presentedFrames, summariseSwitches, switchesOf, traceIndex, type TraceEvent } from "./lib/to-screen";

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) throw new Error("Usage: npx tsx scripts/to-screen.ts <folder of traces>");

const files: string[] = [];
const walk = (d: string) => {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith(".json") && !f.name.startsWith("to-screen")) files.push(p);
  }
};
walk(dir);

const switchRows: string[] = [], panRows: string[] = [];
const out: Record<string, unknown> = {};
const cell = (s: { median: number; p95: number; max: number }) => `${Math.round(s.median)} / ${Math.round(s.p95)} / ${Math.round(s.max)}`;
for (const file of files.sort()) {
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as { events?: TraceEvent[] };
  if (!Array.isArray(data.events)) continue;
  const ix = traceIndex(data.events);
  const name = path.relative(dir, file);
  const switches = switchesOf(data.events, ix);
  const summary = summariseSwitches(switches);
  for (const [d, s] of Object.entries(summary))
    switchRows.push(`| ${name} | ${d} | ${s.inPage.n} | ${s.notSettled} | ${cell(s.inPage)} | ${cell(s.toScreen)} | ${s.mainMs} | ${s.rasterMs} | ${s.restMs} |`);
  const pans = [...new Set(ix.marks.filter((m) => m.name.startsWith("pan:")).map((m) => m.name))];
  const presented = Object.fromEntries(pans.map((p) => [p, presentedFrames(data.events!, p, ix)]));
  for (const [p, f] of Object.entries(presented)) if (f) panRows.push(`| ${name} | ${p.slice(4)} | ${f.fps} | ${f.presents} | ${f.over50ms} | ${f.maxIntervalMs} | ${f.source} |`);
  out[name] = { switches: summary, presented };
}

const md = [
  `To the screen (${dir}). Times in ms.`,
  "",
  ...(switchRows.length
    ? ["| Trace | Dir | n | Not settled | In page med / p95 / max | To screen med / p95 / max | Main | Raster | Rest |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |", ...switchRows, ""]
    : []),
  ...(panRows.length ? ["| Trace | Pan | Presented fps | Presents | Gaps over 50 ms | Longest gap | Source |", "| --- | --- | --- | --- | --- | --- | --- |", ...panRows] : []),
].join("\n");
fs.writeFileSync(path.join(dir, "to-screen.json"), JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(dir, "to-screen.md"), md + "\n");
console.log(md);
