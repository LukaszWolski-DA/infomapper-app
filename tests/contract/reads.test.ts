// The contract of the reads (slice 29, Q8, S29-02): every read of the 14 repositories and `snapshot`, on the same rows,
// gives the same result on both adapters, in the same order (F2 condition 3), and Postgres refuses every write (S29-03).
//
// The rows: the demo and "Performance test" built in memory (`scripts/lib/seed-rows.ts`), with cases added for the
// guards: a deleted original with live copies (lost originals), a deleted entity that label and requirement links point
// to, a deleted canvas with notes and project links, a pin of a deleted label.
//
// The local adapter always runs (in `npm test`), checked against the rows themselves. Postgres runs when
// INFOMAPPER_CONTRACT_DB names an empty database on this machine (CI's container, the "Schema" workflow): the suite applies
// the migrations, loads the rows and compares every read with the local adapter's. It refuses any other host: it empties
// the database it loads into, so it can never reach infomapper-dev.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { STORE_SCHEMA } from "@/compose/tables";
import { READ_ONLY_SERVER_MESSAGE } from "@/domain/errors";
import type { ModuleTable } from "@/domain/types";
import type { DevDb } from "@/data/local/schema";
import { createLocalDataStore } from "@/data/local/store";
import type { DataStore } from "@/data/ports";
import { pgClientConfig } from "@/data/postgres/config";
import { loadRows, stampPlaces } from "@/data/postgres/load";
import { getPool } from "@/data/postgres/pool";
import { createPostgresDataStore } from "@/data/postgres/store";
import { seedRows } from "../../scripts/lib/seed-rows";

type Row = Record<string, unknown> & { id?: string; workspace_id?: string; deleted_at?: string | null };
const AT = new Date("2026-11-16T10:00:00.000Z");
const LATER = "2026-11-16T11:00:00.000Z";

/** The seed with the guards' cases (rows changed, two pins added; every foreign key still holds). */
function contractRows(): DevDb {
  const db = seedRows(AT);
  const rows = db as unknown as Record<string, Row[]>;
  const del = (r: Row | undefined) => {
    if (!r) throw new Error("A contract case found no row.");
    r.deleted_at = LATER;
  };
  // lost originals: an original deleted while a live copy points to it
  const copy = rows.attribute!.find((a) => a.copied_from_attribute_id && a.deleted_at === null);
  del(rows.attribute!.find((a) => a.id === copy?.copied_from_attribute_id));
  // the link guards: a deleted entity that a label link and a requirement link still point to
  const labelled = rows.label_link!.find((k) => k.entity_id && k.deleted_at === null && rows.requirement_link!.some((r) => r.entity_id === k.entity_id && r.deleted_at === null));
  del(rows.entity!.find((e) => e.id === labelled?.entity_id));
  // a deleted canvas with notes and project links
  const noted = rows.note!.find((n) => n.deleted_at === null && rows.project_canvas!.some((l) => l.canvas_id === n.canvas_id));
  del(rows.canvas!.find((c) => c.id === noted?.canvas_id));
  // pins (the seed has none): one of a live label, one of a label then deleted
  const [kept, gone] = rows.label!.filter((l) => l.deleted_at === null && rows.project!.some((p) => p.workspace_id === l.workspace_id && p.deleted_at === null));
  for (const l of [kept, gone]) {
    const project = rows.project!.find((p) => p.workspace_id === l!.workspace_id && p.deleted_at === null)!;
    rows.project_pinned_label!.push({ project_id: project.id, label_id: l!.id, workspace_id: l!.workspace_id });
  }
  del(gone);
  return db;
}

const MODULE_TABLES = Object.keys(STORE_SCHEMA.rules).filter((t) => !(t in contractRows())) as ModuleTable[];

