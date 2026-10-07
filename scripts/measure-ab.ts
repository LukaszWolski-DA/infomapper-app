// S2A-14's pan-and-zoom criterion (slice 2a, step 5): no regression against `main`. Measures `main` and this branch
// in turns, in the same sitting, with e2e/slice-02a/S2A-14-pan-zoom.spec.ts, on the dev server and on the
// measurement-only production build (AD-31), and compares the medians: this branch may be at most 5 % below `main`,
// at the overview and at 100 %, for each grid. Records the measuring conditions (power, power mode, other programs).
//
//   npx tsx scripts/measure-ab.ts                        # both builds, 2 rounds of 3 runs per side
//   npx tsx scripts/measure-ab.ts --build dev --rounds 1
//
// `main` is checked out in a worktree next to this one (../infomapper-ab-main, npm ci on first use). `main` has no
// measurement-only build, so for the production rounds that worktree gets the commit that added it (eec0854) on top,
// uncommitted; it changes nothing of the canvas. Results: test-results/S2A-14-ab.json. Measuring only: no dev server
// may run (ports 3200, 3300), and the laptop should be prepared as the acceptance file says.

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const MEASUREMENT_BUILD_COMMIT = "eec0854";
const SPEC = "e2e/slice-02a/S2A-14-pan-zoom.spec.ts";
const BRANCH = process.cwd();
const MAIN = path.resolve(BRANCH, "..", "infomapper-ab-main");
const BAR_PERCENT = -5;

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : fallback;
};
const builds = arg("build", "both") === "both" ? ["dev", "production"] : [arg("build", "dev")];
const rounds = Number(arg("rounds", "2"));
const runs = arg("runs", "3");
const grids = arg("grids", "dots,lines,none");

