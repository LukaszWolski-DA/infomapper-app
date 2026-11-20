// The contract of the copy of Łukasz's model (slice 31, S31-10, F6): a local data file copied into Postgres one organization at a time
// (`replaceOrganization`, as `npm run pg:kb` does) reads the same on both adapters. Demo data only: never his model.
//
// - The file: the demo and "Performance test" built in memory (`seedRows`), then, through the domain's commands on the
//   local adapter, an import into a new system and a re-import that raises changes to resolve, so `change_event`,
//   `source_import` and `source_change` hold rows (the seed has none of them, and his model has all three: step 1's counts).
//   It is read back as `pg:kb` reads a backup (`upgradedFrom`); its organizations' passwords are left out of the local
//   side, as the copy leaves them out.
// - Postgres: a database of its own on the contract server (`{name}_copy`), the migrations applied, every organization of
//   the file copied in; then every read of `reads.test.ts` compared. Then the copy again (an online change and the
//   organization's undo steps go, another organization's stay, a person's Supabase link stays), `--remove`, the guard of
//   the reset, and the refusals (a person's e-mail taken by another id, a field no column holds, a row of another
//   organization), each leaving the database as it was.
//
// Runs when INFOMAPPER_CONTRACT_DB names a database on this machine (CI's container, the "Schema" workflow).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { STORE_SCHEMA } from "@/compose/tables";
import type { CommandContext, CommandResult, WriteSet } from "@/domain/changes";
import { importSources, importStateOf } from "@/domain/commands/import";
import { planFingerprint } from "@/domain/import/compare";
import { buildPlan } from "@/domain/import/plan";
import { readStandard } from "@/domain/import/standard";
import type { ImportTarget } from "@/domain/import/plan";
import type { DevDb } from "@/data/local/schema";
import { SEED_IDS } from "@/data/local/seed";
import { createLocalDataStore } from "@/data/local/store";
import type { DataStore } from "@/data/ports";
import { pgClientConfig } from "@/data/postgres/config";
import { loadRows, placeAll, readOrganization, replaceOrganization } from "@/data/postgres/load";
import { getPool } from "@/data/postgres/pool";
import { createPostgresDataStore } from "@/data/postgres/store";
import { localFileOf, upgradedFrom } from "../../scripts/lib/backup-file";
import { organizationRows, type Tables } from "../../scripts/lib/organization-rows";
import { resetRefusal } from "../../scripts/lib/seed-organizations";
import { seedRows } from "../../scripts/lib/seed-rows";
import { assertLocalDatabase, AT, contractClock, preparePostgres, readEverything, spreadAll, type Row } from "./shared";

const CONTRACT_DB = process.env.INFOMAPPER_CONTRACT_DB;
const RETAIL = SEED_IDS.wsRetailDwh;
const ANNA = SEED_IDS.userAnna;
const SAMPLE = path.resolve(__dirname, "../../src/domain/import/samples/crm_snapshot_2026-10-20.csv");

const clock = () => contractClock("01a1d000");
const ok = <T>(r: CommandResult<T>): WriteSet => {
  if (!r.ok) throw new Error(r.error.message);
  return r.writeSet;
};

/** An import of the CRM sample into `target`, through the domain, applied by the store. */
async function importInto(store: DataStore, ctx: CommandContext, text: string, label: string, target: ImportTarget) {
  const access = { workspace: (await store.workspaces.get(RETAIL))!, member: await store.workspaces.getMember(RETAIL, ANNA) };
  const read = readStandard(text, label);
  const state = importStateOf(await store.model.load(RETAIL), await store.model.listChanges(RETAIL));
  const scope = read.tables.map((t) => t.key);
  const plan = buildPlan(state.model, read, target, { scope: new Set(scope), compare: "schemas", renames: new Map() });
  const result = await store.apply(
    ok(importSources(ctx, access, state, { target, channel: "file", sourceLabel: label, text, scope, compare: "schemas", renames: [], fingerprint: planFingerprint(plan) })),
  );
  if (!result.ok) throw new Error(result.error.message);
}