/** Every read, keyed by a readable name, for every workspace and person of the rows. */
async function readEverything(store: DataStore, db: DevDb): Promise<Record<string, unknown>> {
  const rows = db as unknown as Record<string, Row[]>;
  const out: Record<string, unknown> = {};
  const users = rows.app_user!;
  const orgs = rows.organization!;
  const all = async (name: string, read: () => Promise<unknown>) => (out[name] = await read());
  await all("users.list", () => store.users.list());
  for (const u of users) {
    await all(`users.get ${u.id}`, () => store.users.get(u.id!));
    await all(`users.getByEmail ${u.id}`, () => store.users.getByEmail(u.email as string));
    await all(`organizations.listForUser ${u.id}`, () => store.organizations.listForUser(u.id!));
    await all(`workspaces.listForUser ${u.id}`, () => store.workspaces.listForUser(u.id!));
  }
  await all("organizations.listMembershipsOfUsers", () => store.organizations.listMembershipsOfUsers(users.map((u) => u.id!)));
  for (const o of orgs) {
    await all(`organizations.get ${o.id}`, () => store.organizations.get(o.id!));
    await all(`organizations.getAccess ${o.id}`, () => store.organizations.getAccess(o.id!));
    await all(`organizations.listLicences ${o.id}`, () => store.organizations.listLicences(o.id!));
    for (const u of users) await all(`organizations.getMember ${o.id} ${u.id}`, () => store.organizations.getMember(o.id!, u.id!));
  }
  for (const w of rows.workspace!) {
    const ws = w.id!;
    const of = (t: string) => rows[t]!.filter((r) => r.workspace_id === ws);
    await all(`users.listForWorkspace ${ws}`, () => store.users.listForWorkspace(ws));
    await all(`workspaces.get ${ws}`, () => store.workspaces.get(ws));
    await all(`workspaces.listMembers ${ws}`, () => store.workspaces.listMembers(ws));
    for (const u of users) await all(`workspaces.getMember ${ws} ${u.id}`, () => store.workspaces.getMember(ws, u.id!));
    for (const t of MODULE_TABLES) await all(`modules.list ${ws} ${t}`, () => store.modules.list(ws, t));
    await all(`projects.list ${ws}`, () => store.projects.list(ws));
    for (const p of of("project")) {
      await all(`projects.get ${ws} ${p.id}`, () => store.projects.get(ws, p.id!));
      await all(`canvases.listLinksOfProject ${ws} ${p.id}`, () => store.canvases.listLinksOfProject(ws, p.id!));
    }
    await all(`canvases.list ${ws}`, () => store.canvases.list(ws));
    for (const c of of("canvas")) {
      await all(`canvases.get ${ws} ${c.id}`, () => store.canvases.get(ws, c.id!));
      await all(`canvases.listLinksOfCanvas ${ws} ${c.id}`, () => store.canvases.listLinksOfCanvas(ws, c.id!));
      await all(`canvasItems.listOfCanvas ${ws} ${c.id}`, () => store.canvasItems.listOfCanvas(ws, c.id!));
      await all(`frames.listOfCanvas ${ws} ${c.id}`, () => store.frames.listOfCanvas(ws, c.id!));
      await all(`notes.listOfCanvas ${ws} ${c.id}`, () => store.notes.listOfCanvas(ws, c.id!));
    }
    await all(`model.load ${ws}`, () => store.model.load(ws));
    await all(`model.loadForUndo ${ws}`, () => store.model.loadForUndo(ws));
    await all(`model.listImports ${ws}`, () => store.model.listImports(ws));
    for (const s of of("source_system")) await all(`model.listImports ${ws} ${s.id}`, () => store.model.listImports(ws, s.id!));
    await all(`model.listChanges ${ws}`, () => store.model.listChanges(ws));
    await all(`canvasItems.list ${ws}`, () => store.canvasItems.list(ws));
    for (const i of of("canvas_item").slice(0, 3)) await all(`canvasItems.get ${ws} ${i.id}`, () => store.canvasItems.get(ws, i.id!));
    await all(`frames.list ${ws}`, () => store.frames.list(ws));
    await all(`labels.list ${ws}`, () => store.labels.list(ws));
    for (const l of of("label")) await all(`labels.get ${ws} ${l.id}`, () => store.labels.get(ws, l.id!));
    await all(`labels.listLinks ${ws}`, () => store.labels.listLinks(ws));
    for (const k of of("label_link").slice(0, 5)) await all(`labels.getLink ${ws} ${k.id}`, () => store.labels.getLink(ws, k.id!));
    await all(`labels.listPins ${ws}`, () => store.labels.listPins(ws));
    await all(`notes.list ${ws}`, () => store.notes.list(ws));
    for (const n of of("note").slice(0, 3)) await all(`notes.get ${ws} ${n.id}`, () => store.notes.get(ws, n.id!));
    await all(`requirements.list ${ws}`, () => store.requirements.list(ws));
    for (const r of of("requirement").slice(0, 3)) {
      await all(`requirements.get ${ws} ${r.id}`, () => store.requirements.get(ws, r.id!));
      await all(`changeEvents.listForRequirement ${ws} ${r.id}`, () => store.changeEvents.listForRequirement(ws, r.id!));
    }
    await all(`requirements.listLinks ${ws}`, () => store.requirements.listLinks(ws));
    for (const k of of("requirement_link").slice(0, 5)) await all(`requirements.getLink ${ws} ${k.id}`, () => store.requirements.getLink(ws, k.id!));
    await all(`changeEvents.list ${ws}`, () => store.changeEvents.list(ws));
    for (const m of of("mapping").slice(0, 3)) await all(`changeEvents.listForMapping ${ws} ${m.id}`, () => store.changeEvents.listForMapping(ws, m.id!));
    for (const u of users) await all(`undoHistory.get ${ws} ${u.id}`, () => store.undoHistory.get(ws, u.id!));
    await all(`snapshot ${ws}`, () => store.snapshot(ws, MODULE_TABLES));
  }
  await all("snapshot (no such workspace)", () => store.snapshot("01a0f9e9-0000-7000-8000-000000000000", []));
  return out;
}