const sh = (cmd: string, cwd = BRANCH) => execSync(cmd, { cwd, stdio: "inherit" });
const out = (cmd: string, cwd = BRANCH) => {
  try {
    return execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};

const portFree = (port: number) =>
  new Promise<boolean>((done) => {
    const s = net.connect({ port, host: "127.0.0.1" }, () => {
      s.destroy();
      done(false);
    });
    s.on("error", () => done(true));
  });

/** Power source, battery, power plan, Windows power mode and the programs with a window or using the processor. */
function conditions() {
  if (process.platform !== "win32") return { platform: process.platform };
  const ps = (c: string) => out(`powershell -NoProfile -Command "${c.replace(/"/g, '\\"')}"`);
  const modes: Record<string, string> = {
    "961cc777-2547-4f9d-8174-7d86181b8a7a": "Best power efficiency",
    "00000000-0000-0000-0000-000000000000": "Balanced",
    "ded574b5-45a0-4f42-8737-46345c09c238": "Best performance",
  };
  const overlay = (name: string) =>
    ps(`(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\User\\PowerSchemes' -ErrorAction SilentlyContinue).${name}`);
  const battery = ps("$b = Get-CimInstance Win32_Battery; if ($b) { \"$($b.BatteryStatus) $($b.EstimatedChargeRemaining)\" }").split(" ");
  return {
    at: new Date().toISOString(),
    power: battery[0] === "2" ? "mains (plugged in)" : battery[0] ? "battery" : "unknown",
    batteryPercent: battery[1] ? Number(battery[1]) : null,
    powerPlan: ps("powercfg /getactivescheme"),
    powerMode: { plugged: modes[overlay("ActiveOverlayAcPowerScheme")] ?? "Balanced (no overlay)", battery: modes[overlay("ActiveOverlayDcPowerScheme")] ?? "Balanced (no overlay)" },
    programsWithWindows: ps("Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object -ExpandProperty ProcessName | Sort-Object -Unique")
      .split(/\r?\n/)
      .filter(Boolean),
    // processor time per program over 3 s, as a share of all cores (Get-Counter's names are localised on Windows)
    busiestProcesses: ps(
      "$a = @{}; Get-Process | ForEach-Object { if ($_.CPU) { $a[$_.Id] = $_.CPU } }; Start-Sleep -Seconds 3; $n = [Environment]::ProcessorCount; Get-Process | Where-Object { $_.CPU -and $a.ContainsKey($_.Id) } | ForEach-Object { [pscustomobject]@{ Name = $_.ProcessName; Pct = ($_.CPU - $a[$_.Id]) / 3 / $n * 100 } } | Group-Object Name | ForEach-Object { [pscustomobject]@{ Name = $_.Name; Pct = ($_.Group | Measure-Object Pct -Sum).Sum } } | Sort-Object Pct -Descending | Select-Object -First 8 | ForEach-Object { '{0} {1:N1}%' -f $_.Name, $_.Pct }",
    )
      .split(/\r?\n/)
      .filter(Boolean),
  };
}

/** `main` in its own worktree, with the measurement-only build added on top for the production rounds. */
function prepareMain(withMeasurementBuild: boolean) {
  if (!fs.existsSync(MAIN)) sh(`git worktree add --detach "${MAIN}" main`);
  spawnSync("git", ["cherry-pick", "--quit"], { cwd: MAIN, stdio: "ignore" });
  sh("git reset -q --hard", MAIN);
  sh("git checkout -q --detach main", MAIN);
  // a throwaway tree: build folders left by an earlier sitting would be scanned by Tailwind (main does not ignore them)
  sh("git clean -q -fdx -e node_modules", MAIN);
  if (withMeasurementBuild) {
    // only package.json conflicts (its scripts): keep main's and add the two measure scripts
    spawnSync("git", ["cherry-pick", "-n", MEASUREMENT_BUILD_COMMIT], { cwd: MAIN, stdio: "ignore" });
    sh("git checkout --ours package.json", MAIN);
    const pkg = JSON.parse(fs.readFileSync(path.join(MAIN, "package.json"), "utf8"));
    const mine = JSON.parse(fs.readFileSync(path.join(BRANCH, "package.json"), "utf8"));
    pkg.scripts["measure:build"] = mine.scripts["measure:build"];
    pkg.scripts["measure:start"] = mine.scripts["measure:start"];
    fs.writeFileSync(path.join(MAIN, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
    spawnSync("git", ["cherry-pick", "--quit"], { cwd: MAIN, stdio: "ignore" });
    sh("git reset -q", MAIN);
  }
  if (!fs.existsSync(path.join(MAIN, "node_modules", "next"))) sh("npm ci --no-audit --no-fund", MAIN);
  // the spec goes in after any build: `next build` type-checks e2e/, and main's domain lacks what the branch side uses
  fs.rmSync(path.join(MAIN, SPEC), { force: true });
}

function copySpec() {
  fs.mkdirSync(path.join(MAIN, "e2e", "slice-02a"), { recursive: true });
  fs.copyFileSync(path.join(BRANCH, SPEC), path.join(MAIN, SPEC));
}

type Fps = Record<string, { overview: number[]; "100%": number[] }>;

function measure(tree: string, side: "main" | "branch", build: string): Fps {
  const env = { ...process.env, MEASURE: "1", AB_SIDE: side, AB_RUNS: runs, AB_GRIDS: grids, ...(build === "production" ? { MEASURE_BUILD: "production" } : {}) };
  delete (env as Record<string, string | undefined>).DIAG;
  const r = spawnSync("npx", ["playwright", "test", SPEC, "--reporter=line"], { cwd: tree, env, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) throw new Error(`${side} (${build}) failed`);
  return JSON.parse(fs.readFileSync(path.join(tree, "test-results", "S2A-14-pan-zoom.json"), "utf8")).fps as Fps;
}

const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

async function main() {
  for (const port of [3200, 3300]) if (!(await portFree(port))) throw new Error(`Port ${port} is in use: stop that server first.`);
  const before = conditions();
  const all: Record<string, { main: Fps[]; branch: Fps[] }> = {};
  /** After every side of every round: what else used the processor (to spot a slow spell or an unexpected process). */
  const perRound: { build: string; round: number; side: string; busiest: string[] }[] = [];
  for (const build of builds) {
    prepareMain(build === "production");
    if (build === "production") {
      sh("npm run measure:build", MAIN);
      sh("npm run measure:build", BRANCH);
    }
    copySpec();
    all[build] = { main: [], branch: [] };
    for (let r = 0; r < rounds; r++) {
      // the side that starts changes every round
      for (const side of r % 2 === 0 ? (["main", "branch"] as const) : (["branch", "main"] as const)) {
        all[build]![side].push(measure(side === "main" ? MAIN : BRANCH, side, build));
        perRound.push({ build, round: r + 1, side, busiest: (conditions() as { busiestProcesses?: string[] }).busiestProcesses ?? [] });
        // kept after every side, so an interrupted sitting keeps what it measured
        fs.mkdirSync(path.join(BRANCH, "test-results"), { recursive: true });
        fs.writeFileSync(path.join(BRANCH, "test-results", "S2A-14-ab-partial.json"), JSON.stringify({ before, perRound, all }, null, 2));
      }
    }
  }
  const after = conditions();

  const pooled = (list: Fps[], grid: string, view: "overview" | "100%") => list.flatMap((f) => f[grid]?.[view] ?? []);
  const summary: Record<string, unknown> = {};
  const table: string[] = ["| Build | View | main | " + grids.split(",").map((g) => `branch, ${g}`).join(" | ") + " |"];
  let pass = true;
  for (const build of builds) {
    const { main: m, branch: b } = all[build]!;
    for (const view of ["overview", "100%"] as const) {
      const base = median(pooled(m, "main", view));
      const cells = grids.split(",").map((g) => {
        const v = median(pooled(b, g, view));
        const diff = ((v - base) / base) * 100;
        if (diff < BAR_PERCENT && g !== "none") pass = false;
        summary[`${build} ${view} ${g}`] = { main: base, branch: v, diffPercent: +diff.toFixed(1) };
        return `${v.toFixed(1)} (${diff >= 0 ? "+" : ""}${diff.toFixed(1)} %)`;
      });
      table.push(`| ${build} | ${view} | ${base.toFixed(1)} | ${cells.join(" | ")} |`);
    }
  }
  const results = { bar: `branch medians at most ${-BAR_PERCENT} % below main's (grids dots and lines)`, pass, rounds, runsPerRound: Number(runs), conditions: { before, after, perRound }, summary, all };
  fs.mkdirSync(path.join(BRANCH, "test-results"), { recursive: true });
  fs.writeFileSync(path.join(BRANCH, "test-results", "S2A-14-ab.json"), JSON.stringify(results, null, 2));
  console.log(table.join("\n"));
  console.log(pass ? "S2A-14 pan and zoom: no regression against main." : "S2A-14 pan and zoom: more than 5 % below main somewhere.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
