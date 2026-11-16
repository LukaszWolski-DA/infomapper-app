// A guard (slice 28): a Tailwind utility glued to a template placeholder in a `className` (`p-2${…}`,
// `grid-cols-[…]${…}`, `${…}px-2`) is one token for Tailwind's scanner, which then never generates the class. It
// happened twice in slice 28 (F6, the figure entry's padding; the editor's grid). This scans every `className={`…`}`
// in src/ and lists each glued spot whose token is shaped like a Tailwind utility. The app's own CSS classes glued to a
// placeholder (`row${sel ? " sel" : ""}`, `c-${colour}` on the canvas) are left alone: their stylesheet is not
// generated, and the class string the browser gets is the same.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return d.name === "node_modules" ? [] : files(p);
    return /\.(tsx|ts)$/.test(d.name) && !/\.test\.tsx?$/.test(d.name) ? [p] : [];
  });
}

/**
 * The glued spots of one template literal, from its opening backtick at `start`: a static part that ends in a
 * non-space before `${`, or one that begins with a non-space right after a placeholder's `}`. Placeholders are skipped
 * whole, with their own strings and nested templates. Answers the spots and the index after the closing backtick.
 */
export function gluedIn(text: string, start: number): { spots: string[]; end: number } {
  const spots: string[] = [];
  let i = start + 1;
  let part = "";
  let afterPlaceholder = false;
  const skipPlaceholder = (from: number): number => {
    let depth = 1, j = from;
    while (j < text.length && depth > 0) {
      const c = text[j]!;
      if (c === "`") j = gluedIn(text, j).end - 1;
      else if (c === '"' || c === "'") {
        const q = c;
        j++;
        while (j < text.length && text[j] !== q) j += text[j] === "\\" ? 2 : 1;
      } else if (c === "{") depth++;
      else if (c === "}") depth--;
      j++;
    }
    return j;
  };
  while (i < text.length) {
    const c = text[i]!;
    if (c === "\\") {
      part += text.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (c === "`") {
      if (afterPlaceholder && part && !/^\s/.test(part)) spots.push(`}${part.split(/\s/)[0]}`);
      return { spots, end: i + 1 };
    }
    if (c === "$" && text[i + 1] === "{") {
      if (part && !/\s$/.test(part) && !(afterPlaceholder && part === "")) spots.push(`${part.split(/\s/).pop()}\${`);
      if (afterPlaceholder && part && !/^\s/.test(part)) spots.push(`}${part.split(/\s/)[0]}`);
      i = skipPlaceholder(i + 2);
      part = "";
      afterPlaceholder = true;
      continue;
    }
    part += c;
    i++;
  }
  return { spots, end: i };
}

/** A token shaped like a Tailwind utility (variants and `!` aside): one of its utility roots with a value, or a bare one. */
const UTILITY =
  /^(?:[a-z0-9-]+:)*!?-?(?:(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|w|h|min-w|min-h|max-w|max-h|size|text|bg|border|border-[trblxy]|rounded|grid-cols|grid-rows|col|row|items|justify|content|self|place|shadow|opacity|font|leading|tracking|z|top|left|right|bottom|inset|overflow|whitespace|ring|outline|fill|stroke|translate|rotate|scale|cursor|select|pointer-events|space|divide|order|basis|line-clamp|decoration|aspect|duration|transition|animate|origin|columns)-.+|grid|flex|block|hidden|inline|inline-flex|inline-block|truncate|absolute|relative|fixed|sticky|sr-only|contents|italic|underline|uppercase|lowercase|capitalize|grow|shrink|border|rounded|shadow|transition|outline|ring)$/;
const isUtility = (spot: string) => UTILITY.test(spot.replace(/^\}/, "").replace(/\$\{$/, ""));

/** Every glued spot in a file's `className={`…`}` templates whose token is a Tailwind utility, with its line. */
export function gluedClasses(source: string): string[] {
  const out: string[] = [];
  const re = /className=\{\s*`/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    const at = m.index + m[0].length - 1;
    const line = source.slice(0, at).split("\n").length;
    for (const spot of gluedIn(source, at).spots.filter(isUtility)) out.push(`line ${line}: ${spot}`);
  }
  return out;
}

describe("no class name glued to a template placeholder in a className (slice 28)", () => {
  it("finds the two shapes slice 28 had, and leaves spaced ones alone", () => {
    expect(gluedClasses('<div className={`mb-2 border p-2${on ? "" : " opacity-70"}`} />')).toEqual(["line 1: p-2${"]);
    expect(gluedClasses("<div className={`de-body grid-cols-[a_b]${x}`} />")).toEqual(["line 1: grid-cols-[a_b]${"]);
    expect(gluedClasses("<div className={`${a}px-2 b`} />")).toEqual(["line 1: }px-2"]);
    expect(gluedClasses('<div className={`a ${on ? "x" : `y ${z}`} b ${c}`} />')).toEqual([]);
    expect(gluedClasses("<div className={`${a} ${b}`} />")).toEqual([]);
    // the app's own classes (not Tailwind's) may be glued: their CSS is not generated
    expect(gluedClasses('<div className={`row${sel ? " sel" : ""} c-${colour}`} />')).toEqual([]);
  });

  it("src/ has none", () => {
    const found = files(join(ROOT, "src")).flatMap((f) => gluedClasses(readFileSync(f, "utf8")).map((s) => `${relative(ROOT, f)} ${s}`));
    expect(found).toEqual([]);
  });
});