let db: DevDb;
let localReads: Record<string, unknown>;
let tmp: string;

beforeAll(async () => {
  db = contractRows();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "im-contract-"));
  const file = path.join(tmp, "contract-db.json");
  fs.writeFileSync(file, JSON.stringify(db));
  localReads = await readEverything(createLocalDataStore(file, STORE_SCHEMA), db);
}, 120_000);

afterAll(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

describe("the reads on the local adapter, against the rows themselves", () => {
  const rowsOf = (t: string) => (db as unknown as Record<string, Row[]>)[t]!;
  const liveIn = (t: string, ws: string) => rowsOf(t).filter((r) => r.workspace_id === ws && r.deleted_at === null);

  it("lists without a sort of their own in the stored order: the file's", () => {
    for (const w of rowsOf("workspace")) {
      const ws = w.id!;
      expect(localReads[`projects.list ${ws}`]).toEqual(liveIn("project", ws));
      expect(localReads[`canvasItems.list ${ws}`]).toEqual(liveIn("canvas_item", ws));
      expect(localReads[`requirements.list ${ws}`]).toEqual(liveIn("requirement", ws));
      expect(localReads[`changeEvents.list ${ws}`]).toEqual(rowsOf("change_event").filter((e) => e.workspace_id === ws));
    }
  });

  it("keeps the guards: no link to a deleted element, no note on a deleted canvas, no pin of a deleted label", () => {
    const deleted = (t: string) => new Set(rowsOf(t).filter((r) => r.deleted_at !== null).map((r) => r.id));
    const deletedEntities = deleted("entity");
    const deletedCanvases = deleted("canvas");
    const deletedLabels = deleted("label");
    expect([deletedEntities.size, deletedCanvases.size, deletedLabels.size].every((n) => n > 0)).toBe(true);
    expect(rowsOf("workspace").some((w) => (localReads[`labels.listPins ${w.id}`] as Row[]).length > 0)).toBe(true);
    for (const w of rowsOf("workspace")) {
      const ws = w.id!;
      for (const k of localReads[`labels.listLinks ${ws}`] as Row[]) expect(deletedEntities.has(k.entity_id as string)).toBe(false);
      for (const k of localReads[`requirements.listLinks ${ws}`] as Row[]) expect(deletedEntities.has(k.entity_id as string)).toBe(false);
      for (const n of localReads[`notes.list ${ws}`] as Row[]) expect(deletedCanvases.has(n.canvas_id as string)).toBe(false);
      for (const p of localReads[`labels.listPins ${ws}`] as Row[]) expect(deletedLabels.has(p.label_id as string)).toBe(false);
    }
  });

  it("names the lost original in model.load", () => {
    const lost = rowsOf("workspace").flatMap((w) => (localReads[`model.load ${w.id}`] as { lostOriginals: unknown[] }).lostOriginals);
    expect(lost.length).toBeGreaterThan(0);
  });
});

const CONTRACT_DB = process.env.INFOMAPPER_CONTRACT_DB;

describe.runIf(!!CONTRACT_DB)("the reads on Postgres: the same as the local adapter's (S29-02)", () => {
  let pgReads: Record<string, unknown>;
  let crowded: Record<string, number> = {};
  let store: DataStore;

  beforeAll(async () => {
    const url = new URL(CONTRACT_DB!);
    if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) throw new Error("INFOMAPPER_CONTRACT_DB must be a database on this machine: the suite empties it.");
    const client = new Client(pgClientConfig(CONTRACT_DB!));
    await client.connect();
    try {
      const tables = Number((await client.query<{ n: number }>("select count(*) as n from information_schema.tables where table_schema = 'public'")).rows[0]!.n);
      if (!tables) {
        const dir = path.resolve(__dirname, "../../supabase/migrations");
        for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await client.query(fs.readFileSync(path.join(dir, f), "utf8"));
      }
      crowded = (await loadRows(client, STORE_SCHEMA, db as unknown as Record<string, Row[]>, { reset: true })).crowded;
    } finally {
      await client.end();
    }
    process.env.INFOMAPPER_DATABASE_URL = CONTRACT_DB;
    store = createPostgresDataStore(STORE_SCHEMA);
    pgReads = await readEverything(store, db);
  }, 300_000);

  afterAll(async () => {
    // only when the pool was made (a failed load never makes it)
    if (store) await getPool().end();
  });

  it("gives every read the local adapter's result, in its order", () => {
    expect(Object.keys(pgReads).sort()).toEqual(Object.keys(localReads).sort());
    for (const name of Object.keys(localReads)) {
      if (name.startsWith("model.loadForUndo")) continue;
      expect(pgReads[name], name).toEqual(localReads[name]);
    }
  });

  it("gives loadForUndo the local adapter's rows; in its order except a crowded millisecond's rows past the 999th", () => {
    const byKey = (rows: Row[]) => [...rows].sort((a, b) => String(a.id ?? JSON.stringify(a)).localeCompare(String(b.id ?? JSON.stringify(b))));
    for (const name of Object.keys(localReads).filter((n) => n.startsWith("model.loadForUndo"))) {
      const local = localReads[name] as Record<string, Row[]>;
      const pg = pgReads[name] as Record<string, Row[]>;
      expect(Object.keys(pg).sort(), name).toEqual(Object.keys(local).sort());
      for (const table of Object.keys(local)) {
        if (crowded[table]) expect(byKey(pg[table]!), `${name} ${table}`).toEqual(byKey(local[table]!));
        else expect(pg[table], `${name} ${table}`).toEqual(local[table]);
      }
    }
  });

  it("refuses every write with the read-only error (S29-03)", async () => {
    const result = await store.apply({ changeGroupId: "x", writes: [], events: [] } as never);
    expect(result).toEqual({ ok: false, error: { code: "archived", message: READ_ONLY_SERVER_MESSAGE } });
  });
});

