// Every canvas performance figure in one command (slice 2p, item 1, S2P-01): this branch and a reference (default the
// tag `slice-02a`) in turns, in the production measurement build (AD-31), at least 3 rounds, with the measuring
// conditions. Each side runs its own copy of the measuring specs, which measure the same steps:
//   S1A-14  pan and zoom at the overview and at 100 % (grid Dots, the default) and the initial render (C-08)
//   S1B-09  card resize (C-09)
//   S1B-10  hover to the next frame (C-10)
//   S2A-14  single-card drag, group drag (31 cards at 50 %), marks after a lasso around the visible cards at the overview
//   S4P-fading  (slice 4p) pan and zoom at 100 % and 30 % around ent:23, frames expanded and collapsed, fading off; on
//           this branch, once it has a fading mechanism, each fading scenario: switching on and off (median of 40) and
//           pan and zoom with fading on, against fading off in the same run. The spec is copied into the reference
//           worktree, which has no fading: it measures fading off there.
//
//   npx tsx scripts/measure-canvas.ts                    # 3 rounds against slice-02a
//   npx tsx scripts/measure-canvas.ts --rounds 4 --against slice-02a
//
// The reference is checked out in the worktree ../infomapper-ab-main (npm ci when its lock file changed). Raw results of
// every side and round go to .data/measure/<sitting>/, the summary to .data/measure/<sitting>/summary.json and
// summary.md (one table: median, spread, bar, result). A round disturbed by something else is repeated, not averaged
// in: `--drop <round>` leaves it out of the summary (`--resummarize <sitting>` redoes only the summary). `--prepare-only`
// checks the worktree and both builds without measuring; `--diag <switch>` runs both sides with a measurement-only
// switch (slice 4p: `--diag collapsed` measures the reference against itself with every frame collapsed);
// `--branch-diag <switch>` runs this branch's side with a
// measurement-only switch (DIAG); before each side the machine must be quiet (below 2 % for 30 s, at most 3 minutes,
// recorded); `--add-round <sitting>` measures a replacement round with the
// builds already made (pair it with `--drop`); `--quick` measures only pan and zoom, C-08, C-10 and the lasso marks;
// `--no-build` (slice 4p) starts a sitting on the builds `--prepare-only` made, so the laptop can be prepared after
// building (it refuses when the reference worktree is not at `--against` or a build is missing).
// Slice 4b-1 (measuring to the screen): `--to-screen` runs the specs' traced mode (TO_SCREEN=1): switches and
// interactions from a settled screen to the GPU present, pans as presented frames, C-08 to its last present (S4P-10);
// raw traces in .data/measure/<sitting>/traces/round-<n>-<side>/; the branch's measuring specs, `e2e/measure/` and
// `scripts/lib/to-screen.ts` are copied into the reference worktree so both sides measure the same way. `--only
// <list>` runs a subset: pan (S1A-14, with C-08 untraced), c10 (S1B-10), lasso (S2A-14's marks), fading (S4P-fading),
// c08 (S4P-10, traced), colours (S4B1-09, this branch only), c09 (S1B-09), drags (S2A-14's drags); with --only,
// fading runs on this branch only too. `FADING_SCENARIOS=focus,lens-large` limits S4P-fading's scenarios. A side whose
// quiet check fails (not quiet within 3 minutes) drops its round, and a replacement round with the same order is added
// at the end (at most two per sitting).
// Measuring only:
// no dev or measurement server may run (ports 3200, 3300); prepare the laptop first.

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { conditions, waitUntilQuiet } from "./measure-conditions";

const BRANCH = process.cwd();
const REF_TREE = path.resolve(BRANCH, "..", "infomapper-ab-main");
/** `--quick`: pan and zoom, C-08 (S1A-14), C-10 (S1B-10) and the lasso marks only, without C-09 and the drags. */
const QUICK = process.argv.includes("--quick");
/** The fading scenarios (slice 4p), copied into the reference worktree before its side runs. */
const FADING_SPEC = "e2e/slice-04p/S4P-fading.spec.ts";
/** Slice 4b-1: the specs' traced mode (TO_SCREEN=1). */
const TO_SCREEN = process.argv.includes("--to-screen");
/**
 * One Playwright run: its specs, its filter and the result files it writes. A filter is one word: on Windows the specs
 * run through a shell that does not quote arguments, so "dragging a group" became the filter "dragging" plus the file
 * filters "a" and "group", which ran every spec (found in slice 2b).
 */