/** The demo with an import and a re-import that raises changes, as a local file's text. */
async function demoFileText(dir: string): Promise<string> {
  const file = path.join(dir, "demo-db.json");
  fs.writeFileSync(file, JSON.stringify(seedRows(AT)));
  const store = createLocalDataStore(file, STORE_SCHEMA);
  const ctxOf = clock();
  const first = fs.readFileSync(SAMPLE, "utf8");
  await importInto(store, ctxOf(ANNA), first, "crm.csv", { newName: "CRM copy" });
  const system = (await store.model.load(RETAIL)).sourceSystems.find((s) => s.name === "CRM copy")!;
  // the re-import: one table left out, one column new
  const lines = first.trimEnd().split(/\r?\n/);
  const second = [
    ...lines.filter((l) => !l.includes(",customer_consents,")),
    "crmprod,dbo,customers,table,,184120,,phone_copy,99,varchar(30),,,,yes,no,,,,,,",
  ].join("\n");
  await importInto(store, ctxOf(ANNA), second, "crm-2.csv", { systemId: system.id });
  return fs.readFileSync(file, "utf8");
}

async function copyDatabase(): Promise<string> {
  assertLocalDatabase(CONTRACT_DB!);
  const url = new URL(CONTRACT_DB!);
  const name = `${url.pathname.slice(1)}_copy`;
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error("The contract database's name is not a plain name.");
  const admin = new Client(pgClientConfig(CONTRACT_DB!));
  await admin.connect();
  try {
    if (!(await admin.query("select 1 from pg_database where datname = $1", [name])).rows.length) await admin.query(`create database "${name}"`);
  } finally {
    await admin.end();
  }
  url.pathname = `/${name}`;
  return url.toString();
}

