// Slice 4p, step 2: the one sitting for the trials (PRD step 2, Łukasz after the baseline): the reference and several
// trial branches in turns, each in its own worktree and its own measurement build, the order changing every round, with
// the measuring conditions (`measure-conditions.ts`). Each side runs the same copies of the measuring specs:
//   S1B-10      C-10 (hover to the next frame, median of 40) and pan and zoom (overview, 100 %)
//   S2A-14      the lasso marks (median of 20)
//   S4P-fading  pan and zoom with fading off in six views; where the side has a fading mechanism, every scenario
//               (switching on and off, pan and zoom with fading on); where it has the hover line fade, C-10 with it
//               off, “plain” and on its own layer
// The fading spec is copied from this tree into every side, so all sides measure with the same method.
//
//   npx tsx scripts/measure-trials.ts --prepare-only --sides perf/4p-trial-a,perf/4p-trial-f1,perf/4p-trial-f4
//   npx tsx scripts/measure-trials.ts --rounds 2 --sides perf/4p-trial-a,perf/4p-trial-f1,perf/4p-trial-f4
//
// Options as `measure:canvas`: --against (default slice-04a), --rounds (default 2), --drop <round,...>, --add-round
// <sitting>, --resummarize <sitting>, --prepare-only. Results in .data/measure/<sitting>/ (sitting.json, summary.md).
// Measuring only: no dev or measurement server may run (ports 3200, 3300); prepare the laptop first.

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { conditions, waitUntilQuiet } from "./measure-conditions";

const HERE = process.cwd();
const FADING_SPEC = "e2e/slice-04p/S4P-fading.spec.ts";
const SPECS = ["e2e/slice-01b/S1B-10.spec.ts", "e2e/slice-02a/S2A-14.spec.ts", FADING_SPEC];
// one word: on Windows the specs run through a shell that does not quote arguments (slice 2b)
const SPEC_ARGS = ["--grep-invert", "dragging"];
const RESULT_FILES = ["S1B-10.json", "S2A-14-lasso.json", "S4P-fading.json"];
const VIEWS = ["100 %, expanded", "30 %, expanded", "100 % dense area, expanded", "100 %, collapsed", "30 %, collapsed", "100 % dense area, collapsed"] as const;
const SCENARIOS = ["focus", "lens-small", "lens-large", "lens-dense"] as const;

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : fallback;
};
const against = arg("against", "slice-04a");
const rounds = Number(arg("rounds", "2"));
const dropped = new Set(arg("drop", "").split(",").filter(Boolean).map(Number));
const sh = (cmd: string, cwd = HERE) => execSync(cmd, { cwd, stdio: "inherit" });
const read = (cmd: string, cwd = HERE) => execSync(cmd, { cwd, encoding: "utf8" }).trim();
const portFree = (port: number) =>
  new Promise<boolean>((done) => {
    const s = net.connect({ port, host: "127.0.0.1" }, () => {
      s.destroy();
      done(false);
    });
    s.on("error", () => done(true));
  });

/** The worktree of a side: the reference keeps `measure:canvas`'s, a trial gets its own. */
const treeOf = (ref: string) => (ref === against ? path.resolve(HERE, "..", "infomapper-ab-main") : path.resolve(HERE, "..", `infomapper-side-${ref.replace(/[^a-z0-9]+/gi, "-")}`));

/** A side's worktree, clean, at its ref, with its own dependencies (npm ci only when the lock file changed). */
function prepare(ref: string) {
  const tree = treeOf(ref);
  if (!fs.existsSync(tree)) sh(`git worktree add --detach "${tree}" ${ref}`);
  spawnSync("git", ["cherry-pick", "--quit"], { cwd: tree, stdio: "ignore" });
  sh("git reset -q --hard", tree);
  sh("git clean -q -fdx -e node_modules", tree);
  sh(`git checkout -q --detach ${ref}`, tree);
  const lock = read("git hash-object package-lock.json", tree);
  const stamp = path.join(tree, "node_modules", ".measure-lock");
  if (!fs.existsSync(stamp) || fs.readFileSync(stamp, "utf8") !== lock) {
    sh("npm ci --no-audit --no-fund", tree);
    fs.writeFileSync(stamp, lock);
  }
}

type Raw = Record<string, unknown>;

