// The DDL channel (slice 7a, PRD items 16–18; prototype `tokenizeSQL`, `typeString`, `ddlToStandard`): CREATE TABLE
// scripts translated into the standard, which is then read like a file (`readStandard`), so both channels follow the
// same rules. It reads CREATE TABLE (column and table constraints), ALTER TABLE … ADD (columns and constraints),
// COMMENT ON TABLE/COLUMN, MS_Description extended properties, USE, and GO or / separators; names quoted with [],
// "" or backticks. Everything else is skipped and counted, or skipped with a warning (views, CREATE TABLE … AS SELECT,
// a table or column defined twice, parentheses that do not close, ALTER TABLE on a table the script does not create).
// Database: from USE or three-part names, else the Database field, else the file name without its extension.
// Unqualified schema: the field, else `dbo` (SQL Server signs) or `public` (PostgreSQL signs), else `default`.
// Unlike the prototype, a type keeps its parameter: `datetime2(7)` stays (step 1, answer 4).

import { TYPE_ALIASES } from "../model/column-type";
import { toCsv } from "./delimited";
import { readStandard, STANDARD_FIELDS, type StandardRead } from "./standard";

type Token =
  | { t: "id"; v: string; q: boolean; line: number }
  | { t: "str" | "num" | "p"; v: string; line: number }
  | { t: "sep"; v: ""; line: number };

export function tokenizeSql(sql: string): Token[] {
  const toks: Token[] = [];
  const n = sql.length;
  const lines = sql.split("\n");
  const lineIs = (ln: number, re: RegExp) => re.test((lines[ln - 1] ?? "").trim());
  let i = 0, line = 1;
  while (i < n) {
    const ch = sql[i]!;
    if (ch === "\n") {
      line++;
      i++;
      continue;
    }
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < n && sql[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && sql[i + 1] === "*") {
      const j = sql.indexOf("*/", i + 2), end = j < 0 ? n : j + 2;
      line += (sql.slice(i, end).match(/\n/g) ?? []).length;
      i = end;
      continue;
    }
    if (ch === "'" || (/[NnEe]/.test(ch) && sql[i + 1] === "'" && !/[\w$#]/.test(sql[i - 1] ?? ""))) {
      const start = line;
      let j = ch === "'" ? i + 1 : i + 2, v = "";
      while (j < n) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            v += "'";
            j += 2;
            continue;
          }
          break;
        }
        if (sql[j] === "\n") line++;
        v += sql[j];
        j++;
      }
      toks.push({ t: "str", v, line: start });
      i = j + 1;
      continue;
    }
    if (ch === '"' || ch === "[" || ch === "`") {
      const close = ch === "[" ? "]" : ch;
      let j = i + 1, v = "";
      while (j < n && sql[j] !== close) v += sql[j++];
      toks.push({ t: "id", v, q: true, line });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_#@$À-ɏ]/.test(ch)) {
      let j = i;
      while (j < n && /[\w#@$À-ɏ]/.test(sql[j]!)) j++;
      const v = sql.slice(i, j);
      if (/^go$/i.test(v) && lineIs(line, /^go\s*(\d+)?$/i)) toks.push({ t: "sep", v: "", line });
      else toks.push({ t: "id", v, q: false, line });
      i = j;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < n && /[0-9.]/.test(sql[j]!)) j++;
      toks.push({ t: "num", v: sql.slice(i, j), line });
      i = j;
      continue;
    }
    if (ch === ";" || (ch === "/" && lineIs(line, /^\/$/))) {
      toks.push({ t: "sep", v: "", line });
      i++;
      continue;
    }
    toks.push({ t: "p", v: ch, line });
    i++;
  }
  return toks;
}

