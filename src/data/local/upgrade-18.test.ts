// The local data file's upgrade from format 17 to 18 (slice 33, AD-40): the tables `invitation` and `password_reset`,
// empty; nothing else changes, no change event and no log line; the file is written back at once.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDevData } from "./dev-data";
import { readDb } from "./file";
import { DEV_DB_FORMAT, findViolation, type DevDb } from "./schema";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-upgrade18-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

describe("the upgrade to format 18 (slice 33)", () => {
  it("adds the two people tables, empty, and changes nothing else; no change event, no log line", async () => {
    const db = await readDb(file);
    const old = Object.fromEntries(Object.entries({ ...db, format: 17 }).filter(([k]) => k !== "invitation" && k !== "password_reset"));
    await writeFile(file, JSON.stringify(old), "utf8");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const upgraded = await readDb(file);

    expect(DEV_DB_FORMAT).toBe(18);
    expect(upgraded.format).toBe(18);
    expect(upgraded.invitation).toEqual([]);
    expect(upgraded.password_reset).toEqual([]);
    expect(upgraded).toEqual(db);
    expect(log).not.toHaveBeenCalled();
    expect(findViolation(upgraded)).toBeNull();
    const onDisk = JSON.parse(await readFile(file, "utf8")) as DevDb;
    expect(onDisk.format).toBe(18);
    expect(onDisk.invitation).toEqual([]);
  });

  it("keeps rows a format-17 file already has under those names", async () => {
    const db = await readDb(file);
    expect(db.invitation).toEqual([]);
    const ws = db.workspace[0]!;
    const row = {
      id: "01a1c033-0000-7000-8000-000000000001",
      workspace_id: ws.id,
      email: "new.person@example.com",
      role: "modeler",
      token_hash: "a".repeat(64),
      invited_by: db.app_user[0]!.id,
      created_at: "2026-11-20T10:00:00.000Z",
      expires_at: "2026-11-27T10:00:00.000Z",
      accepted_at: null,
      revoked_at: null,
    };
    await writeFile(file, JSON.stringify({ ...db, format: 17, invitation: [row] }), "utf8");
    expect((await readDb(file)).invitation).toEqual([row]);
  });
});
