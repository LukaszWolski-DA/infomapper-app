import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PART_COUNT, PART_STARTS, listedFiles, partFolders } from "../e2e/parts";

// The full e2e run's parts (slice 14b, item 1, F18; seven since chore CI e2e; eight since chore e2e eight parts; recut by
// chore recut e2e parts): every
// folder runs in exactly one part, in Playwright's order; `npm run e2e -- --list` lists each part's files as its run
// finds them, the same files as one plain list of the whole e2e folder, and GitHub Actions runs exactly those (CI-02).
const FOLDERS = ["fixes", "measure", "slice-00", "slice-02a", "slice-02b", "slice-04a", "slice-04b1", "slice-06b", "slice-07a", "slice-07c", "slice-08", "slice-10c", "slice-11", "slice-14b", "slice-15a", "slice-19", "slice-20", "slice-26"];

describe("e2e parts", () => {
  it("has eight parts", () => {
    expect(PART_COUNT).toBe(8);
    expect(PART_STARTS).toEqual(["slice-02b", "slice-04b1", "slice-07a", "slice-08", "slice-11", "slice-15a", "slice-20"]);
  });

  it("puts every folder in exactly one part, in order", () => {
    const parts = Array.from({ length: PART_COUNT }, (_, i) => partFolders(i + 1, FOLDERS));
    expect(parts.flat()).toEqual(FOLDERS);
    expect(parts).toEqual([
      ["fixes", "measure", "slice-00", "slice-02a"],
      ["slice-02b", "slice-04a"],
      ["slice-04b1", "slice-06b"],
      ["slice-07a", "slice-07c"],
      ["slice-08", "slice-10c"],
      ["slice-11", "slice-14b"],
      ["slice-15a", "slice-19"],
      ["slice-20", "slice-26"],
    ]);
  });

  it("starts each later part at its first folder", () => {
    for (const [i, start] of PART_STARTS.entries()) expect(partFolders(i + 2, FOLDERS)[0]).toBe(start);
  });

  it("refuses a part that does not exist", () => {
    expect(() => partFolders(0, FOLDERS)).toThrow("E2E_PART must be 1 to 8");
    expect(() => partFolders(9, FOLDERS)).toThrow("E2E_PART must be 1 to 8");
  });

  it("reads the files of Playwright's JSON list, relative to e2e/, once each, sorted", () => {
    expect(listedFiles({ suites: [{ file: "slice-01a\\S1A-02.spec.ts" }, { file: "e2e/slice-00/S0-01.spec.ts" }, { file: "slice-01a/S1A-02.spec.ts" }, {}] })).toEqual([
      "slice-00/S0-01.spec.ts",
      "slice-01a/S1A-02.spec.ts",
    ]);
    expect(listedFiles({})).toEqual([]);
  });
});

/** Runs a command in the repository, without a shell, and returns its standard output. */
function run(args: string[]): string {
  const r = spawnSync(process.execPath, args, { encoding: "utf8", env: { ...process.env, E2E_PART: "", E2E_BLOB: "", MEASURE_BUILD: "", SCREENS: "", BROWSERS: "" }, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${args.join(" ")} failed (${r.status}):\n${r.stderr}`);
  return r.stdout;
}
const TSX = path.resolve("node_modules", "tsx", "dist", "cli.mjs");
const PLAYWRIGHT = path.resolve("node_modules", "@playwright", "test", "cli.js");

/** `npm run e2e -- --list [--part <n>]`'s output, by part. */
function wrapperList(extra: string[] = []): Map<number, string[]> {
  const parts = new Map<number, string[]>();
  let current: string[] | undefined;
  for (const line of run([TSX, "scripts/e2e.ts", "--list", ...extra]).split(/\r?\n/)) {
    const head = /^part (\d+) \(.*\): (\d+) files$/.exec(line);
    if (head) parts.set(Number(head[1]), (current = []));
    else if (line.startsWith("  ") && current) current.push(line.trim());
  }
  return parts;
}

describe("npm run e2e -- --list", () => {
  it("lists each part's files: every file once, in its part's folders, the same files as one plain list", () => {
    const parts = wrapperList();
    expect([...parts.keys()]).toEqual(Array.from({ length: PART_COUNT }, (_, i) => i + 1));
    for (const [part, files] of parts) {
      expect(files.length, `part ${part}`).toBeGreaterThan(0);
      const folders = partFolders(part);
      for (const f of files) expect(folders, f).toContain(f.split("/")[0]);
    }
    const all = [...parts.values()].flat();
    expect(new Set(all).size).toBe(all.length);
    const plain = listedFiles(JSON.parse(run([PLAYWRIGHT, "test", "--list", "--reporter=json"])) as { suites?: { file?: string }[] });
    expect([...all].sort()).toEqual(plain);
    // CI-02: the specs with a measuring mode run without it in the full run; the measurement build's specs do not
    for (const f of ["slice-01a/S1A-14.spec.ts", "slice-01b/S1B-09.spec.ts", "slice-01b/S1B-10.spec.ts", "slice-02a/S2A-14.spec.ts"]) expect(all).toContain(f);
    for (const f of ["slice-03b/S3B-15-elements.spec.ts", "slice-15c/S15C-layers.spec.ts", "slice-12b/S12B-browsers.spec.ts"]) expect(all).not.toContain(f);
  }, 120_000);

  it("lists one part with --part", () => {
    const parts = wrapperList(["--part", "7"]);
    expect([...parts.keys()]).toEqual([7]);
    expect(parts.get(7)!.every((f) => partFolders(7).includes(f.split("/")[0]!))).toBe(true);
  }, 60_000);
});