interface Run {
  specs: string[];
  args: string[];
  results: string[];
  /** Measures what only this branch has (slice 4b-1's coverage colours): not copied to, nor run on, the reference. */
  branchOnly?: boolean;
}
const CRITERIA: Record<string, Run> = {
  pan: { specs: ["e2e/slice-01a/S1A-14.spec.ts"], args: [], results: ["S1A-14.json"] },
  c10: { specs: ["e2e/slice-01b/S1B-10.spec.ts"], args: [], results: ["S1B-10.json"] },
  lasso: { specs: ["e2e/slice-02a/S2A-14.spec.ts"], args: ["--grep", "marks"], results: ["S2A-14-lasso.json"] },
  drags: { specs: ["e2e/slice-02a/S2A-14.spec.ts"], args: ["--grep", "dragging"], results: ["S2A-14.json"] },
  // with --only, fading is this branch's (slice 4b-1: S4B1-10 and S4B1-11 compare Focus on and off on the same side);
  // the full set without --only still measures it on both sides (slice 4p)
  fading: { specs: [FADING_SPEC], args: [], results: ["S4P-fading.json"], branchOnly: true },
  c08: { specs: ["e2e/slice-04p/S4P-10-c08.spec.ts"], args: [], results: ["S4P-10.json"] },
  colours: { specs: ["e2e/slice-04b1/S4B1-09.spec.ts"], args: [], results: ["S4B1-09.json"], branchOnly: true },
  c09: { specs: ["e2e/slice-01b/S1B-09.spec.ts"], args: [], results: ["S1B-09.json"] },
};
const only = (() => {
  const i = process.argv.indexOf("--only");
  return i > 0 ? process.argv[i + 1]!.split(",").filter(Boolean) : [];
})();
for (const c of only) if (!CRITERIA[c]) throw new Error(`--only: unknown criterion ${c} (${Object.keys(CRITERIA).join(", ")})`);
const RUNS: Run[] = only.length
  ? only.map((c) => CRITERIA[c]!)
  : [
      {
        specs: QUICK
          ? ["e2e/slice-01a/S1A-14.spec.ts", "e2e/slice-01b/S1B-10.spec.ts", "e2e/slice-02a/S2A-14.spec.ts", FADING_SPEC]
          : ["e2e/slice-01a/S1A-14.spec.ts", "e2e/slice-01b/S1B-09.spec.ts", "e2e/slice-01b/S1B-10.spec.ts", "e2e/slice-02a/S2A-14.spec.ts", FADING_SPEC],
        args: QUICK ? ["--grep-invert", "dragging"] : [],
        results: QUICK
          ? ["S1A-14.json", "S1B-10.json", "S2A-14-lasso.json", "S4P-fading.json"]
          : ["S1A-14.json", "S1B-09.json", "S1B-10.json", "S2A-14.json", "S2A-14-lasso.json", "S4P-fading.json"],
      },
    ];
/** What the traced mode needs on both sides besides the specs (copied into the reference with them). */
const TO_SCREEN_FILES = ["e2e/measure/trace.ts", "e2e/measure/switches.ts", "scripts/lib/to-screen.ts"];

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : fallback;
};
const against = arg("against", "slice-02a");
const rounds = Number(arg("rounds", "3"));
const dropped = new Set(arg("drop", "").split(",").filter(Boolean).map(Number));
/** A measurement-only switch (DIAG) for this branch's side only, e.g. `nolines` or `blocks` (slice 2p used it for a trial renderer). */
const branchDiag = arg("branch-diag", "");
/** A measurement-only switch for both sides (slice 4p), e.g. `collapsed` for a baseline with every frame collapsed. */
const bothDiag = arg("diag", "");
const diagFor = (s: { branchDiag?: string; bothDiag?: string }, side: "reference" | "branch") =>
  [s.bothDiag, side === "branch" ? s.branchDiag : ""].filter(Boolean).join(",");

const sh = (cmd: string, cwd = BRANCH) => execSync(cmd, { cwd, stdio: "inherit" });
const read = (cmd: string, cwd = BRANCH) => execSync(cmd, { cwd, encoding: "utf8" }).trim();

