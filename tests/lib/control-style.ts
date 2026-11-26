// Slice 37 (S37-05, A3): what the control-style guard reads. It parses a `.tsx` file with TypeScript's AST, finds every
// control tag (`<button>`, `<input>` that is a field, `<select>`, `<textarea>`) and the classes its `className` can
// hold (a literal, a template, a conditional, a call's arguments, a constant of the same file or one imported from
// another file under `src/`), and names what styles it on its own:
// - a native `<select>` (the shared `Select` in `src/ui/components/select.tsx` renders the only one);
// - an edge (`border`, `border-2`, `border-b`, …: a width);
// - an arbitrary radius (`rounded-[…]`) or an arbitrary height in px (`h-[…px]`, `min-h-[…px]`, `size-[…px]`);
// - a radius together with a height or size (`rounded-md h-8`, `size-6 rounded`): a button drawn by hand.
// A constant made by a `src/ui` component's variants (`buttonVariants(…)`) or exported by `src/ui` holds no class of its
// own: it is the shared look; `cn(…)` is read through its arguments. `min-h-target` (24 px, S37-03) is allowed: it is
// how a row reaches its target size without becoming a button.

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

export interface Offence {
  readonly file: string;
  readonly line: number;
  readonly tag: string;
  readonly why: string;
}

const ROOT = process.cwd();
const FIELD_INPUT_TYPES_SKIPPED = new Set(["checkbox", "radio", "file", "hidden", "range", "color"]);

/** The class tokens a className expression can hold; `null` stands for "shared" (from `src/ui`) or unknown (a prop). */
type Tokens = Set<string>;

interface Source {
  readonly file: string;
  readonly sf: ts.SourceFile;
  readonly consts: Map<string, ts.Expression>;
  readonly imports: Map<string, { from: string; name: string }>;
}

const cache = new Map<string, Source | null>();

function sourceOf(file: string, text?: string): Source | null {
  if (text === undefined && cache.has(file)) return cache.get(file)!;
  let code = text;
  if (code === undefined) {
    try {
      code = readFileSync(path.join(ROOT, file), "utf8");
    } catch {
      cache.set(file, null);
      return null;
    }
  }
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const consts = new Map<string, ts.Expression>();
  const imports = new Map<string, { from: string; name: string }>();
  sf.forEachChild((n) => {
    if (ts.isVariableStatement(n))
      for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) consts.set(d.name.text, d.initializer);
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings))
      for (const el of n.importClause.namedBindings.elements) imports.set(el.name.text, { from: n.moduleSpecifier.text, name: (el.propertyName ?? el.name).text });
  });
  const s = { file, sf, consts, imports };
  if (text === undefined) cache.set(file, s);
  return s;
}

/** A module specifier as a file under `src/`, or null (a package). */
function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.posix.join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.posix.join(path.posix.dirname(from), spec);
  else return null;
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    const f = base + ext;
    try {
      readFileSync(path.join(ROOT, f));
      return f;
    } catch {
      /* next */
    }
  }
  return null;
}

const isUi = (file: string) => file.startsWith("src/ui/");

