// Synthetic import files for slice 7a's figures (PRD section 6; step 1, answer 13): a standard file and a DDL script
// of a given number of tables with 10 columns each, the same on every run (a fixed seed). Not stored anywhere; the
// bench scripts make them in memory. Every table has a primary key, a business key, a comment on its first column,
// a foreign key to the table before it, and a mix of the types the catalog queries return.

import { toCsv } from "../../src/domain/import/delimited";
import { STANDARD_FIELDS } from "../../src/domain/import/standard";

const COLUMNS_PER_TABLE = 10;

/** A small deterministic random sequence (mulberry32). */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPES: readonly [type: string, length: string, precision: string, scale: string][] = [
  ["varchar", "50", "", ""],
  ["nvarchar", "200", "", ""],
  ["nvarchar", "max", "", ""],
  ["char", "3", "", ""],
  ["int", "", "", ""],
  ["bigint", "", "", ""],
  ["decimal", "", "18", "2"],
  ["date", "", "", ""],
  ["datetime2", "", "", ""],
  ["bit", "", "", ""],
];

export interface SyntheticTable {
  schema: string;
  name: string;
  columns: { name: string; type: string; length: string; precision: string; scale: string; pk: boolean }[];
}

/** `tables` tables in 20 schemas of database `synth`, 10 columns each. */
export function syntheticTables(tables: number, seed = 7): SyntheticTable[] {
  const next = random(seed);
  return Array.from({ length: tables }, (_, t) => ({
    schema: `s${String(t % 20).padStart(2, "0")}`,
    name: `table_${String(t).padStart(5, "0")}`,
    columns: Array.from({ length: COLUMNS_PER_TABLE }, (_, c) => {
      const [type, length, precision, scale] = c === 0 ? TYPES[5]! : c === 1 ? TYPES[0]! : TYPES[Math.floor(next() * TYPES.length)]!;
      return { name: c === 0 ? "id" : c === 1 ? "code" : c === 2 ? "parent_id" : `col_${c}_${Math.floor(next() * 1000)}`, type: c === 2 ? "bigint" : type, length: c === 2 ? "" : length, precision: c === 2 ? "" : precision, scale: c === 2 ? "" : scale, pk: c === 0 };
    }),
  }));
}

/** What a re-import's file does to a column (section 6: 5 % changed, renamed or missing). */
export type Mutation = "keep" | "change" | "rename" | "drop";

/**
 * The share of columns a re-import changes (2 %), renames (1.5 %) and drops (1.5 %): columns 3–9 of a table, picked
 * by the column's place in the whole file, so the same columns every run.
 */
export function fivePercent(table: number, column: number): Mutation {
  if (column < 3) return "keep";
  const n = (table * 7 + (column - 3)) % 140; // 7 such columns per table
  return n < 4 ? "change" : n < 7 ? "rename" : n < 10 ? "drop" : "keep";
}

/** The standard as the SQL Server catalog query gives it (length, precision and scale in their own columns). */
export function syntheticStandard(tables: number, seed?: number, mutate: (table: number, column: number) => Mutation = () => "keep"): string {
  const all = syntheticTables(tables, seed);
  const rows: (string | number)[][] = [[...STANDARD_FIELDS]];
  all.forEach((t, i) => {
    const parent = i > 0 ? all[i - 1]! : null;
    t.columns.forEach((c, n) => {
      const m = mutate(i, n);
      if (m === "drop") return;
      const fk = n === 2 && parent ? [`FK_${t.name}_${parent.name}`, parent.schema, parent.name, "id"] : ["", "", "", ""];
      const name = m === "rename" ? `${c.name}_renamed` : c.name;
      // a changed column gets a type of another class (a varchar becomes an int, anything else a varchar(60))
      const [type, length, precision, scale] = m === "change" ? (c.type === "varchar" ? ["int", "", "", ""] : ["varchar", "60", "", ""]) : [c.type, c.length, c.precision, c.scale];
      rows.push([
        "synth", t.schema, t.name, "table", "", 1000 + i, n === 0 ? `Synthetic table ${i}` : "", name, n + 1, type, length, precision, scale,
        c.pk ? "no" : "yes", c.pk ? "yes" : "no", ...fk, n === 0 ? "The key" : "", n === 1 ? "BK" : "",
      ]);
    });
  });
  return toCsv(rows);
}

/** The same tables as a SQL Server script (SSMS style: brackets, GO, constraints, an index, extended properties). */
export function syntheticDdl(tables: number, seed?: number): string {
  const all = syntheticTables(tables, seed);
  const out: string[] = ["USE [synth]", "GO", "SET ANSI_NULLS ON", "GO"];
  all.forEach((t, i) => {
    const cols = t.columns.map((c) => {
      const params = c.length ? `(${c.length})` : c.precision ? `(${c.precision}, ${c.scale})` : "";
      return `\t[${c.name}] [${c.type}]${params} ${c.pk ? "NOT NULL" : "NULL"},`;
    });
    out.push(`CREATE TABLE [${t.schema}].[${t.name}](`, ...cols, ` CONSTRAINT [PK_${t.name}] PRIMARY KEY CLUSTERED ([id] ASC)`, ") ON [PRIMARY]", "GO");
    out.push(`CREATE NONCLUSTERED INDEX [IX_${t.name}_code] ON [${t.schema}].[${t.name}] ([code] ASC)`, "GO");
    if (i > 0) {
      const p = all[i - 1]!;
      out.push(`ALTER TABLE [${t.schema}].[${t.name}] WITH CHECK ADD CONSTRAINT [FK_${t.name}_${p.name}] FOREIGN KEY([parent_id]) REFERENCES [${p.schema}].[${p.name}] ([id])`, "GO");
    }
    out.push(
      `EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Synthetic table ${i}' , @level0type=N'SCHEMA',@level0name=N'${t.schema}', @level1type=N'TABLE',@level1name=N'${t.name}'`,
      "GO",
    );
  });
  return out.join("\n");
}
