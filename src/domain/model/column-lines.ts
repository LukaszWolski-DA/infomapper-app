// "New source table": columns typed as lines, one per column, e.g. `cust_id int` or `email varchar(255)`.
// A line is a name and a physical type with optional parameters: `(255)`, `(18,2)` or `(max)`. A trailing comma is
// ignored, so lines can be pasted from a CREATE TABLE statement. The type is read as the import reads it
// (`readColumnType`, slice 7a): `(max)` is stored as MAX_LENGTH and shown as `(max)`.

import { domainError, type DomainError } from "../errors";
import { readColumnType } from "./column-type";

export interface ColumnLine {
  name: string;
  /** Lower-case base type, e.g. `varchar`. */
  data_type: string;
  type_length: number | null;
  type_precision: number | null;
  type_scale: number | null;
}

const LINE = /^([A-Za-z_][\w$#]*|"[^"]+"|\[[^\]]+\])\s+(\S.*)$/;

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
    const [, rawName, rawType] = match;
    const name = unquote(rawName!);
    if (!name) return fail(`${at}: the column needs a name.`);
    const type = readColumnType(rawType!);
    if (!type.ok) {
      if (type.reason === "zero") return fail(`${at}: a length or precision must be at least 1.`);
      if (type.reason === "scale") return fail(`${at}: the scale cannot be larger than the precision.`);
      return fail(`${at}: write the column as a name and a type, e.g. email varchar(255).`);
    }
    if (seen.has(name.toLowerCase())) return fail(`${at}: there is already a column called ${name}.`);
    seen.add(name.toLowerCase());
    columns.push({ name, ...type.type });
  }
  if (!columns.length) return fail("Add at least one column, e.g. cust_id int.");
  return { ok: true, columns };
}

const fail = (message: string): { ok: false; error: DomainError } => ({
  ok: false,
  error: domainError("invalid", message, { columns: message }),
});