const portFree = (port: number) =>
  new Promise<boolean>((done) => {
    const s = net.connect({ port, host: "127.0.0.1" }, () => {
      s.destroy();
      done(false);
    });
    s.on("error", () => done(true));
  });

/** The reference in its own worktree, clean, with its own dependencies. */
function prepareReference() {
  if (!fs.existsSync(REF_TREE)) sh(`git worktree add --detach "${REF_TREE}" ${against}`);
  spawnSync("git", ["cherry-pick", "--quit"], { cwd: REF_TREE, stdio: "ignore" });
  sh("git reset -q --hard", REF_TREE);
  // untracked files of an earlier sitting would block the checkout, and build folders would be scanned by Tailwind;
  // node_modules stays
  sh("git clean -q -fdx -e node_modules", REF_TREE);
  sh(`git checkout -q --detach ${against}`, REF_TREE);
  const lock = read("git hash-object package-lock.json", REF_TREE);
  const stamp = path.join(REF_TREE, "node_modules", ".measure-lock");
  if (!fs.existsSync(stamp) || fs.readFileSync(stamp, "utf8") !== lock) {
    sh("npm ci --no-audit --no-fund", REF_TREE);
    fs.writeFileSync(stamp, lock);
  }
}

type Raw = Record<string, unknown>;

/** One side of one round: its specs in its own tree; their result files are copied before the next run wipes them. */
function measure(tree: string, dir: string, diag = "", traceDir = ""): Raw {
  const env: NodeJS.ProcessEnv = { ...process.env, MEASURE: "1", MEASURE_BUILD: "production" };
  delete env.DIAG;
  delete env.TO_SCREEN;
  if (diag) env.DIAG = diag;
  if (TO_SCREEN) Object.assign(env, { TO_SCREEN: "1", TRACE_DIR: traceDir });
  if (tree !== BRANCH) {
    // the reference has no fading spec of its own: the same file, which measures fading off there (slice 4p); in the
    // traced mode every measuring spec and the modules they share, so both sides measure the same way (slice 4b-1)
    const copies = TO_SCREEN ? [...new Set([...RUNS.filter((r) => !r.branchOnly).flatMap((r) => r.specs), ...TO_SCREEN_FILES])] : [FADING_SPEC];
    for (const f of copies) {
      if (!fs.existsSync(path.join(BRANCH, f))) continue;
      fs.mkdirSync(path.join(tree, path.dirname(f)), { recursive: true });
      fs.copyFileSync(path.join(BRANCH, f), path.join(tree, f));
    }
  }
  fs.mkdirSync(dir, { recursive: true });
  const raw: Raw = {};
  for (const run of RUNS) {
    if (run.branchOnly && tree !== BRANCH) {
      console.log(`Skipped in ${tree}: ${run.specs.join(", ")} measures this branch only.`);
      continue;
    }
    const specs = run.specs.filter((f) => fs.existsSync(path.join(tree, f)));
    if (!specs.length) {
      console.log(`Skipped in ${tree}: ${run.specs.join(", ")} does not exist there.`);
      continue;
    }
    // a soft bar that is missed makes Playwright exit with 1; the result files decide whether the run worked
    spawnSync("npx", ["playwright", "test", ...specs, ...run.args, "--reporter=line"], { cwd: tree, env, stdio: "inherit", shell: process.platform === "win32" });
    for (const f of run.results) {
      // with a switch, the specs' results carry it in their names (S1A-14 writes its own)
      const named = diag && f !== "S1A-14.json" ? f.replace(".json", `-diag-${diag}.json`) : f;
      const from = path.join(tree, "test-results", named);
      if (!fs.existsSync(from)) throw new Error(`${f} missing in ${tree}: a measuring spec failed (see its output above).`);
      fs.copyFileSync(from, path.join(dir, f));
      raw[f] = JSON.parse(fs.readFileSync(from, "utf8"));
    }
  }
  return raw;
}

// ---- the figures ----