function measure(ref: string, dir: string): Raw {
  const tree = treeOf(ref);
  const env: NodeJS.ProcessEnv = { ...process.env, MEASURE: "1", MEASURE_BUILD: "production" };
  delete env.DIAG;
  fs.mkdirSync(path.join(tree, path.dirname(FADING_SPEC)), { recursive: true });
  fs.copyFileSync(path.join(HERE, FADING_SPEC), path.join(tree, FADING_SPEC));
  spawnSync("npx", ["playwright", "test", ...SPECS, ...SPEC_ARGS, "--reporter=line"], { cwd: tree, env, stdio: "inherit", shell: process.platform === "win32" });
  fs.mkdirSync(dir, { recursive: true });
  const raw: Raw = {};
  for (const f of RESULT_FILES) {
    const from = path.join(tree, "test-results", f);
    if (!fs.existsSync(from)) throw new Error(`${f} missing in ${tree}: a measuring spec failed (see its output above).`);
    fs.copyFileSync(from, path.join(dir, f));
    raw[f] = JSON.parse(fs.readFileSync(from, "utf8"));
  }
  return raw;
}

interface Sitting {
  against: string;
  sides: string[];
  commits: Record<string, string>;
  conditions: { before: unknown; after?: unknown; perSide: { round: number; side: string; busiest: string[]; quietBefore?: unknown }[] };
  results: { round: number; side: string; raw: Raw }[];
}

const at = (o: unknown, ...keys: string[]) => keys.reduce<unknown>((v, k) => (v as Record<string, unknown>)?.[k], o) as number;
const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};

interface Figure {
  name: string;
  unit: "fps" | "ms" | "frames";
  get: (r: Raw) => number;
}
const FIGURES: Figure[] = [
  { name: "C-10 hover to the next frame, median of 40", unit: "ms", get: (r) => at(r["S1B-10.json"], "C-10", "toNextFrameMs", "median") },
  { name: "Lasso marks, median of 20", unit: "ms", get: (r) => at(r["S2A-14-lasso.json"], "medianMs") },
  { name: "Pan and zoom, overview (S1B-10, median of 3)", unit: "fps", get: (r) => at(r["S1B-10.json"], "panZoom", "medianFps", "overview") },
  { name: "Pan and zoom, 100 % (S1B-10, median of 3)", unit: "fps", get: (r) => at(r["S1B-10.json"], "panZoom", "medianFps", "100%") },
  ...VIEWS.flatMap((v): Figure[] => [
    { name: `Fading off, ${v}`, unit: "fps", get: (r) => at(r["S4P-fading.json"], "views", v, "off", "avgFps") },
    { name: "– frames over 50 ms", unit: "frames", get: (r) => at(r["S4P-fading.json"], "views", v, "off", "over50ms") },
  ]),
  ...(["off", "plain", "layer"] as const).map((m): Figure => ({ name: `C-10 with the hover line fade “${m}” (S4P-fading)`, unit: "ms", get: (r) => at(r["S4P-fading.json"], "hoverFade", m, "toNextFrameMs", "median") })),
];
const fmt = (v: number, unit: string) => (unit === "frames" ? String(Math.round(v)) : unit === "ms" ? v.toFixed(0) : v.toFixed(1));

