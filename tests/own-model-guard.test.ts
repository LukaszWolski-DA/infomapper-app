// Slice 31 (C1.2, S31-09, F12): Łukasz's own model never in a run. Every file a test run loads (specs, fixtures, helpers,
// configs, workflows) is checked:
// - it never names his organization (the word, upper case, on its own): the name is allowed only in the two scripts that
//   find it (`scripts/pg-kb.ts`, `scripts/kb-counts.ts`) and in CLAUDE.md;
// - its code (comments left out: "never .data/dev-db.json" warns, it does not read) never names the local data file or
//   the backups folder as a path, except the copy's own reader (`scripts/lib/backup-file.ts`, which enforces the rule);
// - it never uses the variables of his account (only `scripts/pg-accounts.ts` reads them).
// The patterns are built from pieces, so this file does not name what it looks for.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const SELF = "tests/own-model-guard.test.ts";
const NAME = new RegExp(`\\b${"K"}${"B"}\\b`);
const PATHS = new RegExp(`\\.data[\\\\/]+(${["dev-db", "json"].join("\\.")}|${"back" + "ups"})|${"kb" + "-model"}`);
const ACCOUNT = new RegExp(`INFOMAPPER_${"K" + "B"}_(EMAIL|PASSWORD)`);
const PATHS_ALLOWED = new Set(["scripts/lib/backup-file.ts"]);

/** The files a test run loads: specs, fixtures and helpers, the scripts' helpers they import, configs and workflows. */
function inScope(): string[] {
  const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
  return files.filter(
    (f) =>
      f !== SELF &&
      /\.(ts|tsx|mts|mjs|js|yml|yaml|json)$/.test(f) &&
      (f.startsWith("e2e/") ||
        f.startsWith("tests/") ||
        f.startsWith("scripts/lib/") ||
        /^scripts\/e2e[^/]*\.ts$/.test(f) ||
        /^(playwright[^/]*|vitest[^/]*)\.config\.(ts|mts|mjs)$/.test(f) ||
        f.startsWith(".github/")),
  );
}

/** A file's lines without comments (`//` to the line's end, `/* … *\/` blocks, a workflow's `#` lines). */
function codeLines(text: string, file: string): string[] {
  if (/\.ya?ml$/.test(file)) return text.split("\n").filter((l) => !/^\s*#/.test(l));
  const noBlocks = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
  return noBlocks.split("\n").map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, "$1"));
}

describe("Łukasz's own model never in a run (C1.2, F12)", () => {
  const files = inScope();

  it("checks the files a run loads", () => {
    expect(files.some((f) => f.startsWith("e2e/slice-29/"))).toBe(true);
    expect(files.some((f) => f.startsWith(".github/workflows/"))).toBe(true);
    expect(files).toContain("playwright.pg.config.ts");
    expect(files).toContain("scripts/lib/seed-rows.ts");
  });

  it("no spec, fixture, helper, config or workflow names his organization", () => {
    const hits = files.flatMap((f) => fs.readFileSync(f, "utf8").split("\n").flatMap((l, i) => (NAME.test(l) ? [`${f}:${i + 1}`] : [])));
    expect(hits).toEqual([]);
  });

  it("none reads the local data file or the backups, and none uses his account's variables", () => {
    const hits = files.flatMap((f) =>
      codeLines(fs.readFileSync(f, "utf8"), f).flatMap((l, i) =>
        (PATHS.test(l) && !PATHS_ALLOWED.has(f)) || ACCOUNT.test(l) ? [`${f}:${i + 1}`] : [],
      ),
    );
    expect(hits).toEqual([]);
  });

  it("finds what it looks for", () => {
    expect(NAME.test(`organization ${"K"}B`)).toBe(true);
    expect(NAME.test("4.5 MB, 12 kb")).toBe(false);
    expect(PATHS.test(`readFileSync(".data/${"dev-db"}.json")`)).toBe(true);
    expect(PATHS.test(`".data\\\\${"back"}ups\\\\x.json"`)).toBe(true);
    expect(ACCOUNT.test(`process.env.INFOMAPPER_${"K"}B_EMAIL`)).toBe(true);
    expect(codeLines(`const a = 1; // .data/${"dev-db"}.json\n/* .data/${"back"}ups */ const b = "https://x";`, "x.ts").join("\n")).not.toMatch(PATHS);
    expect(codeLines(`const b = "https://x";`, "x.ts")[0]).toContain("https://x");
  });
});