type Get = (r: Raw) => number;
/** The fading spec's views and scenarios (slice 4p). */
const FADING_VIEWS = ["100 %, expanded", "30 %, expanded", "100 % dense area, expanded", "100 %, collapsed", "30 %, collapsed", "100 % dense area, collapsed"] as const;
const FADING_SCENARIOS = ["focus", "lens-small", "lens-large", "lens-dense"] as const;
const at = (o: unknown, ...keys: string[]) => keys.reduce<unknown>((v, k) => (v as Record<string, unknown>)?.[k], o) as number;
interface Figure {
  id: string;
  name: string;
  unit: "fps" | "ms" | "frames";
  better: "higher" | "lower";
  bar?: number;
  /** Pan and zoom: also at most 5 % below the reference (S2P-09). */
  ab?: boolean;
  get: Get;
}
const FIGURES: Figure[] = [
  { id: "pan-overview", name: "Pan and zoom at the overview (S1A-14, grid Dots)", unit: "fps", better: "higher", bar: 50, ab: true, get: (r) => at(r["S1A-14.json"], "C-01", "overview (all cards in view)", "avgFps") },
  { id: "pan-overview-long", name: "– frames over 50 ms", unit: "frames", better: "lower", bar: 0, get: (r) => at(r["S1A-14.json"], "C-01", "overview (all cards in view)", "over50ms") },
  { id: "pan-100", name: "Pan and zoom at 100 %, dense area (S1A-14)", unit: "fps", better: "higher", bar: 50, ab: true, get: (r) => at(r["S1A-14.json"], "C-01", "100%, dense area", "avgFps") },
  { id: "pan-100-long", name: "– frames over 50 ms", unit: "frames", better: "lower", bar: 0, get: (r) => at(r["S1A-14.json"], "C-01", "100%, dense area", "over50ms") },
  { id: "c08", name: "Initial render (C-08), median of 5", unit: "ms", better: "lower", bar: 1500, get: (r) => at(r["S1A-14.json"], "C-08", "median") },
  { id: "c09", name: "Card resize, 200-row card at 50 % (C-09)", unit: "fps", better: "higher", bar: 45, get: (r) => at(r["S1B-09.json"], "C-09 resize", "avgFps") },
  { id: "c10", name: "Hover to the next frame, median of 40 (C-10)", unit: "ms", better: "lower", bar: 100, get: (r) => at(r["S1B-10.json"], "C-10", "toNextFrameMs", "median") },
  { id: "drag-single", name: "Single-card drag at 50 %", unit: "fps", better: "higher", bar: 45, get: (r) => at(r["S2A-14.json"], "single-card drag", "avgFps") },
  { id: "drag-group", name: "Group drag, 31 cards at 50 %", unit: "fps", better: "higher", bar: 45, get: (r) => at(r["S2A-14.json"], "group drag", "avgFps") },
  { id: "lasso", name: "Marks after a lasso around the visible cards, median of 20", unit: "ms", better: "lower", bar: 100, get: (r) => at(r["S2A-14-lasso.json"], "medianMs") },
  // slice 4b-1, `--to-screen`: pans as presented frames, C-10 and the lasso to the GPU present, C-08 to its last present
  { id: "pan-overview-presented", name: "Pan and zoom at the overview, presented fps (S1A-14, traced)", unit: "fps", better: "higher", bar: 50, ab: true, get: (r) => at(r["S1A-14.json"], "C-01", "overview (all cards in view)", "toScreen", "presented", "fps") },
  { id: "pan-overview-presented-long", name: "– gaps between presents over 50 ms", unit: "frames", better: "lower", get: (r) => at(r["S1A-14.json"], "C-01", "overview (all cards in view)", "toScreen", "presented", "over50ms") },
  { id: "pan-100-presented", name: "Pan and zoom at 100 %, dense area, presented fps (S1A-14, traced)", unit: "fps", better: "higher", bar: 50, ab: true, get: (r) => at(r["S1A-14.json"], "C-01", "100%, dense area", "toScreen", "presented", "fps") },
  { id: "pan-100-presented-long", name: "– gaps between presents over 50 ms", unit: "frames", better: "lower", get: (r) => at(r["S1A-14.json"], "C-01", "100%, dense area", "toScreen", "presented", "over50ms") },
  { id: "c10-screen", name: "Hover to the screen, median of 10 settled (C-10, traced)", unit: "ms", better: "lower", bar: 100, get: (r) => at(r["S1B-10.json"], "C-10", "toScreen", "byDir", "on", "toScreen", "median") },
  { id: "lasso-screen", name: "Lasso marks to the screen, median of 10 settled (traced)", unit: "ms", better: "lower", bar: 100, get: (r) => at(r["S2A-14-lasso.json"], "toScreen", "byDir", "on", "toScreen", "median") },
  { id: "c08-present", name: "Initial render to its last present (C-08, traced, diagnosis)", unit: "ms", better: "lower", get: (r) => at(r["S4P-10.json"], "median", "toLastPresentMs") },
  // slice 4p (S4P-08): pan and zoom with fading off around ent:23, both sides
  ...FADING_VIEWS.flatMap((v): Figure[] => [
    { id: `fade-off-${v}`, name: `Pan and zoom, fading off, ${v} (S4P-08)`, unit: "fps", better: "higher", ab: true, get: (r) => at(r["S4P-fading.json"], "views", v, "off", "avgFps") },
    { id: `fade-off-${v}-long`, name: "– frames over 50 ms", unit: "frames", better: "lower", get: (r) => at(r["S4P-fading.json"], "views", v, "off", "over50ms") },
    { id: `fade-off-${v}-presented`, name: `Pan and zoom, fading off, ${v}, presented fps (traced)`, unit: "fps", better: "higher", ab: true, get: (r) => at(r["S4P-fading.json"], "views", v, "offToScreen", "fps") },
  ]),
];

