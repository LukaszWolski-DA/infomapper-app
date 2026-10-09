// AD-31 safeguard: the tables the domain describes must match the tables the SQL migrations create, column by column
// (name, type, nullability). Both sides are reduced to the same shape here; `compareSchemas` lists every mismatch.

/** What a column holds, as far as both sides can say. TypeScript's `number` covers integer, smallint and numeric. */
export type ColumnKind = "uuid" | "timestamptz" | "text" | "number" | "boolean" | "jsonb";

export interface ColumnShape {
  name: string;
  kind: ColumnKind;
  nullable: boolean;
}

export interface TableShape {
  table: string;
  columns: ColumnShape[];
}

/** Postgres `information_schema.columns.data_type` → kind. Anything else is reported as unsupported. */
const PG_KINDS: Record<string, ColumnKind> = {
  uuid: "uuid",
  "timestamp with time zone": "timestamptz",
  text: "text",
  integer: "number",
  smallint: "number",
  bigint: "number",
  numeric: "number",
  boolean: "boolean",
  jsonb: "jsonb",
};

export function pgKind(dataType: string): ColumnKind | null {
  return PG_KINDS[dataType] ?? null;
}

/** One row of `information_schema.columns`. */
export interface PgColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
}

/** Groups `information_schema.columns` rows into tables. Unsupported types are returned separately. */
export function tablesFromPg(rows: readonly PgColumnRow[]): { tables: TableShape[]; unsupported: string[] } {
  const byTable = new Map<string, ColumnShape[]>();
  const unsupported: string[] = [];
  for (const r of rows) {
    const kind = pgKind(r.data_type);
    if (!kind) {
      unsupported.push(`${r.table_name}.${r.column_name}: type "${r.data_type}" is not one the domain can describe`);
      continue;
    }
    const columns = byTable.get(r.table_name) ?? [];
    columns.push({ name: r.column_name, kind, nullable: r.is_nullable === "YES" });
    byTable.set(r.table_name, columns);
  }
  return { tables: [...byTable].map(([table, columns]) => ({ table, columns })), unsupported };
}

/**
 * Every mismatch between the domain's tables and the database's, as readable lines; empty when they match.
 * `notInDomainYet` lists the tables the migrations already create but no slice has built yet (frames, notes, …);
 * they are skipped, and listing one that the domain now describes, or that the database lacks, is a mismatch too,
 * so the list cannot go stale.
 */
export function compareSchemas(domain: readonly TableShape[], database: readonly TableShape[], notInDomainYet: readonly string[]): string[] {
  const out: string[] = [];
  const dbTables = new Map(database.map((t) => [t.table, t]));
  const domainTables = new Map(domain.map((t) => [t.table, t]));
  const pending = new Set(notInDomainYet);

  for (const t of domain) {
    if (pending.has(t.table)) out.push(`${t.table}: the domain describes it now; take it off the "not in the domain yet" list`);
    const db = dbTables.get(t.table);
    if (!db) {
      out.push(`${t.table}: in the domain, but no migration creates it`);
      continue;
    }
    const dbColumns = new Map(db.columns.map((c) => [c.name, c]));
    for (const c of t.columns) {
      const d = dbColumns.get(c.name);
      if (!d) out.push(`${t.table}.${c.name}: in the domain, missing in the database`);
      else {
        if (d.kind !== c.kind) out.push(`${t.table}.${c.name}: the domain says ${c.kind}, the database ${d.kind}`);
        if (d.nullable !== c.nullable) {
          out.push(`${t.table}.${c.name}: the domain says ${c.nullable ? "nullable" : "not null"}, the database ${d.nullable ? "nullable" : "not null"}`);
        }
      }
    }
    const domainColumns = new Set(t.columns.map((c) => c.name));
    for (const d of db.columns) if (!domainColumns.has(d.name)) out.push(`${t.table}.${d.name}: in the database, missing in the domain`);
  }

  for (const db of database) {
    if (!domainTables.has(db.table) && !pending.has(db.table)) {
      out.push(`${db.table}: created by a migration, but neither in the domain nor on the "not in the domain yet" list`);
    }
  }
  for (const table of notInDomainYet) {
    if (!dbTables.has(table)) out.push(`${table}: on the "not in the domain yet" list, but no migration creates it`);
  }
  return out;
}

/** Tables the migrations create that no slice has built yet; each comes off this list in the slice that builds it. */
export const NOT_IN_DOMAIN_YET = [
  "invitation",
  "requirement",
  "requirement_link",
  "label",
  "label_link",
  "project_pinned_label",
  "note",
  "baseline",
] as const;
