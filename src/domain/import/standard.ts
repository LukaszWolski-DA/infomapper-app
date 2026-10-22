// InfoMapper's source standard, v1 (slice 7a, PRD items 7–13; prototype `readStandard`): one row per column, columns
// named as in STANDARD_FIELDS in any order (aliases allowed, other columns ignored). Reading never writes anything; the
// result feeds the review (step 3's plan) and the server reads the same text again (P8).
//   Errors stop the import: an empty file, a missing required column, no usable rows, too many rows.
//   Warnings do not: a row without names (skipped), a column without a type (skipped), a column twice (second row
//   skipped), a classification other than Business key and PII (P11: listed, not read).
// `fields` is the set of standard columns the file has: a field the file leaves out is never compared or overwritten
// (P2). Types are read by `readColumnType`, as "New source table" reads them.

import { readColumnType, readTypeParameter } from "../model/column-type";
import type { ColumnType } from "../model/type-check";
import { parseDelimited, toCsv, type Delimiter } from "./delimited";

export const STANDARD_FIELDS = [
  "database",
  "schema",
  "table",
  "object_type",
  "file_format",
  "row_count",
  "table_comment",
  "column",
  "ordinal",
  "data_type",
  "length",
  "precision",
  "scale",
  "nullable",
  "primary_key",
  "fk_name",
  "fk_ref_schema",
  "fk_ref_table",
  "fk_ref_column",
  "column_comment",
  "classifications",
] as const;
export type StandardField = (typeof STANDARD_FIELDS)[number];

export const REQUIRED_FIELDS = ["database", "schema", "table", "column", "data_type"] as const satisfies readonly StandardField[];

/** Other names a file may use for a standard column (compared after lower case, spaces and hyphens to `_`). */
const ALIASES: Record<string, StandardField> = {
  database_name: "database",
  db: "database",
  schema_name: "schema",
  table_name: "table",
  object: "table",
  column_name: "column",
  type: "data_type",
  datatype: "data_type",
  is_nullable: "nullable",
  pk: "primary_key",
  is_primary_key: "primary_key",
  position: "ordinal",
  ordinal_position: "ordinal",
  comment: "column_comment",
  tags: "classifications",
};

/** `template.csv` (prototype `stepSource`): the header row, a database table's column and a flat file's column. */
export const STANDARD_TEMPLATE = toCsv([
  STANDARD_FIELDS,
  ["crmprod", "dbo", "customers", "table", "", "184120", "Customer master", "cust_no", "2", "varchar(20)", "", "", "", "no", "no", "", "", "", "", "Customer number", "BK"],
  ["flat_files", "ref_data", "country_codes", "file", "xlsx", "", "Country list kept by Finance", "iso_code", "1", "string(2)", "", "", "", "no", "yes", "", "", "", "", "ISO 3166 alpha-2", "BK"],
]);

/** Column rows one import takes (PRD item 12; the limit is set after step 2's figures, answer 13). */
export const MAX_IMPORT_ROWS = 100_000;

export type StandardObjectType = "table" | "view" | "file";

export interface StandardColumn extends ColumnType {
  name: string;
  ordinal: number;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  comment: string | null;
  /** P11: only these two are read in 7a. */
  is_business_key: boolean;
  is_pii: boolean;
  /** The classifications read, as the file names them (for the review's "The file says …"). */
  classifications: string[];
  /** The file's line of the column's first row. */
  line: number;
}

export interface StandardForeignKey {
  name: string;
  toSchema: string;
  toTable: string;
  /** Column pairs in the file's order: this table's column → the target's column (empty when not given). */
  pairs: { from: string; to: string }[];
}

export interface StandardTable {
  /** `database|schema|table` in lower case: tables are matched ignoring case. */
  key: string;
  database: string;
  schema: string;
  name: string;
  objectType: StandardObjectType;
  fileFormat: string | null;
  rowCount: number | null;
  comment: string | null;
  /** In the file's order. */
  columns: StandardColumn[];
  foreignKeys: StandardForeignKey[];
}

export interface StandardRead {
  fileName: string;
  errors: string[];
  warnings: string[];
  /** In the order they first appear. */
  tables: StandardTable[];
  /** Columns read (rows skipped and second rows of a foreign key not counted). */
  columnCount: number;
  delimiter: Delimiter;
  /** The standard's columns the file has (P2). */
  fields: ReadonlySet<StandardField>;
}

export const tableKey = (database: string, schema: string, table: string): string => `${database}|${schema}|${table}`.toLowerCase();

const YES = /^(yes|y|true|1|t)$/i;
const count = (n: number) => n.toLocaleString("en-GB");
const normalise = (s: string) => s.toLowerCase().replace(/[\s_\-/]+/g, "");

/** Business key and PII by code or name (P11); undefined for any other classification. */
function classification(name: string): "bk" | "pii" | undefined {
  const k = normalise(name);
  if (k === "bk" || k === "businesskey") return "bk";
  if (k === "pii" || k === "personaldata") return "pii";
  return undefined;
}

export const NOT_READ_YET = (name: string, table: string) =>
  `Classification “${name}” on ${table} is not read yet: only Business key and PII are read for now.`;

