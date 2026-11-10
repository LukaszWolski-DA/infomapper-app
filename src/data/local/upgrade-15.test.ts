// The local data file's upgrade from format 14 to 15 (slice 23, F2, F15): every built-in classification without a
// definition gets its definition in its workspace's documentation language, its name kept; own ones and the others get
// `definition` null, and every workspace `naming_conventions` null; no change event and no log line; the file is written
// back at once, and a file at format 15 is read as it is.

import { readFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_TEXTS, type ClassificationCode } from "@/domain/model/classifications";
import { seedDevData } from "./dev-data";
import { readDb } from "./file";
import { DEV_DB_FORMAT, findViolation, type DevDb } from "./schema";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-upgrade15-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

const without = (row: object, columns: readonly string[]) => Object.fromEntries(Object.entries(row).filter(([k]) => !columns.includes(k)));

/**
 * The seeded file as slice 22 wrote it: format 14, classifications without `definition`, workspaces without
 * `naming_conventions`, every built-in name in English (the seed before slice 23 wrote English names everywhere), and
 * one own classification.
 */
async function asFormat14(): Promise<{ db: DevDb; ownId: string; renamedId: string }> {
  const db = await readDb(file);
  const english = (c: DevDb["classification"][number]) => {
    const name = BUILTIN_TEXTS.en[c.code as ClassificationCode].name;
    return { ...c, name, name_key: name.toLowerCase().replace(/[\s_\-/]+/g, "") };
  };
  const first = db.classification[0]!;
  const own = { ...first, id: "01900000-0000-7000-8000-c1000000ff01", code: null, name: "Golden source", name_key: "goldensource", scope: "table" as const, origin: "own" as const };
  const classification = [...db.classification.map(english), own].map((c, i) => (i === 0 ? { ...c, name: "Renamed by hand", name_key: "renamedbyhand" } : c));
  const old: Record<string, unknown> = {
    ...db,
    format: 14,
    classification: classification.map((c) => without(c, ["definition"])),
    workspace: db.workspace.map((w) => without(w, ["naming_conventions"])),
  };
  await writeFile(file, JSON.stringify(old), "utf8");
  return { db, ownId: own.id, renamedId: first.id };
}

describe("the upgrade to format 15 (slice 23, F2, F15)", () => {
  it("gives built-in ones the definition of their workspace's language, keeps every name; own ones none; no change event, no log line", async () => {
    const { db, ownId, renamedId } = await asFormat14();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const upgraded = await readDb(file);
    expect(upgraded.format).toBe(DEV_DB_FORMAT);
    const language = new Map(upgraded.workspace.map((w) => [w.id, w.doc_language]));
    expect(new Set(language.values())).toEqual(new Set(["en", "pl"]));
    for (const c of upgraded.classification) {
      if (c.origin === "own") expect(c.definition).toBeNull();
      else expect(c.definition).toBe(BUILTIN_TEXTS[language.get(c.workspace_id)!][c.code as ClassificationCode].definition);
    }
    // names kept: the Polish workspace keeps its English names, a renamed one its own
    expect(upgraded.classification.find((c) => c.id === renamedId)?.name).toBe("Renamed by hand");
    const polish = upgraded.workspace.find((w) => w.doc_language === "pl")!;
    expect(upgraded.classification.find((c) => c.workspace_id === polish.id && c.code === "BK")).toMatchObject({ name: "Business key", definition: BUILTIN_TEXTS.pl.BK.definition });
    expect(upgraded.classification.find((c) => c.id === ownId)).toMatchObject({ name: "Golden source", definition: null });
    expect(upgraded.workspace.every((w) => w.naming_conventions === null)).toBe(true);
    expect(upgraded.classification).toHaveLength(db.classification.length + 1);
    expect(upgraded.change_event).toEqual(db.change_event);
    expect(log).not.toHaveBeenCalled();
    expect(findViolation(upgraded)).toBeNull();
  });

  it("keeps a definition a built-in one already has", async () => {
    const db = await readDb(file);
    const old: Record<string, unknown> = {
      ...db,
      format: 14,
      classification: db.classification.map((c, i) => (i === 0 ? { ...c, definition: "Mine" } : without(c, ["definition"]))),
      workspace: db.workspace.map((w) => without(w, ["naming_conventions"])),
    };
    await writeFile(file, JSON.stringify(old), "utf8");
    expect((await readDb(file)).classification[0]!.definition).toBe("Mine");
  });

  it("writes the upgraded file back at once", async () => {
    await asFormat14();
    await readDb(file);
    const onDisk = JSON.parse(await readFile(file, "utf8")) as DevDb;
    expect(onDisk.format).toBe(DEV_DB_FORMAT);
    expect(onDisk.classification.every((c) => "definition" in c)).toBe(true);
    expect(onDisk.workspace.every((w) => w.naming_conventions === null)).toBe(true);
  });

  it("is not repeated: a file at format 15 is read as it is", async () => {
    const db = await readDb(file);
    const edited = { ...db, workspace: db.workspace.map((w, i) => (i === 0 ? { ...w, naming_conventions: "Rules" } : w)), classification: db.classification.map((c, i) => (i === 0 ? { ...c, definition: null } : c)) };
    await writeFile(file, JSON.stringify(edited), "utf8");
    const before = await stat(file);
    expect(await readDb(file)).toEqual(edited);
    expect((await stat(file)).mtimeMs).toBe(before.mtimeMs);
  });
});

describe("the seed in its languages (slice 23, F2)", () => {
  it("writes the Polish workspace's built-in ones in Polish and the others in English, with definitions", async () => {
    const db = await readDb(file);
    for (const w of db.workspace) {
      for (const c of db.classification.filter((x) => x.workspace_id === w.id && x.origin !== "own")) {
        expect(c).toMatchObject(BUILTIN_TEXTS[w.doc_language][c.code as ClassificationCode]);
      }
    }
    const polish = db.workspace.find((w) => w.doc_language === "pl")!;
    expect(db.classification.find((c) => c.workspace_id === polish.id && c.code === "BK")?.name).toBe("Klucz biznesowy");
  });
});