function summarize(dir: string, s: Sitting) {
  const kept = s.results.filter((x) => !dropped.has(x.round));
  const vals = (side: string, get: (r: Raw) => number) => kept.filter((x) => x.side === side).map((x) => get(x.raw)).filter((v) => Number.isFinite(v));
  const cell = (xs: number[], unit: string) => (xs.length ? `${fmt(median(xs), unit)} (${fmt(Math.min(...xs), unit)}–${fmt(Math.max(...xs), unit)})` : "–");
  const all = [s.against, ...s.sides];
  const md: string[] = [
    `Sitting ${path.basename(dir)}: ${all.map((x) => `${x} (${s.commits[x]!.slice(0, 7)})`).join(", ")}, production measurement build, ${new Set(kept.map((x) => x.round)).size} rounds${dropped.size ? ` (round ${[...dropped].join(", ")} left out)` : ""}. Median (min–max); the change is against ${s.against}.`,
    "",
    `| Figure | ${all.join(" | ")} |`,
    `| --- | ${all.map(() => "---").join(" | ")} |`,
  ];
  for (const f of FIGURES) {
    const ref = vals(s.against, f.get);
    const cells = all.map((side) => {
      const xs = vals(side, f.get);
      if (side === s.against || !xs.length || !ref.length || f.unit === "frames") return cell(xs, f.unit);
      const d = ((median(xs) - median(ref)) / median(ref)) * 100;
      return `${cell(xs, f.unit)}, ${d >= 0 ? "+" : ""}${d.toFixed(1)} %`;
    });
    if (cells.every((c) => c === "–")) continue;
    md.push(`| ${f.name} | ${cells.join(" | ")} |`);
  }
  const fading: unknown[] = [];
  for (const side of s.sides) {
    const rows: string[] = [];
    for (const view of VIEWS) {
      for (const sc of SCENARIOS) {
        const get = (...keys: string[]) => vals(side, (r) => at(r["S4P-fading.json"], "views", view, ...keys));
        const on = get("scenarios", sc, "on", "median");
        if (!on.length) continue;
        const off = get("scenarios", sc, "off", "median");
        const panOff = median(get("off", "avgFps")), panOn = median(get("scenarios", sc, "pan", "avgFps"));
        const change = ((panOn - panOff) / panOff) * 100;
        const longOff = median(get("off", "over50ms")), longOn = median(get("scenarios", sc, "pan", "over50ms"));
        const met = median(on) <= 100 && median(off) <= 100 && change >= -5;
        fading.push({ side, view, scenario: sc, on: median(on), off: median(off), panOff, panOn, change: +change.toFixed(1), longOff, longOn, met });
        rows.push(`| ${view} | ${sc} | ${cell(on, "ms")} | ${cell(off, "ms")} | ${panOff.toFixed(1)} → ${panOn.toFixed(1)} | ${change >= 0 ? "+" : ""}${change.toFixed(1)} % | ${longOff} → ${longOn} | ${met ? "met" : "not met"} |`);
      }
    }
    if (!rows.length) continue;
    md.push("", `Fading, ${side} (S4P-02: switching ≤ 100 ms; S4P-03: pan and zoom on at most 5 % below off, same run):`, "");
    md.push("| View | Scenario | On, ms | Off, ms | Pan and zoom off → on, fps | Change | Frames over 50 ms, off → on | Result |", "| --- | --- | --- | --- | --- | --- | --- | --- |", ...rows);
  }
  fs.writeFileSync(path.join(dir, "summary.md"), md.join("\n") + "\n");
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify({ ...s, dropped: [...dropped], fading }, null, 2));
  console.log(md.join("\n"));
}

/** One round: every side once, the order turning by one each round. */
function round(dir: string, s: Sitting, r: number, save: () => void) {
  const all = [s.against, ...s.sides];
  const order = all.map((_, i) => all[(i + r - 1) % all.length]!);
  for (const side of order) {
    const quietBefore = waitUntilQuiet();
    const raw = measure(side, path.join(dir, `round-${r}-${side.replace(/[^a-z0-9]+/gi, "-")}`));
    s.results.push({ round: r, side, raw });
    s.conditions.perSide.push({ round: r, side, quietBefore, busiest: (conditions() as { busiestProcesses?: string[] }).busiestProcesses ?? [] });
    save();
  }
}

async function main() {
  for (const port of [3200, 3300]) if (!(await portFree(port))) throw new Error(`Port ${port} is in use: stop that server first.`);
  const again = arg("resummarize", "");
  if (again) {
    const dir = path.resolve(HERE, ".data", "measure", again);
    summarize(dir, JSON.parse(fs.readFileSync(path.join(dir, "sitting.json"), "utf8")) as Sitting);
    return;
  }
  const more = arg("add-round", "");
  if (more) {
    const dir = path.resolve(HERE, ".data", "measure", more);
    const s = JSON.parse(fs.readFileSync(path.join(dir, "sitting.json"), "utf8")) as Sitting;
    const save = () => fs.writeFileSync(path.join(dir, "sitting.json"), JSON.stringify(s, null, 2));
    round(dir, s, Math.max(...s.results.map((x) => x.round)) + 1, save);
    summarize(dir, s);
    return;
  }
  const sides = arg("sides", "").split(",").filter(Boolean);
  if (!sides.length) throw new Error("--sides <ref,ref,...> is required.");
  for (const ref of [against, ...sides]) prepare(ref);
  for (const ref of [against, ...sides]) sh("npm run measure:build", treeOf(ref));
  if (process.argv.includes("--prepare-only")) return;
  const dir = path.resolve(HERE, ".data", "measure", `trials-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`);
  fs.mkdirSync(dir, { recursive: true });
  const s: Sitting = {
    against,
    sides,
    commits: Object.fromEntries([against, ...sides].map((ref) => [ref, read(`git rev-list -n 1 ${ref}`)])),
    conditions: { before: conditions(), perSide: [] },
    results: [],
  };
  const save = () => fs.writeFileSync(path.join(dir, "sitting.json"), JSON.stringify(s, null, 2));
  save();
  for (let r = 1; r <= rounds; r++) round(dir, s, r, save);
  s.conditions.after = conditions();
  save();
  summarize(dir, s);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
