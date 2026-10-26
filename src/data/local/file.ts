// Reading and writing the local JSON file (AD-29). Development only.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { uuidv7 } from "@/domain/ids";
import { deriveSourceChanges } from "@/domain/source-changes/derive";
import type { ChangeEvent } from "@/domain/types";
import { isLocalModeAllowed } from "./measure-mode";
import { DEV_DB_FORMAT, type DevDb } from "./schema";

/** Where the file lives: INFOMAPPER_DEV_DB if set (tests), else .data/dev-db.json in the project. */
export function devDbPath(): string {
  // Development only (AD-29): keep the production build from tracing the whole project because of this path.
  return path.resolve(/*turbopackIgnore: true*/ process.env.INFOMAPPER_DEV_DB ?? path.join(process.cwd(), ".data", "dev-db.json"));
}

export class ProductionRefusedError extends Error {
  constructor() {
    super(
      "The local data adapter is for development only and refuses to run with NODE_ENV=production (AD-29), except in the measurement-only build started with INFOMAPPER_MEASURE=1 (AD-31).",
    );
    this.name = "ProductionRefusedError";
  }
}

export class NoDevDataError extends Error {
  constructor(file: string) {
    super(`No local data at ${file}. Run "npm run seed" first.`);
    this.name = "NoDevDataError";
  }
}

export function assertNotProduction(): void {
  if (!isLocalModeAllowed()) throw new ProductionRefusedError();
}

export async function readDb(file: string): Promise<DevDb> {
  assertNotProduction();
  let text: string;
  try {
    text = await withRetry(() => readFile(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new NoDevDataError(file);
    throw e;
  }
  const db = JSON.parse(text) as DevDb;
  const was = db.format as number;
  upgradeDb(db, new Date().toISOString(), () => uuidv7());
  if (db.format !== DEV_DB_FORMAT) {
    throw new Error(`${file} has format ${String(db.format)}, expected ${DEV_DB_FORMAT}. Run "npm run reset-dev-data".`);
  }
  // the derived changes get their ids once (slice 7b): written back at once, so every later read sees the same rows
  if (was >= 2 && was < 7) await writeDb(file, db);
  return db;
}

/**
 * Upgrades an older file in place. Formats 2 (before frames), 3 (before labels and notes) and 4 (before requirements)
 * differ only by the missing tables; 5 (before source imports) and 6 (before changes to resolve) also by the new columns,
 * null (false, 0) on every row. From 6, the open changes slice 7a's imports leave are derived (slice 7b, P2, F1): one
 * change group per workspace, each event signed by the person who ran the import; no undo step.
 */
export function upgradeDb(db: DevDb, now: string, newId: () => string): void {
  if ((db.format as number) === 2) Object.assign(db, { format: 3, frame: [] });
  if ((db.format as number) === 3) Object.assign(db, { format: 4, label: [], label_link: [], project_pinned_label: [], note: [] });
  if ((db.format as number) === 4) Object.assign(db, { format: 5, requirement: [], requirement_link: [] });
  if ((db.format as number) === 5) {
    Object.assign(db, { format: 6, source_relationship: [], source_relationship_column: [], source_import: [] });
    for (const t of db.source_table) Object.assign(t, { file_format: t.file_format ?? null, missing_since: t.missing_since ?? null });
    for (const c of db.source_column) c.missing_since ??= null;
    for (const m of db.mapping) m.review_reason ??= null;
  }
  if ((db.format as number) === 6) {
    for (const t of db.source_table) t.retired_since ??= null;
    for (const c of db.source_column) Object.assign(c, { retired_since: c.retired_since ?? null, not_needed: c.not_needed ?? false });
    for (const i of db.source_import) Object.assign(i, { changes_raised: i.changes_raised ?? 0, changes_high: i.changes_high ?? 0 });
    const derived = deriveSourceChanges(
      {
        systems: db.source_system,
        tables: db.source_table,
        columns: db.source_column,
        imports: db.source_import,
        mappings: db.mapping,
        mappingInputs: db.mapping_input,
        attributes: db.attribute,
        entities: db.entity,
        events: db.change_event,
      },
      newId,
    );
    const groups = new Map<string, string>();
    const events: ChangeEvent[] = derived.map((c) => ({
      id: newId(),
      workspace_id: c.workspace_id,
      change_group_id: groups.get(c.workspace_id) ?? groups.set(c.workspace_id, newId()).get(c.workspace_id)!,
      occurred_at: now,
      user_id: c.created_by,
      object_type: "source_change",
      object_id: c.id,
      operation: "create",
      before_image: null,
      after_image: structuredClone(c) as unknown as ChangeEvent["after_image"],
      context_label_id: null,
    }));
    Object.assign(db, { format: DEV_DB_FORMAT, source_change: derived, change_event: [...db.change_event, ...events] });
  }
}


// The last read of each file, kept until the file changes on disk (S1A-14: reading and parsing the whole file on
// every repository call took about half of the canvas page's server time). Frozen, so a caller cannot change it.
type Stamp = { mtimeMs: number; size: number; ino: number };
const cache = new Map<string, { stamp: Stamp; db: Readonly<DevDb> }>();

async function stampOf(file: string): Promise<Stamp | null> {
  try {
    const s = await withRetry(() => stat(file));
    return { mtimeMs: s.mtimeMs, size: s.size, ino: s.ino };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

const sameStamp = (a: Stamp, b: Stamp) => a.mtimeMs === b.mtimeMs && a.size === b.size && a.ino === b.ino;

/**
 * Like readDb, but re-reads the file only when it has changed since the last read (another process, such as the
 * seed scripts or the e2e reset, may write it). The result is shared and deeply frozen: clone it before changing it.
 */
export async function readDbCached(file: string): Promise<Readonly<DevDb>> {
  assertNotProduction();
  const stamp = await stampOf(file);
  if (!stamp) {
    cache.delete(file);
    throw new NoDevDataError(file);
  }
  const hit = cache.get(file);
  if (hit && sameStamp(hit.stamp, stamp)) return hit.db;
  const db = deepFreeze(await readDb(file));
  // Keep it only if the file did not change while it was read.
  const after = await stampOf(file);
  if (after && sameStamp(after, stamp)) cache.set(file, { stamp, db });
  else cache.delete(file);
  return db;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/** Writes the whole file atomically: a temp file next to it, then a rename over the old one. */
export async function writeDb(file: string, db: DevDb): Promise<void> {
  assertNotProduction();
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  // compact (slice 7a): after large imports the file is many MB, and indenting doubled its size and its writing time
  await writeFile(temp, JSON.stringify(db) + "\n", "utf8");
  try {
    await withRetry(() => rename(temp, file));
  } catch (e) {
    await rm(temp, { force: true });
    throw e;
  }
  // The file now holds what this process wrote: keep it, so the next read does not parse it again (slice 7a: after a
  // large import the file is tens of MB). Frozen, as every cached read; the caller hands over `db`.
  const stamp = await stampOf(file);
  if (stamp) cache.set(file, { stamp, db: deepFreeze(db) });
  else cache.delete(file);
}

// On Windows a rename or read can fail briefly while another process has the file open.
async function withRetry<T>(op: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await op();
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (attempt >= 10 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) throw e;
      await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
    }
  }
}

export async function removeDb(file: string): Promise<void> {
  assertNotProduction();
  cache.delete(file);
  await rm(file, { force: true });
}
