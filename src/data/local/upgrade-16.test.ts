// The local data file's upgrade from format 15 to 16 (slice 24, F18, F19): every workspace gets its five built-in
// stereotypes with the English names and the definitions in its documentation language; an entity's code outside the
// five becomes an own stereotype named by its code, with one log line; no change event; the file is written back at
// once, and a file at format 16 is read as it is.

import { readFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_STEREOTYPE_CODES, BUILTIN_STEREOTYPE_TEXTS, type BuiltinStereotypeCode } from "@/domain/model/stereotypes";
import { seedDevData } from "./dev-data";
import { readDb } from "./file";
import { DEV_DB_FORMAT, findViolation, type DevDb } from "./schema";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-upgrade16-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

/** The seeded file as slice 23 wrote it: format 15, no stereotype table. `edit` changes its entities first. */
async function asFormat15(edit: (db: DevDb) => void = () => {}): Promise<DevDb> {
  const db = await readDb(file);
  edit(db);
  const old: Record<string, unknown> = { ...db, format: 15 };
  delete old.stereotype;
  await writeFile(file, JSON.stringify(old), "utf8");
  return db;
}

describe("the upgrade to format 16 (slice 24, F18, F19)", () => {
  it("gives every workspace the five built-in rows: English names, definitions in its language; no change event, no log line", async () => {
    const db = await asFormat15();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const upgraded = await readDb(file);
    expect(upgraded.format).toBe(DEV_DB_FORMAT);
    expect(upgraded.stereotype).toHaveLength(db.workspace.length * 5);
    for (const w of upgraded.workspace) {
      const rows = upgraded.stereotype.filter((s) => s.workspace_id === w.id);
      expect(rows.map((s) => s.code)).toEqual([...BUILTIN_STEREOTYPE_CODES]);
      for (const s of rows) {
        const code = s.code as BuiltinStereotypeCode;
        expect(s).toMatchObject({ origin: "builtin", name: BUILTIN_STEREOTYPE_TEXTS.en[code].name, definition: BUILTIN_STEREOTYPE_TEXTS[w.doc_language][code].definition, created_by: w.created_by, version: 1, deleted_at: null });
      }
    }
    // the Polish workspace keeps English names (decision 7) with Polish definitions
    const polish = upgraded.workspace.find((w) => w.doc_language === "pl")!;
    expect(upgraded.stereotype.find((s) => s.workspace_id === polish.id && s.code === "link")).toMatchObject({ name: "Link", definition: BUILTIN_STEREOTYPE_TEXTS.pl.link.definition });
    expect(upgraded.change_event).toEqual(db.change_event);
    expect(upgraded.entity).toEqual(db.entity);
    expect(log).not.toHaveBeenCalled();
    expect(findViolation(upgraded)).toBeNull();
  });

  it("makes an own stereotype for any other code an entity has, with one log line naming no code", async () => {
    const db = await asFormat15((d) => {
      d.entity[0]!.stereotype = "hub";
      d.entity[1]!.stereotype = "hub";
      d.entity[2]!.stereotype = "satellite";
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const upgraded = await readDb(file);
    const own = upgraded.stereotype.filter((s) => s.origin === "own");
    expect(own.map((s) => [s.workspace_id, s.code, s.name, s.definition])).toEqual([
      [db.entity[0]!.workspace_id, "hub", "hub", null],
      [db.entity[2]!.workspace_id, "satellite", "satellite", null],
    ]);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("Slice 24 upgrade: 2 entity stereotype codes outside the five built-in ones became own stereotypes.");
    expect(findViolation(upgraded)).toBeNull();
  });

  it("writes the upgraded file back at once", async () => {
    await asFormat15();
    await readDb(file);
    const onDisk = JSON.parse(await readFile(file, "utf8")) as DevDb;
    expect(onDisk.format).toBe(DEV_DB_FORMAT);
    expect(onDisk.stereotype.length).toBeGreaterThan(0);
  });

  it("is not repeated: a file at format 16 is read as it is", async () => {
    const db = await readDb(file);
    const edited = { ...db, stereotype: db.stereotype.map((s, i) => (i === 0 ? { ...s, name: "Thing", name_key: "thing" } : s)) };
    await writeFile(file, JSON.stringify(edited), "utf8");
    const before = await stat(file);
    expect(await readDb(file)).toEqual(edited);
    expect((await stat(file)).mtimeMs).toBe(before.mtimeMs);
  });
});

describe("the seed in its languages (slice 24)", () => {
  it("writes the Polish workspace's stereotypes in Polish and the others in English, with stable ids", async () => {
    const db = await readDb(file);
    for (const w of db.workspace) {
      for (const s of db.stereotype.filter((x) => x.workspace_id === w.id)) expect(s).toMatchObject(BUILTIN_STEREOTYPE_TEXTS[w.doc_language][s.code as BuiltinStereotypeCode]);
    }
    const polish = db.workspace.find((w) => w.doc_language === "pl")!;
    expect(db.stereotype.find((s) => s.workspace_id === polish.id && s.code === "object")?.name).toBe("Obiekt");
    const again = path.join(dir, "again.json");
    await seedDevData(again);
    expect((await readDb(again)).stereotype.map((s) => s.id)).toEqual(db.stereotype.map((s) => s.id));
  });
});

describe("the local adapter's rules on stereotypes (F3)", () => {
  it("refuses a deleted built-in row, a second row with a code (deleted ones too), and a bad code", async () => {
    const db = await readDb(file);
    const object = db.stereotype.find((s) => s.code === "object")!;
    expect(findViolation({ ...db, stereotype: db.stereotype.map((s) => (s.id === object.id ? { ...s, deleted_at: object.created_at } : s)) })).toMatchObject({ kind: "check", table: "stereotype", detail: expect.stringContaining("stereotype_builtin_kept_ck") });
    const gone = { ...object, id: "01900000-0000-7000-8000-5000000000f1", name: "Gone", name_key: "gone", origin: "own" as const, deleted_at: object.created_at };
    expect(findViolation({ ...db, stereotype: [...db.stereotype, gone] })).toMatchObject({ kind: "unique", table: "stereotype" });
    expect(findViolation({ ...db, stereotype: [...db.stereotype, { ...gone, code: "Gone" }] })).toMatchObject({ kind: "check", detail: expect.stringContaining("stereotype_code_format_ck") });
  });
});