const kwIs = (tk: Token | undefined, w: string) => !!tk && tk.t === "id" && !tk.q && tk.v.toUpperCase() === w;
const isP = (tk: Token | undefined, v: string) => !!tk && tk.t === "p" && tk.v === v;
function matchParen(e: Token[], k: number): number {
  let d = 0;
  for (let j = k; j < e.length; j++) {
    if (isP(e[j], "(")) d++;
    else if (isP(e[j], ")")) {
      d--;
      if (!d) return j;
    }
  }
  return -1;
}
function readName(e: Token[], k: number): { parts: string[]; k: number } {
  const parts: string[] = [];
  while (k < e.length && e[k]!.t === "id") {
    parts.push(e[k]!.v);
    k++;
    if (isP(e[k], ".")) k++;
    else break;
  }
  return { parts, k };
}
function parenIdents(e: Token[], k: number): { cols: string[]; k: number } {
  while (k < e.length && !isP(e[k], "(")) k++;
  const end = matchParen(e, k), cols: string[] = [];
  for (let j = k + 1; j < end; j++) if (e[j]!.t === "id" && !(kwIs(e[j], "ASC") || kwIs(e[j], "DESC"))) cols.push(e[j]!.v);
  return { cols, k: end + 1 };
}

const TYPE_STOP = new Set([
  "NOT", "NULL", "PRIMARY", "REFERENCES", "DEFAULT", "IDENTITY", "CONSTRAINT", "COLLATE", "GENERATED", "CHECK", "UNIQUE",
  "AUTO_INCREMENT", "AUTOINCREMENT", "ENABLE", "DISABLE", "ROWGUIDCOL", "SPARSE", "FILESTREAM", "ENCRYPTED", "MASKED", "COMMENT", "ON",
  "AS", "KEY", "CHARSET", "VISIBLE", "INVISIBLE",
]);

/** A column's type as the standard writes it: `varchar(20)`, `decimal(12,2)`, `datetime2(7)`, `text[]`. */
export function typeString(words: readonly string[], args: readonly Token[] | null): string {
  let base = words.map((w) => w.toLowerCase()).join(" ").replace(/\s+\[\]/g, "[]");
  base = TYPE_ALIASES[base] ?? base;
  if (!args) return base;
  const nums = args
    .filter((t) => t.t === "num" || isP(t, "*") || (t.t === "id" && /^max$/i.test(t.v)))
    .map((t) => (isP(t, "*") ? "38" : t.v.toLowerCase()));
  if (!nums.length) return base;
  return nums.length > 1 ? `${base}(${nums[0]},${nums[1]})` : `${base}(${nums[0]})`;
}

interface DdlColumn {
  name: string;
  words: string[];
  args: Token[] | null;
  nullable: boolean;
  pk: boolean;
  comment: string;
  fks: { name: string; toParts: string[]; toCols: string[] }[];
  computed: boolean;
  fkRefs: { name: string; toSchema: string; toTable: string; toCol: string }[];
}
interface DdlTable {
  db: string;
  schema: string;
  name: string;
  key: string;
  cols: DdlColumn[];
  comment: string;
}

export interface DdlSummary {
  tables: number;
  columns: number;
  keys: number;
  comments: number;
  /** What was skipped, by kind: “SET statements”, “CREATE INDEX”… */
  skipped: Record<string, number>;
}

export interface DdlTranslation {
  /** The translated standard (item 18: shown folded, with Copy). */
  standard: string;
  warnings: string[];
  summary: DdlSummary;
  /** The databases the script's tables were put in. */
  databases: string[];
  /** The schema used for unqualified names. */
  defaultSchema: string;
}

