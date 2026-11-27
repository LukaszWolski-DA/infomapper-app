// The catalog index's contract (slice 39, A1.2 guardrail 1, C1, S39-02, S39-06): `catalog.readable` and `catalog.read`
// give the same answers on both adapters, with the rights checked inside the adapter.
//
// The rows: the contract's seed with InfoMate holding the `infocatalog` licence, Bank X (archived) shown in InfoCatalog,
// and two more InfoMate workspaces with Łukasz alone as their owner, one shown and one not. The readers: Łukasz (a role
// everywhere), Anna and Piotr (members without a role in some), Kasia (a guest in InfoMate, a member of Retail Co, which
// holds no licence) and Marek (Retail Co only).
//
// The local adapter always runs (in `npm test`). Postgres runs when INFOMAPPER_CONTRACT_DB names a database on this
// machine (CI's container): the suite uses a database of its own beside it (`{name}_catalog`), made when missing.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CATALOG_TABLES } from "@/compose/catalog";
import { STORE_SCHEMA } from "@/compose/tables";
import { SEED_IDS } from "@/data/local/seed";
import type { DevDb } from "@/data/local/schema";
import { createLocalDataStore } from "@/data/local/store";
import type { DataStore } from "@/data/ports";
import { pgClientConfig } from "@/data/postgres/config";
import { getPool } from "@/data/postgres/pool";
import { createPostgresDataStore } from "@/data/postgres/store";
import type { CatalogScope } from "@/domain/catalog/read";
import type { Workspace, WorkspaceMember } from "@/domain/types";
import { assertLocalDatabase, AT, contractRows, preparePostgres, spreadAll } from "./shared";

const SHOWN = "01a0f9e9-2039-7a10-8c11-000000000001";
const HIDDEN = "01a0f9e9-2039-7a10-8c11-000000000002";
const READERS = { lukasz: SEED_IDS.userLukasz, anna: SEED_IDS.userAnna, piotr: SEED_IDS.userPiotr, kasia: SEED_IDS.userKasia, marek: SEED_IDS.userMarek } as const;
const ALL_UNLOCKED = new Set([SEED_IDS.orgInfoMate, SEED_IDS.orgRetailCo]);

function catalogRows(): DevDb {
  const db = contractRows();
  const at = AT.toISOString();
  const by = SEED_IDS.userLukasz;
  db.organization_licence.push({ id: "01a0f9e9-2039-7a10-8c11-000000000010", version: 1, created_at: at, created_by: by, updated_at: at, updated_by: by, deleted_at: null, organization_id: SEED_IDS.orgInfoMate, module: "infocatalog" });
  db.workspace = db.workspace.map((w) => (w.id === SEED_IDS.wsBankX ? { ...w, catalog_shown: true } : w));
  const retail = db.workspace.find((w) => w.id === SEED_IDS.wsRetailDwh)!;
  const workspace = (id: string, name: string, shown: boolean): Workspace => ({ ...retail, id, name, catalog_shown: shown, infocube: false, infodoc: false, archived_at: null, archived_by: null, version: 1, created_at: at, updated_at: at });
  db.workspace.push(workspace(SHOWN, "Catalog – shown", true), workspace(HIDDEN, "Catalog – hidden", false));
  const owner = (workspaceId: string): WorkspaceMember => ({ workspace_id: workspaceId, user_id: by, role: "owner", added_by: null, created_at: at });
  db.workspace_member.push(owner(SHOWN), owner(HIDDEN));
  return spreadAll(db);
}

/** Every catalog read the cases make, by name. */
async function catalogReads(store: DataStore): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const scopes: Record<string, CatalogScope> = {
    "InfoMate": { organizationId: SEED_IDS.orgInfoMate, workspaceId: null },
    "Retail Co": { organizationId: SEED_IDS.orgRetailCo, workspaceId: null },
    "Retail – DWH": { organizationId: SEED_IDS.orgInfoMate, workspaceId: SEED_IDS.wsRetailDwh },
    "Bank X": { organizationId: SEED_IDS.orgInfoMate, workspaceId: SEED_IDS.wsBankX },
    "shown": { organizationId: SEED_IDS.orgInfoMate, workspaceId: SHOWN },
    "hidden": { organizationId: SEED_IDS.orgInfoMate, workspaceId: HIDDEN },
    "Sales analytics": { organizationId: SEED_IDS.orgRetailCo, workspaceId: SEED_IDS.wsSales },
  };
  for (const [reader, userId] of Object.entries(READERS)) {
    out[`readable ${reader}`] = await store.catalog.readable(userId, ALL_UNLOCKED);
    for (const [name, scope] of Object.entries(scopes)) out[`read ${reader} ${name}`] = await store.catalog.read(userId, ALL_UNLOCKED, scope, CATALOG_TABLES);
  }
  out["readable lukasz, InfoMate locked"] = await store.catalog.readable(READERS.lukasz, new Set([SEED_IDS.orgRetailCo]));
  out["read lukasz InfoMate, InfoMate locked"] = await store.catalog.read(READERS.lukasz, new Set([SEED_IDS.orgRetailCo]), scopes.InfoMate!, CATALOG_TABLES);
  return out;
}

