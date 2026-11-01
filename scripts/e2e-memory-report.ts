// Reads an e2e memory log (chore e2e reliability, P1: `E2E_MEMORY_LOG=1 npm run e2e`) and prints the curve and how the
// failures line up with it: the server child's heap against Next.js's restart threshold (80 % of the heap limit), the
// resident memory of `next dev`'s main process and its child, the machine's available memory, the page file and the
// paging. Writes `<base>.minutes.csv` (one row per minute) beside the log.
// Usage: npx tsx scripts/e2e-memory-report.ts .data/e2e-memory-<time>

import { existsSync, readFileSync, writeFileSync } from "node:fs";

type Line = Record<string, unknown> & { t: string };
const base = process.argv[2]?.replace(/\.(server|system|tests)\.jsonl$/, "");
if (!base) throw new Error("Usage: npx tsx scripts/e2e-memory-report.ts .data/e2e-memory-<time>");

const read = (kind: string): Line[] =>
  existsSync(`${base}.${kind}.jsonl`)
    ? readFileSync(`${base}.${kind}.jsonl`, "utf8").replace(/^﻿/, "").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Line)
    : [];
const server = read("server");
const system = read("system");
const tests = read("tests");
const ms = (l: Line) => Date.parse(l.t);
const num = (l: Line | undefined, k: string) => (l && typeof l[k] === "number" ? (l[k] as number) : NaN);

const child = server.filter((l) => l.role === "child" && l.heapUsedMb !== undefined);
const main = server.filter((l) => l.role === "main" && l.rssMb !== undefined);
const workers = server.filter((l) => l.role === "worker" && l.rssMb !== undefined);
// the workers alive in a 5 s window, their resident memory summed
const workerRss = (from: number, to: number) => {
  const byPid = new Map<unknown, number>();
  for (const l of within(workers, from, to)) byPid.set(l.pid, Math.max(byPid.get(l.pid) ?? 0, num(l, "rssMb")));
  return [...byPid.values()].reduce((a, b) => a + b, 0);
};
const starts = server.filter((l) => l.role === "child" && l.event === "start");
const exits = server.filter((l) => l.role === "child" && l.event === "exit");
const begins = tests.filter((l) => l.event === "begin");
const ends = tests.filter((l) => l.event === "end");
const t0 = Math.min(...[child[0], system[0], begins[0]].filter(Boolean).map((l) => ms(l!)));
const min = (t: number) => ((t - t0) / 60_000).toFixed(1);

const within = (list: Line[], from: number, to: number) => list.filter((l) => ms(l) >= from && ms(l) <= to);
const last = (list: Line[], t: number) => {
  let found: Line | undefined;
  for (const l of list) {
    if (ms(l) > t) break;
    found = l;
  }
  return found;
};
const max = (list: Line[], k: string) => list.reduce((m, l) => Math.max(m, num(l, k)), -Infinity);
const lowest = (list: Line[], k: string) => list.reduce((m, l) => Math.min(m, num(l, k)), Infinity);

// the tests with their times
const runs = begins.map((b) => {
  const e = ends.find((x) => x.n === b.n);
  return { n: b.n as number, file: b.file as string, title: b.title as string, from: ms(b), to: e ? ms(e) : ms(b), status: (e?.status as string) ?? "?", error: e?.error as string | undefined };
});

console.log(`log ${base}`);
console.log(`samples: server ${server.length}, system ${system.length}; tests ${runs.length}; ${min(Math.max(...[...child, ...system].map(ms)))} min`);
console.log(`server children started: ${starts.length} (pids ${starts.map((s) => s.pid).join(", ")}); exits: ${exits.map((e) => `${e.pid} code ${e.code} at ${min(ms(e))} min`).join(", ") || "none"}`);
const limit = max(child, "heapLimitMb");
console.log(`child heap: peak ${max(child, "heapUsedMb")} MB of a ${limit} MB limit; threshold (80 %) ${Math.round(0.8 * limit)} MB; peak ${(100 * max(child, "heapUsedMb") / (0.8 * limit)).toFixed(0)} % of the threshold`);
console.log(`child RSS peak ${max(child, "rssMb")} MB; main RSS peak ${max(main, "rssMb")} MB`);
const workerPeak = Math.max(0, ...child.map((c) => workerRss(ms(c) - 5_000, ms(c))));
console.log(`workers (the child's own Node processes): ${server.filter((l) => l.role === "worker" && l.event === "start").length} started; peak RSS of those alive at once ${workerPeak} MB`);
console.log(`available memory: lowest ${lowest(system, "availableMb")} MB; page file used: peak ${max(system, "pageFileUsedMb")} MB; commit peak ${max(system, "committedMb")} of ${max(system, "commitLimitMb")} MB; pages in/s peak ${max(system, "pagesInPerSec")}`);

