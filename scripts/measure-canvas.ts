// Every canvas performance figure in one command (slice 2p, item 1, S2P-01): this branch and a reference (default the
// tag `slice-02a`) in turns, in the production measurement build (AD-31), at least 3 rounds, with the measuring
// conditions. Each side runs its own copy of the measuring specs, which measure the same steps:
//   S1A-14  pan and zoom at the overview and at 100 % (grid Dots, the default) and the initial render (C-08)
//   S1B-09  card resize (C-09)
//   S1B-10  hover to the next frame (C-10)
//   S2A-14  single-card drag, group drag (31 cards at 50 %), marks after a lasso around the visible cards at the overview
//
//   npx tsx scripts/measure-canvas.ts                    # 3 rounds against slice-02a
//   npx tsx scripts/measure-canvas.ts --rounds 4 --against slice-02a
//
// The reference is checked out in the worktree ../infomapper-ab-main (npm ci when its lock file changed). Raw results of
// every side and round go to .data/measure/<sitting>/, the summary to .data/measure/<sitting>/summary.json and
// summary.md (one table: median, spread, bar, result). A round disturbed by something else is repeated, not averaged
// in: `--drop <round>` leaves it out of the summary (`--resummarize <sitting>` redoes only the summary). `--prepare-only`
// checks the worktree and both builds without measuring; `--branch-diag <switch>` runs this branch's side with a
// measurement-only switch (DIAG); before each side the machine must be quiet (below 2 % for 30 s, at most 3 minutes,
// recorded); `--add-round <sitting>` measures a replacement round with the
// builds already made (pair it with `--drop`); `--quick` measures only pan and zoom, C-08, C-10 and the lasso marks.
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
const SPECS = QUICK
  ? ["e2e/slice-01a/S1A-14.spec.ts", "e2e/slice-01b/S1B-10.spec.ts", "e2e/slice-02a/S2A-14.spec.ts"]
  : ["e2e/slice-01a/S1A-14.spec.ts", "e2e/slice-01b/S1B-09.spec.ts", "e2e/slice-01b/S1B-10.spec.ts", "e2e/slice-02a/S2A-14.spec.ts"];
// one word: on Windows the specs run through a shell that does not quote arguments, so "dragging a group" became the
// filter "dragging" plus the file filters "a" and "group", which ran every spec (found in slice 2b)
const SPEC_ARGS = QUICK ? ["--grep-invert", "dragging"] : [];
const RESULT_FILES = QUICK ? ["S1A-14.json", "S1B-10.json", "S2A-14-lasso.json"] : ["S1A-14.json", "S1B-09.json", "S1B-10.json", "S2A-14.json", "S2A-14-lasso.json"];

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : fallback;
};
const against = arg("against", "slice-02a");
const rounds = Number(arg("rounds", "3"));
const dropped = new Set(arg("drop", "").split(",").filter(Boolean).map(Number));
/** A measurement-only switch (DIAG) for this branch's side only, e.g. `nolines` or `blocks` (slice 2p used it for a trial renderer). */
const branchDiag = arg("branch-diag", "");

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
function measure(tree: string, dir: string, diag = ""): Raw {
  const env: NodeJS.ProcessEnv = { ...process.env, MEASURE: "1", MEASURE_BUILD: "production" };
  delete env.DIAG;
  if (diag) env.DIAG = diag;
  // a soft bar that is missed makes Playwright exit with 1; the result files decide whether the run worked
  spawnSync("npx", ["playwright", "test", ...SPECS, ...SPEC_ARGS, "--reporter=line"], { cwd: tree, env, stdio: "inherit", shell: process.platform === "win32" });
  fs.mkdirSync(dir, { recursive: true });
  const raw: Raw = {};
  for (const f of RESULT_FILES) {
    // with a switch, the specs' results carry it in their names (S1A-14 writes its own)
    const named = diag && f !== "S1A-14.json" ? f.replace(".json", `-diag-${diag}.json`) : f;
    const from = path.join(tree, "test-results", named);
    if (!fs.existsSync(from)) throw new Error(`${f} missing in ${tree}: a measuring spec failed (see its output above).`);
    fs.copyFileSync(from, path.join(dir, f));
    raw[f] = JSON.parse(fs.readFileSync(from, "utf8"));
  }
  return raw;
}