/** The classes an expression can hold. `seen` stops a constant that refers to itself. */
function tokensOf(src: Source, e: ts.Expression | undefined, seen = new Set<string>()): Tokens {
  const out: Tokens = new Set();
  const add = (s: string) => s.split(/\s+/).filter(Boolean).forEach((t) => out.add(t));
  const walk = (x: ts.Node | undefined, s: Source): void => {
    if (!x) return;
    if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) return add(x.text);
    if (ts.isTemplateExpression(x)) {
      add(x.head.text);
      for (const span of x.templateSpans) {
        walk(span.expression, s);
        add(span.literal.text);
      }
      return;
    }
    if (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isNonNullExpression(x)) return walk(x.expression, s);
    if (ts.isConditionalExpression(x)) return (walk(x.whenTrue, s), walk(x.whenFalse, s));
    if (ts.isBinaryExpression(x)) return (walk(x.left, s), walk(x.right, s));
    if (ts.isJsxExpression(x)) return walk(x.expression, s);
    if (ts.isArrayLiteralExpression(x)) return x.elements.forEach((el) => walk(el, s));
    if (ts.isCallExpression(x)) {
      // a src/ui component's variants (`buttonVariants(…)`) hold the shared look: nothing of its own. Any other call, `cn`
      // from src/ui included, is read through its arguments.
      const callee = ts.isIdentifier(x.expression) ? x.expression.text : null;
      const imported = callee ? s.imports.get(callee) : undefined;
      const target = imported ? resolve(s.file, imported.from) : null;
      if (target && isUi(target) && /Variants$/.test(imported!.name)) return;
      if (ts.isPropertyAccessExpression(x.expression) && x.expression.name.text === "join" && ts.isArrayLiteralExpression(x.expression.expression)) return walk(x.expression.expression, s);
      return x.arguments.forEach((a) => walk(a, s));
    }
    if (ts.isIdentifier(x)) {
      const key = `${s.file}:${x.text}`;
      if (seen.has(key)) return;
      seen.add(key);
      const local = s.consts.get(x.text);
      if (local) return walk(local, s);
      const imported = s.imports.get(x.text);
      if (!imported) return; // a prop or a parameter: unknown, not counted
      const target = resolve(s.file, imported.from);
      if (!target || isUi(target)) return;
      const other = sourceOf(target);
      const init = other?.consts.get(imported.name);
      if (other && init) return walk(init, other);
    }
  };
  walk(e, src);
  return out;
}

const strip = (t: string) => t.replace(/^(?:[\w-]+(?:\[[^\]]*\])?:)+/, "").replace(/^!/, "");
const EDGE = /^border(?:-[xytrblse])?(?:-\d+|-\[[^\]]+px\])?$/;
const RADIUS = /^rounded(?:-.+)?$/;
const HEIGHT = /^(?:h|min-h|size)-(?!full$|auto$|fit$|min$|max$|screen$|dvh$|svh$|lvh$|px$|0$|target$).+/;
const ARBITRARY_PX = /^(?:h|min-h|size)-\[\d+(?:\.\d+)?px\]$/;

/** Why a control's classes style it on its own, or null. */
export function offenceOf(tokens: Tokens): string | null {
  const ts_ = [...tokens].map(strip);
  const edge = ts_.find((t) => EDGE.test(t));
  if (edge) return `an edge (${edge})`;
  const arbitraryRadius = ts_.find((t) => /^rounded(?:-[a-z]+)?-\[/.test(t));
  if (arbitraryRadius) return `an arbitrary radius (${arbitraryRadius})`;
  const arbitraryHeight = ts_.find((t) => ARBITRARY_PX.test(t));
  if (arbitraryHeight) return `an arbitrary height (${arbitraryHeight})`;
  const radius = ts_.find((t) => RADIUS.test(t) && t !== "rounded-none");
  const height = ts_.find((t) => HEIGHT.test(t));
  if (radius && height) return `a radius and a height (${radius} ${height})`;
  return null;
}

/** Every control styled on its own in one file (`text` for a probe that is not on disk). */
export function offencesIn(file: string, text?: string): Offence[] {
  const src = sourceOf(file, text);
  if (!src) return [];
  const out: Offence[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText(src.sf);
      if (tag === "button" || tag === "input" || tag === "select" || tag === "textarea") {
        let cls: ts.Expression | undefined;
        let type: string | null = null;
        for (const p of n.attributes.properties) {
          if (!ts.isJsxAttribute(p) || !p.initializer) continue;
          const name = p.name.getText(src.sf);
          if (name === "className") cls = ts.isStringLiteral(p.initializer) ? p.initializer : ts.isJsxExpression(p.initializer) ? p.initializer.expression : undefined;
          if (name === "type" && ts.isStringLiteral(p.initializer)) type = p.initializer.text;
        }
        const line = src.sf.getLineAndCharacterOfPosition(n.getStart(src.sf)).line + 1;
        if (tag === "select") out.push({ file, line, tag, why: "a native <select> (use Select from src/ui/components/select.tsx)" });
        else if (!(tag === "input" && type && FIELD_INPUT_TYPES_SKIPPED.has(type))) {
          const why = offenceOf(tokensOf(src, cls));
          if (why) out.push({ file, line, tag, why });
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(src.sf);
  return out;
}
