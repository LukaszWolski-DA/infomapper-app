// Reading and writing the local JSON file (AD-29). Development only.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEV_DB_FORMAT, type DevDb } from "./schema";

/** Where the file lives: INFOMAPPER_DEV_DB if set (tests), else .data/dev-db.json in the project. */
export function devDbPath(): string {
  // Development only (AD-29): keep the production build from tracing the whole project because of this path.
  return path.resolve(/*turbopackIgnore: true*/ process.env.INFOMAPPER_DEV_DB ?? path.join(process.cwd(), ".data", "dev-db.json"));
}

export class ProductionRefusedError extends Error {
  constructor() {
    super("The local data adapter is for development only and refuses to run with NODE_ENV=production (AD-29).");
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
  if (process.env.NODE_ENV === "production") throw new ProductionRefusedError();
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
  if (db.format !== DEV_DB_FORMAT) {
    throw new Error(`${file} has format ${String(db.format)}, expected ${DEV_DB_FORMAT}. Run "npm run reset-dev-data".`);
  }
  return db;
}

/** Writes the whole file atomically: a temp file next to it, then a rename over the old one. */
export async function writeDb(file: string, db: DevDb): Promise<void> {
  assertNotProduction();
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(db, null, 2) + "\n", "utf8");
  try {
    await withRetry(() => rename(temp, file));
  } catch (e) {
    await rm(temp, { force: true });
    throw e;
  }
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
  await rm(file, { force: true });
}