type Readable = { name: string; workspaces: { name: string; hasRole: boolean; archived: boolean }[] }[];
type Read = { snapshots: { workspace: { id: string } }[] } | null;

const db: DevDb = catalogRows();
let tmp: string;
let local: Record<string, unknown>;

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "im-catalog-"));
  const file = path.join(tmp, "catalog-db.json");
  fs.writeFileSync(file, JSON.stringify(db));
  local = await catalogReads(createLocalDataStore(file, STORE_SCHEMA));
}, 120_000);

afterAll(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

describe("the catalog index on the local adapter (S39-02)", () => {
  const names = (key: string) => (local[key] as Readable).map((o) => [o.name, o.workspaces.map((w) => `${w.name}${w.hasRole ? "" : " (no role)"}${w.archived ? " (archived)" : ""}`)]);
  const ids = (key: string) => (local[key] as Read)?.snapshots.map((s) => s.workspace.id) ?? null;
  const bankX = db.workspace.find((w) => w.id === SEED_IDS.wsBankX)!.name;
  const retail = db.workspace.find((w) => w.id === SEED_IDS.wsRetailDwh)!.name;

  it("gives each member the workspaces with a role and the shown ones; a guest and an unlicensed organization nothing", () => {
    // Łukasz also owns the seed's "Performance test"
    expect(names("readable lukasz")).toEqual([["InfoMate", [`${bankX} (archived)`, "Catalog – hidden", "Catalog – shown", "Performance test", retail].sort()]]);
    expect(names("readable anna")).toEqual([["InfoMate", [`${bankX} (archived)`, "Catalog – shown (no role)", retail].sort()]]);
    expect(names("readable piotr")).toEqual([["InfoMate", [`${bankX} (no role) (archived)`, "Catalog – shown (no role)", retail].sort()]]);
    expect(names("readable kasia")).toEqual([]);
    expect(names("readable marek")).toEqual([]);
  });

  it("reads a scope's readable workspaces only, and answers null for one the person may not read", () => {
    expect(ids("read anna InfoMate")).toEqual((local["readable anna"] as { workspaces: { id: string }[] }[])[0]!.workspaces.map((w) => w.id));
    expect(ids("read anna hidden")).toBeNull();
    expect(ids("read lukasz hidden")).toEqual([HIDDEN]);
    expect(ids("read piotr Bank X")).toEqual([SEED_IDS.wsBankX]);
    expect(ids("read kasia Retail – DWH")).toBeNull();
    expect(ids("read kasia Sales analytics")).toBeNull();
    expect(ids("read marek Retail Co")).toBeNull();
  });

  it("reads nothing of an organization the session has not unlocked", () => {
    expect(local["readable lukasz, InfoMate locked"]).toEqual([]);
    expect(local["read lukasz InfoMate, InfoMate locked"]).toBeNull();
  });

  it("carries the model, requirements, cards and the asked module tables, but no frames, labels or change events", () => {
    const read = local["read lukasz Retail – DWH"] as { snapshots: { model: { entities: unknown[] }; requirements: unknown[]; canvasItems: unknown[]; frames: unknown[]; labels: unknown[]; modules: Record<string, unknown[]> }[] };
    const s = read.snapshots[0]!;
    expect(s.model.entities.length).toBeGreaterThan(0);
    expect(s.requirements.length).toBeGreaterThan(0);
    expect(s.canvasItems.length).toBeGreaterThan(0);
    expect(s.frames).toEqual([]);
    expect(s.labels).toEqual([]);
    expect(Object.keys(s.modules).sort()).toEqual([...CATALOG_TABLES].sort());
  });
});

const CONTRACT_DB = process.env.INFOMAPPER_CONTRACT_DB;

/** The catalog's own database on the contract server, made when missing. */
async function catalogDatabase(): Promise<string> {
  assertLocalDatabase(CONTRACT_DB!);
  const url = new URL(CONTRACT_DB!);
  const name = `${url.pathname.slice(1)}_catalog`;
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

describe.runIf(!!CONTRACT_DB)("the catalog index on Postgres: the same as the local adapter's (S39-06)", () => {
  let pg: Record<string, unknown>;
  let store: DataStore | null = null;

  beforeAll(async () => {
    const url = await catalogDatabase();
    await preparePostgres(url, db);
    process.env.INFOMAPPER_DATABASE_URL = url;
    store = createPostgresDataStore(STORE_SCHEMA);
    pg = await catalogReads(store);
  }, 300_000);

  afterAll(async () => {
    if (store) await getPool().end();
  });

  it("gives every catalog read the local adapter's answer", () => {
    expect(Object.keys(pg).sort()).toEqual(Object.keys(local).sort());
    for (const name of Object.keys(local)) expect.soft(pg[name], name).toEqual(local[name]);
  });
});
