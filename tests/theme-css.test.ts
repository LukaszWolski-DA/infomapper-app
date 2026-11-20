// Slice 32 (D-85, Q2): the dark values have one source. Tailwind's `dark` variant in globals.css is the only place that
// reads `prefers-color-scheme`; every dark value is written under `@variant dark` (or a `dark:` utility), which Tailwind
// writes under both selectors: the system's media query while no theme is chosen, and `data-theme="dark"`. A dark rule
// written under the media query alone would ignore the person's choice; this test refuses it.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { compile } from "@tailwindcss/node";

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const code = filesUnder(SRC).filter((f) => /\.(css|ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));
const css = code.filter((f) => f.endsWith(".css"));
const GLOBALS = join(SRC, "app", "globals.css");

describe("the theme's CSS (slice 32)", () => {
  it("reads prefers-color-scheme only in the dark variant's definition", () => {
    const readers = code.filter((f) => /@media\s*\(\s*prefers-color-scheme/.test(readFileSync(f, "utf8")));
    expect(readers.map((f) => relative(ROOT, f).replace(/\\/g, "/"))).toEqual(["src/app/globals.css"]);
    const globals = readFileSync(GLOBALS, "utf8");
    expect(globals.match(/@media\s*\(\s*prefers-color-scheme/g)).toHaveLength(1);
    const variant = globals.slice(globals.indexOf("@custom-variant dark {"));
    expect(variant.indexOf("@media (prefers-color-scheme: dark)")).toBeGreaterThan(0);
    expect(variant.indexOf("@media (prefers-color-scheme: dark)")).toBeLessThan(variant.indexOf("\n}\n"));
  });

  it("gives every other CSS file that writes a dark value the variant by @reference", () => {
    for (const f of css.filter((f) => f !== GLOBALS && readFileSync(f, "utf8").includes("@variant dark"))) {
      expect(readFileSync(f, "utf8"), relative(ROOT, f)).toMatch(/@reference "[./]*app\/globals\.css";/);
    }
  });

  it("writes the dark tokens under the system's query without a choice and under data-theme=\"dark\"", async () => {
    const compiler = await compile(readFileSync(GLOBALS, "utf8"), { base: join(SRC, "app"), onDependency: () => {} });
    const out = compiler.build([]);
    const system = out.indexOf(':root:where(:root:not([data-theme="light"]), :root:not([data-theme="light"]) *)');
    const chosen = out.indexOf(':root:where([data-theme="dark"], [data-theme="dark"] *)');
    expect(system).toBeGreaterThan(0);
    expect(chosen).toBeGreaterThan(0);
    expect(out.slice(chosen, chosen + 200)).toContain("--im-canvas: #13181e");
    expect(out.slice(system, system + 200)).toContain("--im-canvas: #13181e");
    expect(out.lastIndexOf("@media (prefers-color-scheme: dark)", system)).toBeGreaterThan(-1);
  }, 30_000);
});