console.log("\nby folder (at the folder's first test): minute, child heap, child RSS, available, page file");
const seen = new Set<string>();
for (const r of runs) {
  const folder = r.file.split("/")[0] ?? r.file;
  if (seen.has(folder)) continue;
  seen.add(folder);
  const c = last(child, r.from), s = last(system, r.from);
  console.log(`  ${folder.padEnd(11)} #${String(r.n).padStart(3)} ${min(r.from).padStart(6)} min  heap ${num(c, "heapUsedMb")}  rss ${num(c, "rssMb")}  avail ${num(s, "availableMb")}  pf ${num(s, "pageFileUsedMb")}`);
}

const describe = (r: (typeof runs)[number]) => {
  const c = within(child, r.from - 5_000, r.to + 5_000), s = within(system, r.from - 5_000, r.to + 5_000);
  return `heap ≤${max(c, "heapUsedMb")} MB, child RSS ≤${max(c, "rssMb")} MB, available ≥${lowest(s, "availableMb")} MB, page file ≤${max(s, "pageFileUsedMb")} MB, pages in/s ≤${max(s, "pagesInPerSec")}`;
};
console.log("\nfailures:");
for (const r of runs.filter((x) => x.status !== "passed" && x.status !== "skipped")) {
  console.log(`  #${r.n} ${r.file}:${r.title.slice(0, 60)} at ${min(r.from)} min, ${r.status}: ${describe(r)}`);
  if (r.error) console.log(`      ${r.error}`);
}
const restarts = starts.slice(1);
for (const s of restarts) {
  const r = runs.find((x) => x.from <= ms(s) && ms(s) <= x.to + 2_000);
  console.log(`  restart: child ${s.pid} at ${min(ms(s))} min, during #${r?.n ?? "?"} ${r?.file ?? ""}`);
}
console.log("\nthe 12 tests with the most paging (peak pages in/s during the test):");
for (const r of [...runs].sort((a, b) => max(within(system, b.from, b.to + 5_000), "pagesInPerSec") - max(within(system, a.from, a.to + 5_000), "pagesInPerSec")).slice(0, 12))
  console.log(`  #${r.n} ${r.status} ${r.file} (${((r.to - r.from) / 1000).toFixed(1)} s): ${describe(r)}`);

const tops = system.filter((l) => Array.isArray(l.top));
const heavy = new Map<string, number>();
for (const l of tops) for (const p of l.top as string[]) {
  const [name, mb] = [p.slice(0, p.lastIndexOf(" ")), Number(p.slice(p.lastIndexOf(" ") + 1))];
  heavy.set(name, Math.max(heavy.get(name) ?? 0, mb));
}
console.log(`\nprocesses among the six largest at any minute (peak working set, MB): ${[...heavy].sort((a, b) => b[1] - a[1]).map(([n, m]) => `${n} ${m}`).join(", ")}`);

// one row per minute
const rows = ["minute,test,child_heap_mb,heap_threshold_mb,child_rss_mb,main_rss_mb,worker_rss_mb,available_mb,page_file_mb,committed_mb,pages_in_max"];
const end = Math.max(...[...child, ...system].map(ms));
for (let t = t0; t <= end; t += 60_000) {
  const c = within(child, t, t + 60_000), m = within(main, t, t + 60_000), s = within(system, t, t + 60_000);
  const r = [...runs].reverse().find((x) => x.from <= t + 60_000);
  rows.push([min(t), r?.n ?? "", max(c, "heapUsedMb"), Math.round(0.8 * max(c, "heapLimitMb")), max(c, "rssMb"), max(m, "rssMb"), workerRss(t, t + 60_000), lowest(s, "availableMb"), max(s, "pageFileUsedMb"), max(s, "committedMb"), max(s, "pagesInPerSec")].map((v) => (typeof v === "number" && !Number.isFinite(v) ? "" : v)).join(","));
}
writeFileSync(`${base}.minutes.csv`, rows.join("\n") + "\n");
console.log(`\nwrote ${base}.minutes.csv`);