describe("the loader's places (F2)", () => {
  it("stamps each row's place in its millisecond as microseconds, and never more than 999", () => {
    const rows = Array.from({ length: 1002 }, (_, i) => ({ id: String(i), created_at: "2026-11-16T10:00:00.123Z" }));
    const { rows: stamped, crowded } = stampPlaces("concept", rows);
    expect(stamped[0]!.created_at).toBe("2026-11-16T10:00:00.123000Z");
    expect(stamped[45]!.created_at).toBe("2026-11-16T10:00:00.123045Z");
    expect(stamped[999]!.created_at).toBe("2026-11-16T10:00:00.123999Z");
    expect(stamped[1001]!.created_at).toBe("2026-11-16T10:00:00.123999Z");
    expect(crowded).toBe(3);
    expect(rows[0]!.created_at).toBe("2026-11-16T10:00:00.123Z");
  });
  it("uses each table's own time column, and none for project_pinned_label", () => {
    expect(stampPlaces("change_event", [{ id: "a", occurred_at: "2026-11-16T10:00:00.000Z" }]).rows[0]!.occurred_at).toBe("2026-11-16T10:00:00.000000Z");
    expect(stampPlaces("project_canvas", [{ added_at: "2026-11-16T10:00:00.000Z" }]).rows[0]!.added_at).toBe("2026-11-16T10:00:00.000000Z");
    expect(stampPlaces("project_pinned_label", [{ project_id: "p", label_id: "l" }]).rows).toEqual([{ project_id: "p", label_id: "l" }]);
  });
});