const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};
const fmt = (v: number, unit: string) => (unit === "frames" ? String(Math.round(v)) : unit === "ms" ? v.toFixed(0) : v.toFixed(1));
const meets = (f: Figure, v: number) => (f.bar === undefined ? true : f.better === "higher" ? v >= f.bar : v <= f.bar);

interface Sitting {
  against: string;
  branchCommit: string;
  referenceCommit: string;
  branchDiag?: string;
  bothDiag?: string;
  /** Measured with `--to-screen` (slice 4b-1). */
  toScreen?: boolean;
  conditions: { before: unknown; after?: unknown; perSide: { round: number; side: string; busiest: string[]; quietBefore?: unknown }[] };
  /** Rounds a failed quiet check dropped (slice 4b-1); left out of the summary like `--drop`. */
  autoDropped?: number[];
  sides: { round: number; side: "reference" | "branch"; raw: Raw }[];
}

/**
 * The fading figures (slice 4p), this branch's rounds only: per view and scenario the median over the rounds of each
 * round's median switching time, and of pan and zoom with fading on and off measured in the same run. The frames over
 * 50 ms are judged against the baseline's spread (S4P-03), so “met” here is the 100 ms and 5 % bars only.
 */
function fadingTable(branchSides: readonly { raw: Raw }[]) {
  const out: { view: string; scenario: string; on: number; off: number; panOff: number; panOn: number; change: number; longOff: number; longOn: number; met: boolean }[] = [];
  for (const view of FADING_VIEWS) {
    for (const scenario of FADING_SCENARIOS) {
      const get = (...keys: string[]) => branchSides.map((x) => at(x.raw["S4P-fading.json"], "views", view, ...keys)).filter((v) => Number.isFinite(v));
      const on = get("scenarios", scenario, "on", "median");
      if (!on.length) continue;
      const off = median(get("scenarios", scenario, "off", "median"));
      const panOff = median(get("off", "avgFps")), panOn = median(get("scenarios", scenario, "pan", "avgFps"));
      const row = { view, scenario, on: median(on), off, panOff, panOn, change: +(((panOn - panOff) / panOff) * 100).toFixed(1), longOff: median(get("off", "over50ms")), longOn: median(get("scenarios", scenario, "pan", "over50ms")) };
      out.push({ ...row, met: row.on <= 100 && row.off <= 100 && panOn >= panOff * 0.95 });
    }
  }
  return out;
}

/**
 * The to-screen detail (slice 4b-1, `--to-screen`): per side, case and direction, over the rounds kept: the median of
 * the rounds' medians, the largest p95 and maximum, and how many switches failed the settled check; for fading also
 * pan and zoom with fading on against off as presented frames.
 */