describe.runIf(!!CONTRACT_DB)("the copy on Postgres: one organization at a time, read as the local adapter reads the file (S31-10)", () => {
  let dir: string;
  let file: DevDb;
  let tables: Tables;
  let placed: Tables;
  let localReads: Record<string, unknown>;
  let pgUrl: string;
  let client: Client;
  let store: DataStore;
  const orgs = () => tables.organization!.map((o) => o.id as string);
  const retailOrg = () => tables.workspace!.find((w) => w.id === RETAIL)!.organization_id as string;
  const otherOrg = () => orgs().find((o) => o !== retailOrg())!;
  const workspacesOf = (org: string) => tables.workspace!.filter((w) => w.organization_id === org).map((w) => w.id as string);
  const count = async (sql: string, params: unknown[] = []) => Number((await client.query<{ n: string }>(sql, params)).rows[0]!.n);
  const everything = async () => Number((await client.query<{ n: string }>(
    `select sum(n)::text as n from (select count(*) as n from entity union all select count(*) from change_event union all select count(*) from app_user
       union all select count(*) from organization union all select count(*) from undo_step union all select count(*) from source_change) x`,
  )).rows[0]!.n);
  // as pg:kb copies: the places in the whole file first (T3), then the organization's rows
  const rowsOf = (org: string) => organizationRows(placed, org, STORE_SCHEMA);
  const copy = (org: string, data: Tables | null = rowsOf(org)) => replaceOrganization(client, STORE_SCHEMA, org, data, { placed: true });
  const expectReadsEqual = (pgReads: Record<string, unknown>, only?: (name: string) => boolean) => {
    const names = Object.keys(localReads).filter((n) => !only || only(n));
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect.soft(pgReads[name], name).toEqual(localReads[name]);
  };

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "im-contract-copy-"));
    // the file as pg:kb reads it, crowded milliseconds spread as the loader spreads them (slice 30, L8)
    file = spreadAll(upgradedFrom(await demoFileText(dir)).db);
    tables = file as unknown as Tables;
    placed = placeAll(file as unknown as Record<string, unknown>).tables as Tables;
    // the local side reads the file as the copy leaves it: without the organizations' development passwords
    const localFile = path.join(dir, "copied.json");
    fs.writeFileSync(localFile, JSON.stringify({ ...file, organization_access: [] }));
    localReads = await readEverything(createLocalDataStore(localFile, STORE_SCHEMA), file);

    pgUrl = await copyDatabase();
    await preparePostgres(pgUrl, {} as DevDb);
    client = new Client(pgClientConfig(pgUrl));
    await client.connect();
    for (const org of orgs()) await copy(org);
    process.env.INFOMAPPER_DATABASE_URL = pgUrl;
    store = createPostgresDataStore(STORE_SCHEMA);
  }, 300_000);

  afterAll(async () => {
    if (client) await client.end();
    if (store) await getPool().end();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("the file has imports, changes to resolve and change events to compare", () => {
    for (const t of ["source_import", "source_change", "change_event"]) expect((tables[t] ?? []).length, t).toBeGreaterThan(0);
    expect(tables.source_change!.some((c) => c.kind === "table_left")).toBe(true);
    expect(tables.source_change!.some((c) => c.kind === "new_column")).toBe(true);
  });

  it("gives every read the local adapter's result after the copy, in its order", async () => {
    const pgReads = await readEverything(store, file);
    expect(Object.keys(pgReads).sort()).toEqual(Object.keys(localReads).sort());
    expectReadsEqual(pgReads);
  }, 300_000);

  it("copies again: an online change and the organization's undo steps go, another organization's stay, and a person's link stays", async () => {
    const org = retailOrg();
    const [ws] = workspacesOf(org);
    const [otherWs] = workspacesOf(otherOrg());
    const person = tables.organization_member!.find((m) => m.organization_id === org)!.user_id as string;
    const step = (workspace: string, group: string) =>
      client.query("insert into undo_step (workspace_id, user_id, list, position, change_group_id, label, created_at) values ($1, $2, 'undo', 1, $3, 'Step', now())", [workspace, person, group]);
    await step(ws!, "01a1d0ff-0000-7000-8000-000000000001");
    await step(otherWs!, "01a1d0ff-0000-7000-8000-000000000002");
    await client.query("update project set name = 'Changed online' where workspace_id = $1", [ws]);
    await client.query("update app_user set auth_user_id = '01a1d0ff-0000-7000-8000-0000000000aa' where id = $1", [person]);

    const report = await copy(org);
    expect(report.removed.undo_step).toBe(1);
    expect(report.peopleKept).toBe(report.counts.find((c) => c.table === "app_user")!.given);
    expect(await count("select count(*) as n from undo_step where workspace_id = $1", [ws])).toBe(0);
    expect(await count("select count(*) as n from undo_step where workspace_id = $1", [otherWs])).toBe(1);
    expect(await count("select count(*) as n from project where name = 'Changed online'")).toBe(0);
    expect((await client.query("select auth_user_id from app_user where id = $1", [person])).rows[0]!.auth_user_id).toBe("01a1d0ff-0000-7000-8000-0000000000aa");
    await client.query("delete from undo_step");
    await client.query("update app_user set auth_user_id = null");
    expectReadsEqual(await readEverything(store, file));
  }, 300_000);

  it("removes one organization only, keeping the people; the other reads the same", async () => {
    const org = retailOrg();
    const people = await count("select count(*) as n from app_user");
    const report = await copy(org, null);
    expect(report.removed.organization).toBe(1);
    expect(await count("select count(*) as n from organization where id = $1", [org])).toBe(0);
    expect(await count("select count(*) as n from workspace where organization_id = $1", [org])).toBe(0);
    for (const t of ["entity", "change_event", "source_change", "source_import", "canvas_item"]) {
      expect(await count(`select count(*) as n from ${t} where workspace_id = any($1::uuid[])`, [workspacesOf(org)]), t).toBe(0);
    }
    expect(await count("select count(*) as n from app_user")).toBe(people);
    const others = workspacesOf(otherOrg());
    const pgReads = await readEverything(store, { ...file, workspace: file.workspace.filter((w) => others.includes(w.id)) } as DevDb);
    for (const ws of others) expectReadsEqual(pgReads, (n) => n.includes(ws));
    await copy(org);
  }, 300_000);

  it("guards the reset while an organization the seed does not make is in the database, and changes nothing", async () => {
    expect(await resetRefusal(client)).toBeNull();
    const org = retailOrg();
    const renamed = rowsOf(org);
    const standIn = { ...renamed, organization: renamed.organization!.map((o) => ({ ...o, name: "A stand-in for a copied organization" })) };
    await copy(org, standIn);
    const refusal = await resetRefusal(client);
    expect(refusal).toContain("1 organization the seed does not make");
    expect(refusal).not.toContain("stand-in");
    const before = await everything();
    await expect(loadRows(client, STORE_SCHEMA, seedRows() as unknown as Record<string, Row[]>, { reset: true, resetGuard: (db) => resetRefusal(db) })).rejects.toThrow(
      "the seed does not make",
    );
    expect(await everything()).toBe(before);
    await copy(org);
    expect(await resetRefusal(client)).toBeNull();
  }, 300_000);

  it("refuses a person whose e-mail an online person has under another id, a field no column holds and a row of another organization; nothing changes", async () => {
    const org = retailOrg();
    const rows = rowsOf(org);
    const before = await everything();
    const otherId = { ...rows, app_user: rows.app_user!.map((u, i) => (i === 0 ? { ...u, id: "01a1d0ff-0000-7000-8000-0000000000bb" } : u)) };
    await expect(copy(org, otherId)).rejects.toThrow("1 person of the copy has the e-mail of an online person with another id");
    const stray = { ...rows, entity: rows.entity!.map((e, i) => (i === 0 ? { ...e, stray_field: 1 } : e)) };
    await expect(copy(org, stray)).rejects.toThrow("Fields no column holds, nothing was written: entity.stray_field");
    const foreign = { ...rows, entity: [...rows.entity!, placed.entity!.find((e) => !workspacesOf(org).includes(e.workspace_id as string))!] };
    await expect(copy(org, foreign)).rejects.toThrow("belongs to a workspace not given");
    expect(await everything()).toBe(before);
  }, 300_000);

  it("backs up one organization, and a restore after a change gives the backup's rows and counts; the others and their undo steps stay (C2.1)", async () => {
    const org = retailOrg();
    const [ws] = workspacesOf(org);
    const [otherWs] = workspacesOf(otherOrg());
    const backup = await readOrganization(client, STORE_SCHEMA, org);
    expect(backup.organization_access).toBeUndefined();
    // slice 33 (step 4): a table the code knows but the database lacks yet is left out and named, the rest read as before
    const missing: string[] = [];
    const ahead = { ...STORE_SCHEMA, rules: { ...STORE_SCHEMA.rules, table_of_a_later_migration: { key: ["id"], foreignKeys: {} } } };
    expect(await readOrganization(client, ahead, org, missing)).toEqual(backup);
    expect(missing).toEqual(["table_of_a_later_migration"]);
    expect(backup.app_user!.every((u) => !("auth_user_id" in u))).toBe(true);
    // the backup holds what the copy wrote: the organization's rows of the file, table by table
    const copied = rowsOf(org);
    for (const table of new Set([...Object.keys(copied), ...Object.keys(backup)])) expect(backup[table]?.length ?? 0, table).toBe(copied[table]?.length ?? 0);
    const text = JSON.stringify(localFileOf(backup, STORE_SCHEMA));

    // changes online: a rename, an undo step of each organization
    const person = tables.organization_member!.find((m) => m.organization_id === org)!.user_id as string;
    await client.query("update project set name = 'Changed after the backup' where workspace_id = $1", [ws]);
    for (const [w, g] of [[ws, "01a1d0ff-0000-7000-8000-000000000011"], [otherWs, "01a1d0ff-0000-7000-8000-000000000012"]]) {
      await client.query("insert into undo_step (workspace_id, user_id, list, position, change_group_id, label, created_at) values ($1, $2, 'undo', 1, $3, 'Step', now())", [w, person, g]);
    }
    const otherBefore = await readOrganization(client, STORE_SCHEMA, otherOrg());

    // the restore: pg:restore's path, the backup read as a file
    const restored = placeAll(upgradedFrom(text).db as unknown as Record<string, unknown>).tables as Tables;
    const report = await replaceOrganization(client, STORE_SCHEMA, org, organizationRows(restored, org, STORE_SCHEMA), { placed: true });
    expect(report.removed.undo_step).toBe(1);
    expect(await readOrganization(client, STORE_SCHEMA, org)).toEqual(backup);
    expect(await count("select count(*) as n from undo_step where workspace_id = $1", [ws])).toBe(0);
    expect(await count("select count(*) as n from undo_step where workspace_id = $1", [otherWs])).toBe(1);
    expect(await readOrganization(client, STORE_SCHEMA, otherOrg())).toEqual(otherBefore);
    await client.query("delete from undo_step");
    expectReadsEqual(await readEverything(store, file));
  }, 300_000);

  it("a backup reads the same on both adapters: the local adapter over the backup's file, Postgres after it is copied in again", async () => {
    const org = retailOrg();
    const backup = upgradedFrom(JSON.stringify(localFileOf(await readOrganization(client, STORE_SCHEMA, org), STORE_SCHEMA))).db;
    const backupFile = path.join(dir, "backup.json");
    fs.writeFileSync(backupFile, JSON.stringify(backup));
    const local = await readEverything(createLocalDataStore(backupFile, STORE_SCHEMA), backup);
    await replaceOrganization(client, STORE_SCHEMA, org, organizationRows(placeAll(backup as unknown as Record<string, unknown>).tables as Tables, org, STORE_SCHEMA), { placed: true });
    const pg = await readEverything(store, backup);
    const mine = workspacesOf(org);
    const names = Object.keys(local).filter((n) => mine.some((w) => n.includes(w)));
    expect(names.length).toBeGreaterThan(50);
    for (const name of names) expect.soft(pg[name], name).toEqual(local[name]);
  }, 300_000);
});
