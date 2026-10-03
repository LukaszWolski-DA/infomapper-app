// "New source table": columns typed as lines, one per column, e.g. `cust_id int` or `email varchar(255)`.
// A line is a name and a physical type with optional parameters: `(255)`, `(18,2)` or `(max)`. A trailing comma is
// ignored, so lines can be pasted from a CREATE TABLE statement.

import { domainError, type DomainError } from "../errors";
import { physicalClass } from "./type-check";

export interface ColumnLine {
  name: string;
  /** Lower-case base type, e.g. `varchar`. */
  data_type: string;
  type_length: number | null;
  type_precision: number | null;
  type_scale: number | null;
}

const LINE = /^([A-Za-z_][\w$#]*|"[^"]+"|\[[^\]]+\])\s+([A-Za-z][A-Za-z0-9_]*(?: [A-Za-z][A-Za-z0-9_]*)*)\s*(?:\(\s*(max|\d+)\s*(?:,\s*(\d+)\s*)?\))?$/i;

const unquote = (name: string): string => (/^["[]/.test(name) ? name.slice(1, -1).trim() : name);

export function parseColumnLines(text: string): { ok: true; columns: ColumnLine[] } | { ok: false; error: DomainError } {
  const columns: ColumnLine[] = [];
  const seen = new Set<string>();
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim().replace(/,$/, "").trim();
    if (!line) continue;
    const at = `Line ${i + 1}`;
    const match = LINE.exec(line);
    if (!match) return fail(`${at}: write the column as a name and a type, e.g. email varchar(255).`);
    const [, rawName, rawType, first, second] = match;
    const name = unquote(rawName!);
    if (!name) return fail(`${at}: the column needs a name.`);
    if (seen.has(name.toLowerCase())) return fail(`${at}: there is already a column called ${name}.`);
    seen.add(name.toLowerCase());
    const dataType = rawType!.toLowerCase();
    const params = parameters(dataType, first, second);
    if (params.type_length === 0 || params.type_precision === 0) return fail(`${at}: a length or precision must be at least 1.`);
    if (params.type_scale !== null && params.type_scale > params.type_precision!) {
      return fail(`${at}: the scale cannot be larger than the precision.`);
    }
    columns.push({ name, data_type: dataType, ...params });
  }
  if (!columns.length) return fail("Add at least one column, e.g. cust_id int.");
  return { ok: true, columns };
}

function parameters(dataType: string, first: string | undefined, second: string | undefined): Omit<ColumnLine, "name" | "data_type"> {
  const none = { type_length: null, type_precision: null, type_scale: null };
  if (first === undefined || first.toLowerCase() === "max") return none;
  const a = Number(first);
  if (second !== undefined) return { ...none, type_precision: a, type_scale: Number(second) };
  // One number is a length for text types (varchar(255)) and a precision for anything else (decimal(10), datetime2(7)).
  return physicalClass(dataType) === "text" ? { ...none, type_length: a } : { ...none, type_precision: a };
}

const fail = (message: string): { ok: false; error: DomainError } => ({
  ok: false,
  error: domainError("invalid", message, { columns: message }),
});