function screenTables(kept: readonly { side: string; raw: Raw }[]): string[] {
  type Dir = { toScreen: { median: number; p95: number; max: number }; inPage: { median: number }; notSettled: number };
  const cases: [string, (r: Raw) => Record<string, Dir> | undefined][] = [
    ["C-10 hover (S1B-10)", (r) => at(r["S1B-10.json"], "C-10", "toScreen", "byDir") as unknown as Record<string, Dir>],
    ["Lasso marks (S2A-14)", (r) => at(r["S2A-14-lasso.json"], "toScreen", "byDir") as unknown as Record<string, Dir>],
  ];
  for (const view of FADING_VIEWS)
    for (const scenario of FADING_SCENARIOS) cases.push([`Fading, ${view}, ${scenario}`, (r) => at(r["S4P-fading.json"], "views", view, "scenarios", scenario, "toScreen", "byDir") as unknown as Record<string, Dir>]);
  // slice 4b-1: coverage colours (S4B1-09), REQ-102 selected and cleared
  for (const view of ["100 %, expanded", "30 %, expanded", "100 %, collapsed", "30 %, collapsed"])
    cases.push([`Coverage colours (S4B1-09), ${view}`, (r) => at(r["S4B1-09.json"], "views", view, "byDir") as unknown as Record<string, Dir>]);
  const rows: string[] = [];
  for (const side of ["reference", "branch"]) {
    const sides = kept.filter((x) => x.side === side);
    for (const [name, get] of cases) {
      const per = sides.map((x) => get(x.raw)).filter((d): d is Record<string, Dir> => !!d);
      if (!per.length) continue;
      for (const dir of ["on", "off"]) {
        const ds = per.map((d) => d[dir]).filter((d): d is Dir => !!d && Number.isFinite(d.toScreen?.median));
        if (!ds.length) continue;
        const med = median(ds.map((d) => d.toScreen.median)), p95 = Math.max(...ds.map((d) => d.toScreen.p95)), max = Math.max(...ds.map((d) => d.toScreen.max));
        const inPage = median(ds.map((d) => d.inPage.median));
        const ns = ds.reduce((n, d) => n + d.notSettled, 0);
        rows.push(`| ${side} | ${name} | ${dir} | ${ds.length} | ${inPage.toFixed(0)} | ${med.toFixed(0)} / ${p95.toFixed(0)} / ${max.toFixed(0)} | ${ns} | ${med <= 100 ? "met" : "not met"} |`);
      }
    }
  }
  const pans: string[] = [];
  for (const side of ["reference", "branch"]) {
    const sides = kept.filter((x) => x.side === side);
    for (const view of FADING_VIEWS)
      for (const scenario of FADING_SCENARIOS) {
        const off = sides.map((x) => at(x.raw["S4P-fading.json"], "views", view, "offToScreen", "fps")).filter(Number.isFinite);
        const on = sides.map((x) => at(x.raw["S4P-fading.json"], "views", view, "scenarios", scenario, "panToScreen", "fps")).filter(Number.isFinite);
        if (!off.length || !on.length) continue;
        const change = ((median(on) - median(off)) / median(off)) * 100;
        pans.push(`| ${side} | ${view} | ${scenario} | ${median(off).toFixed(1)} → ${median(on).toFixed(1)} | ${change >= 0 ? "+" : ""}${change.toFixed(1)} % | ${change >= -5 ? "met" : "not met"} |`);
      }
  }
  if (!rows.length && !pans.length) return [];
  return [
    "",
    "To the screen (traced; median of the rounds' medians / largest p95 / largest max, ms; bar 100 ms on the median):",
    "",
    "| Side | Case | Dir | Rounds | In page, median | To screen: median / p95 / max | Not settled | Result |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    ...(pans.length
      ? ["", "Pan and zoom with fading on against off, presented fps (bar: at most 5 % below off):", "", "| Side | View | Scenario | Off → on, fps | Change | Result |", "| --- | --- | --- | --- | --- | --- |", ...pans]
      : []),
  ];
}

