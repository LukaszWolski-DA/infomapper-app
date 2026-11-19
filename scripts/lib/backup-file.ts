// A local data file read only from a copy of a backup (slice 31, T2, F9; CLAUDE.md: "KB is read only on a copy of a
// backup"): the path must lie under `.data/backups/` and is never `dev-db.json`; the file is copied to a temporary file
// first and only the copy is read, then removed. The rows are upgraded to the current format in memory with the local
// adapter's own upgrade (`upgradeDb`), never written back; a newer or an unknown format is refused.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { upgradeDb } from "../../src/data/local/file";
import { DEV_DB_FORMAT, type DevDb } from "../../src/data/local/schema";
import { uuidv7 } from "../../src/domain/ids";

const NEVER = "Never .data/dev-db.json: give a copy of a backup under .data/backups/.";

/** The file given, refused unless it lies under `<root>/.data/backups/` and is not named `dev-db.json`. */
export function backupPath(given: string | undefined, root = process.cwd()): string {
  if (!given) throw new Error("Give a file under .data/backups/ (a copy of a backup), never .data/dev-db.json.");
  if (path.basename(given).toLowerCase() === "dev-db.json") throw new Error(NEVER);
  const backups = fs.realpathSync(path.join(root, ".data", "backups"));
  const real = fs.realpathSync(path.resolve(root, given));
  const rel = path.relative(backups, real);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("The file must lie under .data/backups/.");
  if (path.basename(real).toLowerCase() === "dev-db.json") throw new Error(NEVER);
  if (!fs.statSync(real).isFile()) throw new Error("The path under .data/backups/ is not a file.");
  return real;
}

export interface UpgradedFile {
  db: DevDb;
  /** The file's format before the upgrade in memory. */
  formatBefore: number;
  /** Per table: the rows the upgrade in memory made (none at format 17). */
  made: Record<string, number>;
}

const counts = (db: object) =>
  Object.fromEntries(Object.entries(db).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as unknown[]).length]));

/** A file's text parsed and upgraded in memory; refused when its format is not one the local adapter reads. */
export function upgradedFrom(text: string, now = new Date().toISOString()): UpgradedFile {
  const db = JSON.parse(text) as DevDb;
  const formatBefore = (db as { format?: unknown }).format;
  if (typeof formatBefore !== "number" || !Number.isInteger(formatBefore) || formatBefore < 2) throw new Error("Not a local data file of a known format: nothing was read.");
  if (formatBefore > DEV_DB_FORMAT) throw new Error(`The file has format ${formatBefore}, newer than this branch's ${DEV_DB_FORMAT}: nothing was read.`);
  const before = counts(db);
  upgradeDb(db, now, () => uuidv7());
  if ((db.format as number) !== DEV_DB_FORMAT) throw new Error(`The file's format ${formatBefore} has no upgrade to ${DEV_DB_FORMAT}: nothing was read.`);
  const made = Object.fromEntries(Object.entries(counts(db)).filter(([k, n]) => n !== (before[k] ?? 0)).map(([k, n]) => [k, n - (before[k] ?? 0)]));
  return { db, formatBefore, made };
}

/** The backup given, read through a temporary copy (removed afterwards), upgraded in memory. */
export function readBackupCopy(given: string | undefined, root = process.cwd()): UpgradedFile {
  const file = backupPath(given, root);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "im-backup-copy-"));
  const copy = path.join(dir, "copy.json");
  try {
    fs.copyFileSync(file, copy);
    return upgradedFrom(fs.readFileSync(copy, "utf8"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
