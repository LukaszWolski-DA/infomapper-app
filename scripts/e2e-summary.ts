// The job summary of a GitHub Actions e2e run (chore CI e2e, P5), as Markdown on stdout.
//   npx tsx scripts/e2e-summary.ts full <report.json> <parts folder>   the full run: counts, each part's duration and
//                                                                     memory, restarts, failures, folder times
//   npx tsx scripts/e2e-summary.ts check <report.json> <round>         one round of a single-file check
// <report.json> is Playwright's JSON report (the merged one for the full run). <parts folder> holds one folder per part
// (`part-<n>`, the part's artifact): `part.json` (start, end, exit, written by the workflow), `server.log` (the dev
// server's output, scripts/e2e-server.ts) and the memory log (`*.server.jsonl`, `*.system.jsonl`, E2E_MEMORY_LOG=1).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

type Result = { status: string; duration: number; error?: { message?: string } };
type Test = { status: string; results: Result[] };
type Spec = { title: string; file: string; line: number; tests: Test[] };
type Suite = { title: string; file?: string; specs?: Spec[]; suites?: Suite[] };
type Report = { suites?: Suite[]; stats?: { expected: number; unexpected: number; flaky: number; skipped: number; duration: number } };

/** The text Next.js's dev server prints when it restarts at its memory threshold (F1). */
const RESTART = "approaching the used memory threshold";

const [mode, reportFile, third] = process.argv.slice(2);
if ((mode !== "full" && mode !== "check") || !reportFile || !third) throw new Error("usage: e2e-summary.ts full <report.json> <parts folder> | check <report.json> <round>");

const report: Report = existsSync(reportFile) ? (JSON.parse(readFileSync(reportFile, "utf8")) as Report) : {};
const specs: Spec[] = [];
const walk = (s: Suite) => {
  specs.push(...(s.specs ?? []));
  for (const c of s.suites ?? []) walk(c);
};
for (const s of report.suites ?? []) walk(s);

const minutes = (ms: number) => `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`;
const firstLine = (text = "") => text.replace(/\x1b\[[0-9;]*m/g, "").split("\n").find((l) => l.trim())?.trim().slice(0, 200) ?? "";
const out: string[] = [];

const s = report.stats;
if (!s) out.push("**No report:** Playwright's JSON report is missing (a part or the merge failed before it).", "");
else
  out.push(
    `**${s.expected} passed, ${s.unexpected} failed, ${s.flaky} flaky, ${s.skipped} skipped** (Playwright's own time ${minutes(s.duration)}).`,
    "",
  );

const failed = specs.filter((sp) => sp.tests.some((t) => t.status === "unexpected" || t.status === "flaky"));
if (failed.length > 0) {
  out.push("### Failed tests", "", "| File | Test | Error |", "| --- | --- | --- |");
  for (const sp of failed) {
    const err = sp.tests.flatMap((t) => t.results).find((r) => r.error)?.error?.message;
    out.push(`| \`${sp.file}:${sp.line}\` | ${sp.title.replace(/\|/g, "\\|").slice(0, 120)} | ${firstLine(err).replace(/\|/g, "\\|")} |`);
  }
  out.push("");
}

if (mode === "check") {
  out.unshift(`## Single-file check, round ${third}`, "");
  out.push("| File | Test | Result | Time |", "| --- | --- | --- | ---: |");
  for (const sp of specs) for (const t of sp.tests) out.push(`| \`${sp.file}:${sp.line}\` | ${sp.title.replace(/\|/g, "\\|").slice(0, 120)} | ${t.status} | ${Math.round(t.results.reduce((a, r) => a + r.duration, 0) / 1000)} s |`);
} else {
  out.unshift("## Full e2e run", "");
  const dirs = existsSync(third)
    ? readdirSync(third)
        .filter((d) => /^part-\d+$/.test(d))
        .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
    : [];
  out.push("### Parts", "", "| Part | Duration | Exit | Heap peak | Heap limit | Threshold (80 %) | Peak of threshold | Lowest available | Restart printed |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |");
  for (const d of dirs) {
    const dir = path.join(third, d);
    const files = readdirSync(dir);
    const part = existsSync(path.join(dir, "part.json")) ? (JSON.parse(readFileSync(path.join(dir, "part.json"), "utf8")) as { start: number; end: number; exit: number }) : undefined;
    const lines = (suffix: string) =>
      files
        .filter((f) => f.endsWith(suffix))
        .flatMap((f) => readFileSync(path.join(dir, f), "utf8").split("\n"))
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, unknown>);
    const child = lines(".server.jsonl").filter((l) => l.role === "child" && typeof l.heapUsedMb === "number");
    const system = lines(".system.jsonl").filter((l) => typeof l.availableMb === "number");
    const peak = child.length ? Math.max(...child.map((l) => l.heapUsedMb as number)) : undefined;
    const limit = child.length ? Math.max(...child.map((l) => l.heapLimitMb as number)) : undefined;
    const threshold = limit === undefined ? undefined : Math.round(limit * 0.8);
    const lowest = system.length ? Math.min(...system.map((l) => l.availableMb as number)) : undefined;
    const log = existsSync(path.join(dir, "server.log")) ? readFileSync(path.join(dir, "server.log"), "utf8") : undefined;
    const restartCount = log === undefined ? undefined : log.split(RESTART).length - 1;
    const restarts = restartCount === undefined ? "no log" : restartCount === 0 ? "no" : `**yes, ${restartCount}×**`;
    const mb = (n?: number) => (n === undefined ? "–" : `${n.toLocaleString("en-GB")} MB`);
    out.push(
      `| ${d.slice(5)} | ${part ? minutes((part.end - part.start) * 1000) : "–"} | ${part?.exit ?? "–"} | ${mb(peak)} | ${mb(limit)} | ${mb(threshold)} | ${peak !== undefined && threshold ? `${Math.round((peak / threshold) * 100)} %` : "–"} | ${mb(lowest)} | ${restarts} |`,
    );
  }
  out.push("");

  const folders = new Map<string, { tests: number; ms: number }>();
  for (const sp of specs) {
    const folder = sp.file.replace(/\\/g, "/").split("/")[0]!;
    const f = folders.get(folder) ?? { tests: 0, ms: 0 };
    for (const t of sp.tests) {
      f.tests += 1;
      f.ms += t.results.reduce((a, r) => a + r.duration, 0);
    }
    folders.set(folder, f);
  }
  out.push("### Folder times", "", "| Folder | Tests | Time |", "| --- | ---: | ---: |");
  for (const [folder, f] of [...folders].sort(([a], [b]) => (a < b ? -1 : 1))) out.push(`| ${folder} | ${f.tests} | ${Math.round(f.ms / 1000)} s |`);
}

console.log(out.join("\n"));