function summarize(dir: string, s: Sitting) {
  const drop = new Set([...dropped, ...(s.autoDropped ?? [])]);
  const kept = s.sides.filter((x) => !drop.has(x.round));
  const values = (side: string, f: Figure) => kept.filter((x) => x.side === side).map((x) => f.get(x.raw)).filter((v) => Number.isFinite(v));
  // figures a quick sitting did not measure are left out of the table
  const rows = FIGURES.filter((f) => kept.some((x) => Number.isFinite(f.get(x.raw)))).map((f) => {
    const ref = values("reference", f), br = values("branch", f);
    const mr = median(ref), mb = median(br);
    const diff = ((mb - mr) / mr) * 100;
    const abOk = !f.ab || mb >= mr * 0.95;
    return { figure: f, ref, br, mr, mb, diff, met: meets(f, mb) && abOk, abOk };
  });
  const md = [
    `Sitting ${path.basename(dir)}: this branch (${s.branchCommit.slice(0, 7)}${s.branchDiag ? `, DIAG=${s.branchDiag}` : ""}) against ${s.against} (${s.referenceCommit.slice(0, 7)})${s.bothDiag ? `, both sides DIAG=${s.bothDiag}` : ""}, production measurement build, ${kept.length / 2} rounds${drop.size ? ` (round ${[...drop].join(", ")} left out)` : ""}${TO_SCREEN || s.toScreen ? ", traced (to the screen)" : ""}.`,
    "",
    `| Figure | Bar | ${s.against}: median (min–max) | This branch: median (min–max) | Change | Result |`,
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map(({ figure: f, ref, br, mr, mb, diff, met, abOk }) => {
      const bar = f.bar === undefined ? "–" : `${f.better === "higher" ? "≥" : "≤"} ${f.bar}${f.unit === "frames" ? "" : ` ${f.unit}`}${f.ab ? ", ≥ −5 % vs reference" : ""}`;
      const cell = (xs: number[], m: number) => (xs.length ? `${fmt(m, f.unit)} (${fmt(Math.min(...xs), f.unit)}–${fmt(Math.max(...xs), f.unit)})` : "–");
      const change = Number.isFinite(diff) && f.unit !== "frames" ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} %` : "–";
      // under a switch (e.g. DIAG=collapsed) the branch side may not measure a figure: not applicable, not “not met”
      const result = !br.length ? "not applicable" : met ? "met" : abOk ? "not met" : "not met (below the reference)";
      return `| ${f.name} | ${bar} | ${cell(ref, mr)} | ${cell(br, mb)} | ${change} | ${result} |`;
    }),
  ].join("\n");
  const fadingRows = fadingTable(kept.filter((x) => x.side === "branch"));
  const fadingMd = fadingRows.length
    ? [
        "",
        "Fading (this branch only; S4P-02: switching ≤ 100 ms; S4P-03: pan and zoom with fading on at most 5 % below fading off in the same run):",
        "",
        "| View | Scenario | On, ms | Off, ms | Pan and zoom off → on, fps | Change | Frames over 50 ms, off → on | Result |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ...fadingRows.map((f) => `| ${f.view} | ${f.scenario} | ${f.on.toFixed(0)} | ${f.off.toFixed(0)} | ${f.panOff.toFixed(1)} → ${f.panOn.toFixed(1)} | ${f.change >= 0 ? "+" : ""}${f.change.toFixed(1)} % | ${f.longOff} → ${f.longOn} | ${f.met ? "met" : "not met"} |`),
      ]
    : [];
  const screenMd = screenTables(kept);
  const summary = {
    ...s,
    dropped: [...drop],
    table: rows.map((r) => ({ id: r.figure.id, name: r.figure.name, bar: r.figure.bar, reference: r.ref, branch: r.br, referenceMedian: r.mr, branchMedian: r.mb, changePercent: +r.diff.toFixed(1), met: r.met })),
    fading: fadingRows,
  };
  const all = [md, ...fadingMd, ...screenMd].join("\n");
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(dir, "summary.md"), all + "\n");
  console.log(all);
}

async function main() {
  const more = arg("add-round", "");
  if (more) {
    // a replacement for a disturbed round: one more round in the same sitting, with the builds already made
    for (const port of [3200, 3300]) if (!(await portFree(port))) throw new Error(`Port ${port} is in use: stop that server first.`);
    const dir = path.resolve(BRANCH, ".data", "measure", more);
    const sitting = JSON.parse(fs.readFileSync(path.join(dir, "sitting.json"), "utf8")) as Sitting;
    if (read("git rev-parse HEAD").slice(0, 7) !== sitting.branchCommit.slice(0, 7) && !process.argv.includes("--any-commit")) {
      throw new Error("This branch moved since the sitting; measure a new sitting instead.");
    }
    const r = Math.max(...sitting.sides.map((x) => x.round)) + 1;
    for (const side of r % 2 ? (["reference", "branch"] as const) : (["branch", "reference"] as const)) {
      // a quiet machine first: below 2 % for 30 s, at most 3 minutes (the wait is recorded)
      const quietBefore = waitUntilQuiet();
      const raw = measure(side === "reference" ? REF_TREE : BRANCH, path.join(dir, `round-${r}-${side}`), diagFor(sitting, side), path.join(dir, "traces", `round-${r}-${side}`));
      sitting.sides.push({ round: r, side, raw });
      sitting.conditions.perSide.push({ round: r, side, quietBefore, busiest: (conditions() as { busiestProcesses?: string[] }).busiestProcesses ?? [] });
      fs.writeFileSync(path.join(dir, "sitting.json"), JSON.stringify(sitting, null, 2));
    }
    summarize(dir, sitting);
    return;
  }
  const again = arg("resummarize", "");
  if (again) {
    const dir = path.resolve(BRANCH, ".data", "measure", again);
    summarize(dir, JSON.parse(fs.readFileSync(path.join(dir, "sitting.json"), "utf8")) as Sitting);
    return;
  }
  for (const port of [3200, 3300]) if (!(await portFree(port))) throw new Error(`Port ${port} is in use: stop that server first.`);
  if (process.argv.includes("--prepare-only")) {
    // checks the reference worktree and both builds before a sitting, measuring nothing
    prepareReference();
    sh("npm run measure:build", REF_TREE);
    sh("npm run measure:build", BRANCH);
    return;
  }
  if (process.argv.includes("--no-build")) {
    // the builds `--prepare-only` made: the reference worktree at --against, both builds there
    const at = fs.existsSync(REF_TREE) ? read("git rev-parse HEAD", REF_TREE) : "";
    if (at !== read(`git rev-list -n 1 ${against}`)) throw new Error(`${REF_TREE} is not at ${against}: run --prepare-only first.`);
    for (const tree of [REF_TREE, BRANCH]) {
      const id = path.join(tree, ".next-measure", "BUILD_ID");
      if (!fs.existsSync(id)) throw new Error(`No measurement build in ${tree}: run --prepare-only first.`);
      console.log(`Using the build in ${tree} from ${fs.statSync(id).mtime.toISOString()}.`);
    }
  }
  const dir = path.resolve(BRANCH, ".data", "measure", new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"));
  fs.mkdirSync(dir, { recursive: true });
  const sitting: Sitting = {
    against,
    branchCommit: read("git rev-parse HEAD"),
    referenceCommit: read(`git rev-list -n 1 ${against}`),
    branchDiag,
    bothDiag,
    toScreen: TO_SCREEN,
    conditions: { before: conditions(), perSide: [] },
    sides: [],
  };
  const save = () => fs.writeFileSync(path.join(dir, "sitting.json"), JSON.stringify(sitting, null, 2));
  save();
  if (!process.argv.includes("--no-build")) {
    prepareReference();
    sh("npm run measure:build", REF_TREE);
    sh("npm run measure:build", BRANCH);
  }
  // the side that starts changes every round; a round whose quiet check fails is dropped and replaced (slice 4b-1)
  const queue: { round: number; order: readonly ("reference" | "branch")[] }[] = [];
  for (let r = 1; r <= rounds; r++) queue.push({ round: r, order: r % 2 ? ["reference", "branch"] : ["branch", "reference"] });
  let replacements = 0;
  for (let q = 0; q < queue.length; q++) {
    const { round: r, order } = queue[q]!;
    for (const side of order) {
      // a quiet machine first: below 2 % for 30 s, at most 3 minutes (the wait is recorded)
      const quietBefore = waitUntilQuiet();
      const busiest = (conditions() as { busiestProcesses?: string[] }).busiestProcesses ?? [];
      if (!quietBefore.quiet) {
        sitting.conditions.perSide.push({ round: r, side, quietBefore, busiest });
        sitting.autoDropped = [...(sitting.autoDropped ?? []), r];
        save();
        if (replacements < 2) {
          replacements++;
          queue.push({ round: Math.max(...queue.map((x) => x.round)) + 1, order });
          console.log(`Round ${r} dropped: the machine did not get quiet before the ${side} side. A replacement round follows.`);
        } else console.log(`Round ${r} dropped: the machine did not get quiet before the ${side} side. No replacements left.`);
        break;
      }
      const raw = measure(side === "reference" ? REF_TREE : BRANCH, path.join(dir, `round-${r}-${side}`), diagFor(sitting, side), path.join(dir, "traces", `round-${r}-${side}`));
      sitting.sides.push({ round: r, side, raw });
      sitting.conditions.perSide.push({ round: r, side, quietBefore, busiest });
      save();
    }
  }
  sitting.conditions.after = conditions();
  save();
  summarize(dir, sitting);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
