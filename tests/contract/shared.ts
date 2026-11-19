// The contract suite's shared pieces (slice 29; shared with the writes since slice 30): the rows both adapters are given,
// every read by name, and a Postgres database on this machine made ready for them.

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { STORE_SCHEMA } from "@/compose/tables";
import type { ModuleTable } from "@/domain/types";
import type { DevDb } from "@/data/local/schema";
import type { DataStore } from "@/data/ports";
import { pgClientConfig } from "@/data/postgres/config";
import { loadRows, spreadCrowded } from "@/data/postgres/load";
import { seedRows } from "../../scripts/lib/seed-rows";

export type Row = Record<string, unknown> & { id?: string; workspace_id?: string; deleted_at?: string | null };
export const AT = new Date("2026-11-16T10:00:00.000Z");
export const LATER = "2026-11-16T11:00:00.000Z";

/** Every table's crowded milliseconds spread as the loader spreads them (slice 30, L8). */
export function spreadAll(db: DevDb): DevDb {
  const out = { ...db } as unknown as Record<string, unknown>;
  for (const [table, rows] of Object.entries(out)) if (Array.isArray(rows)) out[table] = spreadCrowded(table, rows as Row[]);
  return out as unknown as DevDb;
}

/** The seed with the guards' cases (rows changed, two pins added; every foreign key still holds). */
export function contractRows(): DevDb {
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

export const MODULE_TABLES = Object.keys(STORE_SCHEMA.rules).filter((t) => !(t in contractRows())) as ModuleTable[];

/** Every read, keyed by a readable name, for every workspace and person of the rows. */
export async function readEverything(store: DataStore, db: DevDb): Promise<Record<string, unknown>> {
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
    for (const u of users) await all(`undoHistory.state ${ws} ${u.id}`, () => store.undoHistory.state(ws, u.id!));
    await all(`snapshot ${ws}`, () => store.snapshot(ws, MODULE_TABLES));
  }
  await all("snapshot (no such workspace)", () => store.snapshot("01a0f9e9-0000-7000-8000-000000000000", []));
  return out;
}

/** A database on this machine only: the suites empty what they load into, so they can never reach infomapper-dev. */
export function assertLocalDatabase(url: string): void {
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) throw new Error("The contract database must be on this machine: the suite empties it.");
}

/** The migrations applied to an empty database, then the rows loaded (every table emptied first); the loader's report. */
export async function preparePostgres(url: string, db: DevDb) {
  assertLocalDatabase(url);
  const client = new Client(pgClientConfig(url));
  await client.connect();
  try {
    const tables = Number((await client.query<{ n: number }>("select count(*) as n from information_schema.tables where table_schema = 'public'")).rows[0]!.n);
    if (!tables) {
      const dir = path.resolve(__dirname, "../../supabase/migrations");
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await client.query(fs.readFileSync(path.join(dir, f), "utf8"));
    }
    return await loadRows(client, STORE_SCHEMA, db as unknown as Record<string, Row[]>, { reset: true });
  } finally {
    await client.end();
  }
}