export interface DdlOptions {
  /** The Database field. */
  database?: string;
  /** The “Schema for unqualified names” field. */
  schema?: string;
  /** The script's file name, for the database when the script and the field name none. */
  fileName?: string;
  /** The row limit of the translated standard (`readStandard`); the benchmarks read past it. */
  maxRows?: number;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function ddlToStandard(sql: string, opts: DdlOptions = {}): DdlTranslation {
  const toks = tokenizeSql(sql);
  const stmts: Token[][] = [];
  let cur: Token[] = [];
  for (const t of toks) {
    if (t.t === "sep") {
      if (cur.length) stmts.push(cur);
      cur = [];
    } else cur.push(t);
  }
  if (cur.length) stmts.push(cur);
  const guessSchema = /\[dbo\]|\bGO\b|IDENTITY\s*\(/i.test(sql) ? "dbo" : /::|\bOWNER TO\b|\bSERIAL\b|\bpublic\./i.test(sql) ? "public" : "";
  const defaultSchema = (opts.schema ?? "").trim() || guessSchema || "default";
  let curDb = (opts.database ?? "").trim() || (opts.fileName ?? "").trim().replace(/\.[^.]+$/, "");
  const usedDbs = new Set<string>();
  const tables = new Map<string, DdlTable>(), order: DdlTable[] = [];
  const pks: { table: DdlTable; cols: string[] }[] = [];
  const fks: { table: DdlTable; name: string; cols: string[]; toParts: string[]; toCols: string[] }[] = [];
  const comments: { parts: string[]; col: string | null; text: string }[] = [];
  const warnings: string[] = [];
  const summary: DdlSummary = { tables: 0, columns: 0, keys: 0, comments: 0, skipped: {} };
  const skip = (what: string) => (summary.skipped[what] = (summary.skipped[what] ?? 0) + 1);
  const resolve = (parts: readonly string[]) => {
    const p = [...parts];
    const name = p.pop() ?? "", schema = p.pop() || defaultSchema, db = p.pop() || curDb || "database";
    usedDbs.add(db);
    return { db, schema, name, key: `${db}|${schema}|${name}`.toLowerCase() };
  };
  const findTable = (parts: readonly string[]) => {
    const r = resolve(parts);
    return tables.get(r.key) ?? [...tables.values()].find((t) => t.schema.toLowerCase() === r.schema.toLowerCase() && t.name.toLowerCase() === r.name.toLowerCase());
  };

  function parseColumn(e: Token[], t: DdlTable, line: number): DdlColumn {
    const col: DdlColumn = { name: e[0]!.v, words: [], args: null, nullable: true, pk: false, comment: "", fks: [], computed: false, fkRefs: [] };
    let k = 1;
    if (kwIs(e[1], "AS")) {
      col.computed = true;
      warnings.push(`Line ${line}: ${t.schema}.${t.name}.${col.name} is a computed column; its type is not in the DDL, so it is imported as “computed”. Set the type in the standard if you need it.`);
      return col;
    }
    while (k < e.length) {
      const tk = e[k]!;
      if (tk.t === "id" && tk.q && tk.v === "" && col.words.length) {
        col.words[col.words.length - 1] += "[]";
        k++;
        continue;
      }
      if (tk.t === "id" && (tk.q || !TYPE_STOP.has(tk.v.toUpperCase()))) {
        col.words.push(tk.v);
        k++;
        continue;
      }
      if (isP(tk, "(") && col.args === null && col.words.length) {
        const end = matchParen(e, k);
        col.args = e.slice(k + 1, end);
        k = end + 1;
        continue;
      }
      break;
    }
    let cname: string | null = null;
    for (; k < e.length; k++) {
      const tk = e[k]!;
      const u = tk.t === "id" && !tk.q ? tk.v.toUpperCase() : null;
      if (u === "NOT" && kwIs(e[k + 1], "NULL")) {
        col.nullable = false;
        k++;
      } else if (u === "NULL") col.nullable = true;
      else if (u === "PRIMARY" && kwIs(e[k + 1], "KEY")) {
        col.pk = true;
        col.nullable = false;
        k++;
      } else if (u === "CONSTRAINT" && e[k + 1]) {
        cname = e[k + 1]!.v;
        k++;
      } else if (u === "REFERENCES") {
        const r = readName(e, k + 1);
        const toCols = isP(e[r.k], "(") ? parenIdents(e, r.k).cols : [];
        col.fks.push({ name: cname ?? `FK_${t.name}_${col.name}`, toParts: r.parts, toCols });
        cname = null;
      } else if (u === "COMMENT" && e[k + 1]?.t === "str") {
        col.comment = e[k + 1]!.v;
        k++;
      } else if (isP(tk, "(")) {
        const end = matchParen(e, k);
        if (end > k) k = end;
      }
    }
    return col;
  }
  function tableConstraint(e: Token[], t: DdlTable): boolean {
    let j = 0, cname: string | null = null;
    if (kwIs(e[0], "CONSTRAINT")) {
      cname = e[1]?.v ?? null;
      j = 2;
    }
    if (kwIs(e[j], "PRIMARY") && kwIs(e[j + 1], "KEY")) {
      pks.push({ table: t, cols: parenIdents(e, j + 2).cols });
      return true;
    }
    if (kwIs(e[j], "FOREIGN") && kwIs(e[j + 1], "KEY")) {
      const p = parenIdents(e, j + 2);
      let k = p.k;
      while (k < e.length && !kwIs(e[k], "REFERENCES")) k++;
      const r = readName(e, k + 1);
      fks.push({ table: t, name: cname ?? `FK_${t.name}_${p.cols.join("_")}`, cols: p.cols, toParts: r.parts, toCols: isP(e[r.k], "(") ? parenIdents(e, r.k).cols : [] });
      return true;
    }
    if (["UNIQUE", "CHECK", "INDEX", "KEY", "FULLTEXT", "SPATIAL", "EXCLUDE", "PERIOD"].some((w) => kwIs(e[j], w))) {
      skip("unique, check and index clauses");
      return true;
    }
    return !!cname;
  }
  function splitTop(e: Token[], from: number, to: number): Token[][] {
    const out: Token[][] = [];
    let part: Token[] = [], d = 0;
    for (let j = from; j < to; j++) {
      if (isP(e[j], "(")) d++;
      else if (isP(e[j], ")")) d--;
      if (d === 0 && isP(e[j], ",")) {
        out.push(part);
        part = [];
      } else part.push(e[j]!);
    }
    if (part.length) out.push(part);
    return out;
  }
  function addColumnTo(t: DdlTable, el: Token[], line: number) {
    const col = parseColumn(el, t, line);
    if (t.cols.some((c) => c.name.toLowerCase() === col.name.toLowerCase())) {
      warnings.push(`Line ${line}: ${t.name}.${col.name} is defined twice; the second definition is skipped.`);
      return;
    }
    t.cols.push(col);
    summary.columns++;
    if (col.pk) pks.push({ table: t, cols: [col.name] });
    for (const f of col.fks) fks.push({ table: t, name: f.name, cols: [col.name], toParts: f.toParts, toCols: f.toCols });
  }

  for (const e of stmts) {
    const line = e[0]!.line;
    let k = 0;
    if (kwIs(e[0], "USE")) {
      curDb = e[1] ? e[1].v : curDb;
      continue;
    }
    if (kwIs(e[0], "CREATE")) {
      k = 1;
      const modifiers = ["OR", "REPLACE", "ALTER", "UNIQUE", "CLUSTERED", "NONCLUSTERED", "BITMAP", "GLOBAL", "LOCAL", "TEMPORARY", "TEMP", "UNLOGGED", "FORCE", "NOFORCE", "EDITIONABLE", "NONEDITIONABLE", "PRIVATE", "SHARDED", "DUPLICATED", "MATERIALIZED"];
      while (k < e.length && modifiers.some((w) => kwIs(e[k], w))) k++;
      if (kwIs(e[k], "VIEW")) {
        const r = readName(e, k + 1);
        warnings.push(`Line ${line}: view ${r.parts.join(".")} skipped. A DDL script does not give the types of a view’s columns; use the catalog query or add the view to the standard.`);
        continue;
      }
      if (!kwIs(e[k], "TABLE")) {
        skip(`CREATE ${(e[k]?.v ?? "").toUpperCase()}`);
        continue;
      }
      k++;
      if (kwIs(e[k], "IF")) k += 3;
      const r = readName(e, k);
      k = r.k;
      const n = resolve(r.parts);
      if (!isP(e[k], "(")) {
        warnings.push(`Line ${line}: ${n.schema}.${n.name} is created from a query (CREATE TABLE … AS SELECT); its columns are not in the DDL. Table skipped.`);
        continue;
      }
      if (tables.has(n.key)) {
        warnings.push(`Line ${line}: ${n.schema}.${n.name} is created twice; the second CREATE TABLE is skipped.`);
        continue;
      }
      const end = matchParen(e, k);
      if (end < 0) {
        warnings.push(`Line ${line}: the parentheses of ${n.schema}.${n.name} do not close. Table skipped.`);
        continue;
      }
      const t: DdlTable = { ...n, cols: [], comment: "" };
      tables.set(n.key, t);
      order.push(t);
      summary.tables++;
      for (const el of splitTop(e, k + 1, end)) {
        if (!el.length) continue;
        if (tableConstraint(el, t)) continue;
        if (el[0]!.t !== "id") continue;
        addColumnTo(t, el, el[0]!.line);
      }
      continue;
    }
    if (kwIs(e[0], "ALTER") && kwIs(e[1], "TABLE")) {
      k = 2;
      if (kwIs(e[k], "IF")) k += 2;
      if (kwIs(e[k], "ONLY")) k++;
      const r = readName(e, k);
      k = r.k;
      if (kwIs(e[k], "WITH")) k += 2;
      if (!kwIs(e[k], "ADD")) {
        skip("other ALTER TABLE statements");
        continue;
      }
      k++;
      const t = findTable(r.parts);
      if (!t) {
        warnings.push(`Line ${line}: ALTER TABLE on ${r.parts.join(".")}, which this script does not create. Skipped.`);
        continue;
      }
      const rest = e.slice(k);
      if (kwIs(rest[0], "DEFAULT")) {
        skip("defaults");
        continue;
      }
      if (kwIs(rest[0], "COLUMN")) rest.shift();
      if (isP(rest[0], "(")) {
        for (const el of splitTop(rest, 1, matchParen(rest, 0))) if (!tableConstraint(el, t) && el[0]?.t === "id") addColumnTo(t, el, line);
        continue;
      }
      if (tableConstraint(rest, t)) continue;
      if (rest[0]?.t === "id") addColumnTo(t, rest, line);
      continue;
    }
    if (kwIs(e[0], "COMMENT") && kwIs(e[1], "ON")) {
      const what = (e[2]?.v ?? "").toUpperCase();
      const r = readName(e, 3);
      const str = e.slice(r.k).find((x) => x.t === "str");
      if (!str) continue;
      if (what === "TABLE") comments.push({ parts: r.parts, col: null, text: str.v });
      else if (what === "COLUMN") {
        const p = [...r.parts];
        const c = p.pop() ?? null;
        comments.push({ parts: p, col: c, text: str.v });
      }
      continue;
    }
    if ((kwIs(e[0], "EXEC") || kwIs(e[0], "EXECUTE")) && e.some((x) => x.t === "id" && /^sp_addextendedproperty$/i.test(x.v))) {
      const named: Record<string, string> = {}, positional: string[] = [];
      for (let j = 0; j < e.length; j++) {
        const tk = e[j]!;
        if (tk.t === "id" && tk.v.startsWith("@") && isP(e[j + 1], "=") && e[j + 2]) {
          named[tk.v.slice(1).toLowerCase()] = e[j + 2]!.v;
          j += 2;
        } else if (tk.t === "str") positional.push(tk.v);
      }
      const a = Object.keys(named).length
        ? named
        : { name: positional[0], value: positional[1], level0name: positional[3], level1name: positional[5], level2type: positional[6], level2name: positional[7] };
      if (String(a.name).toLowerCase() !== "ms_description") {
        skip("other extended properties");
        continue;
      }
      const parts = [a.level0name, a.level1name].filter((x): x is string => !!x);
      comments.push({ parts, col: String(a.level2type ?? "").toUpperCase() === "COLUMN" ? (a.level2name ?? null) : null, text: a.value ?? "" });
      continue;
    }
    const w = (e[0]?.v ?? "").toUpperCase();
    skip(["SET", "GRANT", "REVOKE", "INSERT", "DROP", "PRINT", "DECLARE", "BEGIN", "IF"].includes(w) ? `${w} statements` : "other statements");
  }

  for (const p of pks) {
    for (const c of p.cols) {
      const col = p.table.cols.find((x) => x.name.toLowerCase() === c.toLowerCase());
      if (col) {
        col.pk = true;
        col.nullable = false;
      }
    }
  }
  summary.keys += pks.length;
  for (const f of fks) {
    const target = findTable(f.toParts);
    let toCols = f.toCols;
    // a foreign key without target columns points at the target's primary key (item 16)
    if (!toCols.length && target) toCols = target.cols.filter((c) => c.pk).map((c) => c.name);
    const toSchema = target ? target.schema : resolve(f.toParts).schema, toTable = target ? target.name : (f.toParts.at(-1) ?? "");
    f.cols.forEach((c, i) => {
      const col = f.table.cols.find((x) => x.name.toLowerCase() === c.toLowerCase());
      col?.fkRefs.push({ name: f.name, toSchema, toTable, toCol: toCols[i] ?? "" });
    });
    summary.keys++;
  }
  for (const c of comments) {
    const t = findTable(c.parts);
    if (!t) continue;
    if (!c.col) t.comment = c.text;
    else {
      const col = t.cols.find((x) => x.name.toLowerCase() === c.col!.toLowerCase());
      if (col) col.comment = c.text;
    }
    summary.comments++;
  }

  const rows: (string | number)[][] = [[...STANDARD_FIELDS]];
  for (const t of order) {
    t.cols.forEach((c, i) => {
      const type = c.computed ? "computed" : typeString(c.words, c.args);
      const base = [t.db, t.schema, t.name, "table", "", "", i === 0 ? t.comment : "", c.name, i + 1, type, "", "", "", c.nullable ? "yes" : "no", c.pk ? "yes" : "no"];
      const refs = c.fkRefs.length ? c.fkRefs : [null];
      refs.forEach((f, n) => rows.push([...base, f?.name ?? "", f?.toSchema ?? "", f?.toTable ?? "", f?.toCol ?? "", n === 0 ? c.comment : "", ""]));
    });
  }
  return { standard: toCsv(rows), warnings, summary, databases: [...usedDbs], defaultSchema };
}

/** “Skipped: 2 SET statements, 1 CREATE INDEX” (item 17); empty when nothing was skipped. */
export function skippedText(skipped: Readonly<Record<string, number>>): string {
  const parts = Object.entries(skipped).map(([what, n]) => (what.endsWith("statements") || what.endsWith("clauses") || what.endsWith("properties") || what.endsWith("defaults") ? `${n} ${n === 1 ? singular(what) : what}` : `${n} ${what}`));
  return parts.length ? `Skipped: ${parts.join(", ")}` : "";
}
const singular = (what: string) =>
  what.replace(/statements$/, "statement").replace(/clauses$/, "clause").replace(/properties$/, "property").replace(/^defaults$/, "default");

/** “billing.sql: 2 tables, 13 columns, 3 keys, 2 comments” (item 18). */
export const ddlSummaryText = (name: string, s: DdlSummary): string =>
  `${name}: ${plural(s.tables, "table")}, ${plural(s.columns, "column")}, ${plural(s.keys, "key")}, ${plural(s.comments, "comment")}`;

/**
 * A script read as the DDL channel reads it (prototype `readDDL`): translated, then read as a standard file named
 * “{script} (translated)”, with the translation's warnings first. A script without a table is an error.
 */
export function readDdl(sql: string, opts: DdlOptions = {}): { translation: DdlTranslation; read: StandardRead } {
  const translation = ddlToStandard(sql, opts);
  const fileName = `${opts.fileName?.trim() || "DDL script"} (translated)`;
  if (!translation.summary.tables) {
    const read = readStandard("", fileName);
    return { translation, read: { ...read, errors: ["No CREATE TABLE statement was found in the script."], warnings: translation.warnings } };
  }
  const read = readStandard(translation.standard, fileName, { maxRows: opts.maxRows });
  return { translation, read: { ...read, warnings: [...translation.warnings, ...read.warnings] } };
}