// ---- the figures ----

type Get = (r: Raw) => number;
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
  conditions: { before: unknown; after?: unknown; perSide: { round: number; side: string; busiest: string[]; quietBefore?: unknown }[] };
  sides: { round: number; side: "reference" | "branch"; raw: Raw }[];
}

function summarize(dir: string, s: Sitting) {
  const kept = s.sides.filter((x) => !dropped.has(x.round));
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
    `Sitting ${path.basename(dir)}: this branch (${s.branchCommit.slice(0, 7)}${s.branchDiag ? `, DIAG=${s.branchDiag}` : ""}) against ${s.against} (${s.referenceCommit.slice(0, 7)}), production measurement build, ${kept.length / 2} rounds${dropped.size ? ` (round ${[...dropped].join(", ")} left out)` : ""}.`,
    "",
    `| Figure | Bar | ${s.against}: median (min–max) | This branch: median (min–max) | Change | Result |`,
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map(({ figure: f, ref, br, mr, mb, diff, met, abOk }) => {
      const bar = f.bar === undefined ? "–" : `${f.better === "higher" ? "≥" : "≤"} ${f.bar}${f.unit === "frames" ? "" : ` ${f.unit}`}${f.ab ? ", ≥ −5 % vs reference" : ""}`;
      const cell = (xs: number[], m: number) => (xs.length ? `${fmt(m, f.unit)} (${fmt(Math.min(...xs), f.unit)}–${fmt(Math.max(...xs), f.unit)})` : "–");
      const change = Number.isFinite(diff) && f.unit !== "frames" ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} %` : "–";
      return `| ${f.name} | ${bar} | ${cell(ref, mr)} | ${cell(br, mb)} | ${change} | ${met ? "met" : abOk ? "not met" : "not met (below the reference)"} |`;
    }),
  ].join("\n");
  const summary = { ...s, dropped: [...dropped], table: rows.map((r) => ({ id: r.figure.id, name: r.figure.name, bar: r.figure.bar, reference: r.ref, branch: r.br, referenceMedian: r.mr, branchMedian: r.mb, changePercent: +r.diff.toFixed(1), met: r.met })) };
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(dir, "summary.md"), md + "\n");
  console.log(md);
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
      const raw = measure(side === "reference" ? REF_TREE : BRANCH, path.join(dir, `round-${r}-${side}`), side === "branch" ? sitting.branchDiag : "");
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
  const dir = path.resolve(BRANCH, ".data", "measure", new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"));
  fs.mkdirSync(dir, { recursive: true });
  const sitting: Sitting = {
    against,
    branchCommit: read("git rev-parse HEAD"),
    referenceCommit: read(`git rev-list -n 1 ${against}`),
    branchDiag,
    conditions: { before: conditions(), perSide: [] },
    sides: [],
  };
  const save = () => fs.writeFileSync(path.join(dir, "sitting.json"), JSON.stringify(sitting, null, 2));
  save();
  prepareReference();
  sh("npm run measure:build", REF_TREE);
  sh("npm run measure:build", BRANCH);
  for (let r = 1; r <= rounds; r++) {
    // the side that starts changes every round
    for (const side of r % 2 ? (["reference", "branch"] as const) : (["branch", "reference"] as const)) {
      // a quiet machine first: below 2 % for 30 s, at most 3 minutes (the wait is recorded)
      const quietBefore = waitUntilQuiet();
      const raw = measure(side === "reference" ? REF_TREE : BRANCH, path.join(dir, `round-${r}-${side}`), side === "branch" ? sitting.branchDiag : "");
      sitting.sides.push({ round: r, side, raw });
      sitting.conditions.perSide.push({ round: r, side, quietBefore, busiest: (conditions() as { busiestProcesses?: string[] }).busiestProcesses ?? [] });
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