export function readStandard(text: string, fileName: string): StandardRead {
  const out: StandardRead = { fileName, errors: [], warnings: [], tables: [], columnCount: 0, delimiter: ",", fields: new Set() };
  const body = text.replace(/^﻿/, "");
  if (!body.trim()) {
    out.errors.push("The file is empty.");
    return out;
  }
  const { rows, delimiter } = parseDelimited(body);
  out.delimiter = delimiter;
  const header = rows[0]!.cells.map((h) => {
    const k = h.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/[\s-]+/g, "_");
    return (ALIASES[k] ?? k) as StandardField;
  });
  const missing = REQUIRED_FIELDS.filter((f) => !header.includes(f));
  if (missing.length) {
    const names = missing.map((f) => `“${f}”`).join(", ");
    out.errors.push(`The file has no ${names} column${missing.length > 1 ? "s" : ""}. Name the columns as in the standard below.`);
    return out;
  }
  const dataRows = rows.length - 1;
  if (dataRows > MAX_IMPORT_ROWS) {
    out.errors.push(`The file has ${count(dataRows)} rows; one import takes up to ${count(MAX_IMPORT_ROWS)}. Split it by database or schema.`);
    return out;
  }
  const index = new Map<StandardField, number>();
  header.forEach((h, i) => {
    if ((STANDARD_FIELDS as readonly string[]).includes(h) && !index.has(h)) index.set(h, i);
  });
  out.fields = new Set(index.keys());
  const byKey = new Map<string, StandardTable>();
  const notRead = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const { cells, line } = rows[r]!;
    const get = (f: StandardField) => {
      const i = index.get(f);
      const v = i === undefined ? "" : (cells[i] ?? "").trim();
      return /^null$/i.test(v) ? "" : v; // SSMS copies empty cells as NULL
    };
    const database = get("database"), schema = get("schema"), table = get("table"), column = get("column"), type = get("data_type");
    if (!database || !schema || !table || !column) {
      out.warnings.push(`Row ${line}: database, schema, table and column are required. Row skipped.`);
      continue;
    }
    const key = tableKey(database, schema, table);
    let t = byKey.get(key);
    if (!t) {
      const objectType = get("object_type").toLowerCase();
      const fileFormat = get("file_format").toLowerCase().replace(/^\./, "");
      t = {
        key,
        database,
        schema,
        name: table,
        objectType: objectType === "view" ? "view" : objectType === "file" || fileFormat ? "file" : "table",
        fileFormat: fileFormat || null,
        rowCount: null,
        comment: null,
        columns: [],
        foreignKeys: [],
      };
      byKey.set(key, t);
      out.tables.push(t);
    }
    // table level: the first non-empty value counts (item 7)
    if (t.rowCount === null) {
      const rc = get("row_count").replace(/\s/g, "");
      if (/^\d+$/.test(rc)) t.rowCount = Number(rc);
    }
    if (t.comment === null && get("table_comment")) t.comment = get("table_comment");

    const existing = t.columns.find((c) => c.name.toLowerCase() === column.toLowerCase());
    const fkName = get("fk_name");
    if (fkName) {
      let fk = t.foreignKeys.find((f) => f.name.toLowerCase() === fkName.toLowerCase());
      if (!fk) {
        fk = { name: fkName, toSchema: get("fk_ref_schema") || schema, toTable: get("fk_ref_table"), pairs: [] };
        t.foreignKeys.push(fk);
      }
      const to = get("fk_ref_column");
      if (!fk.pairs.some((p) => p.from.toLowerCase() === column.toLowerCase() && p.to.toLowerCase() === to.toLowerCase())) fk.pairs.push({ from: column, to });
    }
    if (existing) {
      // a column in two foreign keys has two rows: the second adds to its keys (item 8)
      if (fkName) existing.is_foreign_key = true;
      else out.warnings.push(`Row ${line}: ${schema}.${table}.${column} appears twice. Second row skipped.`);
      continue;
    }
    if (!type) {
      out.warnings.push(`Row ${line}: ${schema}.${table}.${column} has no data_type. Column skipped.`);
      continue;
    }

    const read = readColumnType(type);
    const columnType: ColumnType = read.ok ? read.type : { data_type: type.toLowerCase().replace(/\s+/g, " "), type_length: null, type_precision: null, type_scale: null };
    if (columnType.type_length === null && columnType.type_precision === null) {
      const length = readTypeParameter(get("length"), "length");
      const precision = readTypeParameter(get("precision"), "precision");
      const scale = readTypeParameter(get("scale"), "scale");
      if (length) columnType.type_length = length;
      if (precision) {
        columnType.type_precision = precision;
        if (typeof scale === "number" && scale <= precision) columnType.type_scale = scale;
      } else if (scale === 0) columnType.type_scale = 0; // Oracle's INTEGER: number with scale 0 and no precision
    }

    const classifications: string[] = [];
    let isBusinessKey = false, isPii = false;
    for (const name of get("classifications").split(/[;|]/).map((s) => s.trim()).filter(Boolean)) {
      const c = classification(name);
      if (c === "bk") isBusinessKey = true;
      else if (c === "pii") isPii = true;
      else {
        const seen = `${key}|${normalise(name)}`;
        if (!notRead.has(seen)) out.warnings.push(NOT_READ_YET(name, `${schema}.${table}`));
        notRead.add(seen);
        continue;
      }
      if (!classifications.includes(name)) classifications.push(name);
    }

    const ordinal = get("ordinal");
    const isPrimaryKey = YES.test(get("primary_key"));
    const nullable = get("nullable");
    t.columns.push({
      name: column,
      ordinal: /^\d+$/.test(ordinal) ? Number(ordinal) : t.columns.length + 1,
      ...columnType,
      is_nullable: nullable === "" ? !isPrimaryKey : YES.test(nullable),
      is_primary_key: isPrimaryKey,
      is_foreign_key: !!fkName,
      comment: get("column_comment") || null,
      is_business_key: isBusinessKey,
      is_pii: isPii,
      classifications,
      line,
    });
    out.columnCount++;
  }
  // a table whose every row was skipped is not in the file
  out.tables = out.tables.filter((t) => t.columns.length > 0);
  if (!out.tables.length) out.errors.push("The file has no usable rows.");
  return out;
}
