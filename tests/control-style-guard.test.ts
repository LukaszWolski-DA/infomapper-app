// Slice 37 (S37-05, A3, AD-20's note as proposed): it stays this way. Outside `src/ui`, a control tag (`<button>`, an
// `<input>` that is a field, `<textarea>`) may not be styled on its own: no edge, no arbitrary radius or height, no radius
// with a height; and no native `<select>` at all (the shared `Select` renders it). The rules are tests/lib/control-style.ts
// (TypeScript's AST: a literal, a template, a constant of the file or one imported from another file under `src/`; a
// `src/ui` component's variants are the shared look). Probes it must refuse are checked in memory, as
// tests/layer-rules.test.ts lints its probes.
//
// EXCEPTIONS are files drawn by other rules, each with its reason. TO_CONVERT lists the files not converted yet: steps
// 3 to 8 empty it, and the test fails when a file in it no longer offends (take it out) or a file outside it offends.
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { offencesIn } from "./lib/control-style";

const EXCEPTIONS: Readonly<Record<string, string>> = {
  "src/app/w/[workspaceId]/p/[projectId]/_components/canvas-tabs.tsx": "the canvas tabs with their menus and the rename field are slice 38's layout (F8)",
};

/** Slice 37, step 2: every file that styled a control on its own after `fields.tsx`' constants became the shared look.
 * Step 3a converted the inspector's panels and InfoCube's sections (15 files); step 3b the left panel, the toolbox and
 * the import wizard (6); step 4 the top bar, the navigation row and the canvas's switches (16);
 * step 5 the homes, settings, people, baselines and dialogs (12); steps 6 and 7 InfoDocumenter and InfoCube (10);
 * step 8 sign-in, the links' pages and the error pages (7): the list is empty. */
const TO_CONVERT: readonly string[] = [];

const files = () =>
  execFileSync("git", ["ls-files", "src/**/*.tsx"], { encoding: "utf8" })
    .split("\n")
    .filter((f) => f && !f.startsWith("src/ui/"));

describe("controls are styled only in src/ui (S37-05)", () => {
  const offending = new Map<string, string[]>();
  for (const f of files()) {
    const o = offencesIn(f);
    if (o.length) offending.set(f, o.map((x) => `${f}:${x.line} <${x.tag}> ${x.why}`));
  }

  it("no file outside the exceptions and the list to convert styles a control on its own", () => {
    const outside = [...offending].filter(([f]) => !(f in EXCEPTIONS) && !TO_CONVERT.includes(f)).flatMap(([, lines]) => lines);
    expect(outside).toEqual([]);
  });

  it("the list to convert holds only files that still offend (take a converted one out)", () => {
    expect(TO_CONVERT.filter((f) => !offending.has(f))).toEqual([]);
  });

  it("every exception is a file that exists", () => {
    const all = new Set(files());
    expect(Object.keys(EXCEPTIONS).filter((f) => !all.has(f))).toEqual([]);
  });
});

describe("the guard's probes (S37-05)", () => {
  const probe = (code: string) => offencesIn("src/app/__control_probe__.tsx", code).map((o) => o.why);

  it("refuses a native select", () => {
    expect(probe(`export const P = () => <select><option>a</option></select>;`)).toEqual(["a native <select> (use Select from src/ui/components/select.tsx)"]);
  });
  it("refuses an edge, an arbitrary radius or height, and a radius with a height", () => {
    expect(probe(`export const P = () => <button className="border px-2">a</button>;`)).toEqual(["an edge (border)"]);
    expect(probe(`export const P = () => <button className="rounded-[7px] px-2">a</button>;`)).toEqual(["an arbitrary radius (rounded-[7px])"]);
    expect(probe(`export const P = () => <input className="h-[26px] w-full" />;`)).toEqual(["an arbitrary height (h-[26px])"]);
    expect(probe(`export const P = () => <button className="size-6 rounded">a</button>;`)).toEqual(["a radius and a height (rounded size-6)"]);
  });
  it("follows a constant, a template and a conditional", () => {
    const code = `const small = "h-[26px] rounded-md px-2";
export const P = ({ on }: { on: boolean }) => <button className={\`\${on ? small : "x"} w-full\`}>a</button>;`;
    expect(probe(code)).toEqual(["an arbitrary height (h-[26px])"]);
  });
  it("reads cn's arguments: merging is not the shared look", () => {
    const code = `import { cn } from "@/ui/lib/utils";
import { buttonVariants } from "@/ui/components/button";
export const P = () => <><button className={cn(buttonVariants(), "rounded-[7px]")}>a</button><button className={cn(buttonVariants(), "w-full")}>b</button></>;`;
    expect(probe(code)).toEqual(["an arbitrary radius (rounded-[7px])"]);
  });
  it("accepts the shared look, layout classes, a row's target height, check boxes and an unknown prop", () => {
    const code = `import { buttonVariants } from "@/ui/components/button";
export const P = ({ className }: { className: string }) => (
  <>
    <button className={buttonVariants({ size: "sm" })}>a</button>
    <button className={\`\${buttonVariants()} w-full mt-2\`}>b</button>
    <button className="flex min-h-target w-full items-center rounded-md px-2 hover:bg-im-hover">row</button>
    <input type="checkbox" className="h-[13px] border" />
    <button className={className}>c</button>
  </>
);`;
    expect(probe(code)).toEqual([]);
  });
});
