// What every adapter knows about the tables (slice 29, F1): the schema the composition root makes (`src/compose/tables.ts`)
// and the two row rules that run on what a store reads, a module's column defaults and its row upgrades. The local
// adapter (`./local/schema.ts`, which re-exports these under their old names) and the Postgres adapter (`./postgres/`)
// both run them, so no rule is copied.

/** A stored row as a plain record. */
export type AnyRow = Record<string, unknown>;

export interface TableRules {
  key: readonly string[];
  /** column -> referenced table (always its `id`). Null values are allowed where the column is nullable. */
  foreignKeys: Readonly<Record<string, string>>;
  /**
   * Unique indexes besides the key; `live` = only rows with deleted_at null, `where` = a further condition
   * (partial indexes such as "where entity_id is not null and deleted_at is null"), `lower` = columns compared in lower
   * case (an index on `lower(column)`).
   */
  unique?: readonly { columns: readonly string[]; live?: boolean; where?: (row: AnyRow) => boolean; lower?: readonly string[] }[];
  checks?: readonly { name: string; test: (row: AnyRow) => boolean }[];
  /**
   * A module's columns added after its table had rows (slice 18, Q2: InfoCube's lookup columns): a row without one reads
   * it as this value. A module's tables are not part of the file's format (AD-33), so no upgrade writes them.
   */
  defaults?: Readonly<Record<string, unknown>>;
  /**
   * A module's row stored in an older shape (slice 19, F1: InfoCube's `scd_type` became `history`): the row as it reads
   * now, or null when it is current. Pure and idempotent; the adapter runs it on every row of the table when the data is
   * read, before any read or check (`upgradeRows`). A module's tables are not part of the file's format (AD-33): this is
   * how a module changes its own rows' shape.
   */
  upgrade?: (row: AnyRow) => AnyRow | null;
}

/**
 * The tables a store knows (slice 15a, AD-33): InfoMapper's rules and the registered modules', and the tables undo
 * reads. Made once by `localSchema` (`./local/schema.ts`); `src/compose/tables.ts` makes the application's.
 */
export interface StoreSchema {
  readonly rules: Readonly<Record<string, TableRules>>;
  readonly tables: readonly string[];
  /** The tables `loadForUndo` reads: InfoMapper's undoable ones and the modules'. */
  readonly undoable: readonly string[];
}

/**
 * The rows of a table as plain records, for the generic rules below and the adapters. A module's table may be absent
 * (no rows yet): read as empty.
 */
export const rowsOf = (db: object, table: string): AnyRow[] => ((db as Record<string, AnyRow[] | undefined>)[table] ?? []);

const upgraded = new WeakMap<object, WeakMap<StoreSchema, object>>();

/**
 * The rows as the store reads them (slice 19, F1): every module table with an `upgrade` gets its older rows in the
 * current shape. The same object when nothing needs it; otherwise a copy with only those tables new, frozen like the
 * cached file, and remembered per object and schema, so a cached read is upgraded once.
 */
export function upgradeRows<D extends object>(db: Readonly<D>, schema: StoreSchema): Readonly<D> {
  const seen = upgraded.get(db)?.get(schema);
  if (seen) return seen as Readonly<D>;
  let out: D | null = null;
  for (const [table, rules] of Object.entries(schema.rules)) {
    if (!rules.upgrade) continue;
    const rows = rowsOf(db, table);
    let changed: AnyRow[] | null = null;
    rows.forEach((r, i) => {
      const next = rules.upgrade!(r);
      if (!next) return;
      changed ??= [...rows];
      changed[i] = Object.freeze(next);
    });
    if (!changed) continue;
    out ??= { ...(db as D) };
    (out as unknown as Record<string, unknown>)[table] = Object.freeze(changed);
  }
  const result = out ? (Object.freeze(out) as Readonly<D>) : db;
  let bySchema = upgraded.get(db);
  if (!bySchema) upgraded.set(db, (bySchema = new WeakMap()));
  bySchema.set(schema, result);
  return result;
}

/** The rows as a command reads them: a module's columns a row lacks take their defaults (`TableRules.defaults`). */
export function readRows(db: object, table: string, schema: StoreSchema): AnyRow[] {
  const rows = rowsOf(db, table);
  const defaults = schema.rules[table]?.defaults;
  if (!defaults) return rows;
  const keys = Object.keys(defaults);
  return rows.map((r) => (keys.every((k) => k in r) ? r : { ...defaults, ...r }));
}
