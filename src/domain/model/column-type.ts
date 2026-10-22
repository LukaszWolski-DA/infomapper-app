// One reader for a source column's physical type (slice 7a, step 1, answer 4): "New source table" and the import read
// types the same way, so a table typed by hand and later imported shows no difference that is not real.
//   `varchar(255)` → length 255 · `nvarchar(max)`, `varchar(-1)` → length MAX_LENGTH (-1, shown as `max`)
//   `decimal(18,2)` → precision 18, scale 2 · one number of a non-text type is its precision: `datetime2(7)`,
//   `float(53)`, `number(10)` · `timestamp(6) with time zone` → `timestamp with time zone`, precision 6
//   `varchar2(100 char)` → length 100 (Oracle's length unit is dropped)
// Base types are stored in lower case with single spaces.

import { formatColumnType, MAX_LENGTH, physicalClass, type ColumnType } from "./type-check";

export type ColumnTypeRead =
  | { ok: true; type: ColumnType }
  /** `unreadable`: not a type and parameters; `zero`: a length or precision of 0; `scale`: scale above precision. */
  | { ok: false; reason: "unreadable" | "zero" | "scale" };

/**
 * One name for types the databases spell differently (prototype `TYPE_ALIAS`): the DDL channel writes these names,
 * and step 3's comparison reads both sides through the same table, so a spelling is never a change.
 */
export const TYPE_ALIASES: Readonly<Record<string, string>> = {
  "character varying": "varchar",
  character: "char",
  int4: "int",
  int8: "bigint",
  int2: "smallint",
  integer: "int",
  "timestamp without time zone": "timestamp",
  "timestamp with time zone": "timestamptz",
  "time without time zone": "time",
  bool: "boolean",
  double: "double precision",
};

/** The type a column has, spelled one way: what the import compares (`varchar(20)` and `VARCHAR(20)` are one type). */
export const columnTypeKey = (c: ColumnType): string => {
  const base = c.data_type.trim().toLowerCase().replace(/\s+/g, " ");
  return formatColumnType({ ...c, data_type: TYPE_ALIASES[base] ?? base });
};

export const sameColumnType = (a: ColumnType, b: ColumnType): boolean => columnTypeKey(a) === columnTypeKey(b);

const WORDS = "[A-Za-z][A-Za-z0-9_]*(?:\\s+[A-Za-z][A-Za-z0-9_]*)*";
const TYPE = new RegExp(`^(${WORDS})\\s*(?:\\(([^()]*)\\))?((?:\\s+[A-Za-z][A-Za-z0-9_]*)*)$`);
/** A number with Oracle's optional length unit, `max`, or SQL Server's -1. */
const ARG = /^(?:(\d+)(?:\s+(?:char|byte))?|(max|-1))$/i;

const words = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

/** Reads `type` or `type(args)` (see the file's comment). */
export function readColumnType(text: string): ColumnTypeRead {
  const match = TYPE.exec(text.trim());
  if (!match) return { ok: false, reason: "unreadable" };
  const [, base, rawArgs, suffix] = match;
  const dataType = words(`${base} ${suffix ?? ""}`);
  const none: ColumnType = { data_type: dataType, type_length: null, type_precision: null, type_scale: null };
  if (rawArgs === undefined) return { ok: true, type: none };
  const args = rawArgs.split(",").map((a) => ARG.exec(a.trim()));
  if (!args.length || args.length > 2 || args.some((a) => !a)) return { ok: false, reason: "unreadable" };
  const [first, second] = args as RegExpExecArray[];
  if (first![2] !== undefined) return second ? { ok: false, reason: "unreadable" } : { ok: true, type: { ...none, type_length: MAX_LENGTH } };
  const a = Number(first![1]);
  if (second) {
    if (second[2] !== undefined) return { ok: false, reason: "unreadable" };
    const b = Number(second[1]);
    if (a === 0) return { ok: false, reason: "zero" };
    if (b > a) return { ok: false, reason: "scale" };
    return { ok: true, type: { ...none, type_precision: a, type_scale: b } };
  }
  if (a === 0) return { ok: false, reason: "zero" };
  return { ok: true, type: physicalClass(dataType) === "text" ? { ...none, type_length: a } : { ...none, type_precision: a } };
}

/**
 * A length, precision or scale given in a column of its own (the import standard's `length`, `precision`, `scale`):
 * a whole number, or `max` / -1 for a length. Null when empty; undefined when it is not one.
 */
export function readTypeParameter(text: string, kind: "length" | "precision" | "scale"): number | null | undefined {
  const v = text.trim();
  if (!v) return null;
  if (kind === "length" && /^(max|-1)$/i.test(v)) return MAX_LENGTH;
  if (!/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return kind !== "scale" && n === 0 ? undefined : n;
}
