import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildWriteSet, type CommandContext } from "@/domain/changes";
import { createOrganization } from "@/domain/commands/organization";
import { addPerson, changeRole, removePerson } from "@/domain/commands/people";
import { STALE_VERSION_MESSAGE } from "@/domain/errors";
import { uuidv7 } from "@/domain/ids";
import type { DataStore } from "../ports";
import { DEMO_PASSWORD_HASH } from "./demo-password";
import { seedDevData } from "./dev-data";
import { readDb, writeDb } from "./file";
import { DEV_DB_FORMAT } from "./schema";
import { SEED_IDS } from "./seed";
import { createLocalDataStore } from "./store";

let dir: string;
let file: string;
let store: DataStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-org-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
  store = createLocalDataStore(file);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

const ctxFor = (actorId: string): CommandContext => ({ actorId, now: new Date().toISOString(), newId: () => uuidv7() });

async function workspaceNamed(name: string) {
  const ws = (await readDb(file)).workspace.find((w) => w.name === name);
  if (!ws) throw new Error(name);
  return ws;
}

describe("organization access (slice 8, F5, F7)", () => {
  it("the seed gives every organization the precomputed demo-pass hash, with no change events", async () => {
    const db = await readDb(file);
    expect(db.format).toBe(10);
    expect(db.organization_access.map((a) => [a.organization_id, a.access_hash])).toEqual(
      db.organization.map((o) => [o.id, DEMO_PASSWORD_HASH]),
    );
    expect(db.change_event).toEqual([]);
    expect((await store.organizations.getAccess(SEED_IDS.orgInfoMate))?.access_hash).toBe(DEMO_PASSWORD_HASH);
  });

  it("an organization read never carries the hash", async () => {
    const org = await store.organizations.get(SEED_IDS.orgInfoMate);
    expect(JSON.stringify(org)).not.toContain("scrypt");
    expect(JSON.stringify(await store.organizations.listForUser(SEED_IDS.userLukasz))).not.toContain("scrypt");
  });

  it("refuses a stale update of the access row", async () => {
    const before = (await store.organizations.getAccess(SEED_IDS.orgInfoMate))!;
    const ws = await workspaceNamed("Retail Co – DWH");
    const write = (row: typeof before) => buildWriteSet(ctxFor(SEED_IDS.userLukasz), ws.id, [{ kind: "update", table: "organization_access", before, row }]);
    expect(await store.apply(write({ ...before, access_hash: "scrypt$x", version: 2 }))).toEqual({ ok: true });
    expect(await store.apply(write({ ...before, access_hash: "scrypt$y", version: 2 }))).toMatchObject({ ok: false, error: { message: STALE_VERSION_MESSAGE } });
    const events = await store.changeEvents.list(ws.id);
    expect(JSON.stringify(events)).not.toContain("scrypt");
  });
});

describe("the format 9 upgrade (slice 8, item 18, S8-14)", () => {
  it("gives every organization without a password demo-pass, writes no change event and logs one line without secrets", async () => {
    const db = await readDb(file);
    const old = { ...db, format: 8, organization_access: undefined } as unknown as typeof db;
    await writeFile(file, JSON.stringify(old), "utf8");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const upgraded = await readDb(file);
    expect(upgraded.format).toBe(DEV_DB_FORMAT);
    expect(upgraded.organization_access.map((a) => a.access_hash)).toEqual([DEMO_PASSWORD_HASH, DEMO_PASSWORD_HASH]);
    expect(upgraded.change_event).toEqual(db.change_event);
    expect(log.mock.calls).toEqual([["Slice 8 upgrade: 2 organizations got the development password (see README)."]]);
    // nothing else changed
    const without = (d: typeof db) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== "organization_access" && k !== "format"));
    expect(without(upgraded)).toEqual(without(db));
    // written back at once: the next read logs nothing
    log.mockClear();
    await readDb(file);
    expect(log).not.toHaveBeenCalled();
    expect(JSON.parse(await readFile(file, "utf8")).format).toBe(10);
  });

  it("keeps an organization's existing password", async () => {
    const db = await readDb(file);
    db.organization_access = db.organization_access.filter((a) => a.organization_id !== SEED_IDS.orgRetailCo);
    db.organization_access[0]!.access_hash = "scrypt$own";
    await writeFile(file, JSON.stringify({ ...db, format: 8 }), "utf8");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const upgraded = await readDb(file);
    expect(upgraded.organization_access.find((a) => a.organization_id === SEED_IDS.orgInfoMate)?.access_hash).toBe("scrypt$own");
    expect(upgraded.organization_access.find((a) => a.organization_id === SEED_IDS.orgRetailCo)?.access_hash).toBe(DEMO_PASSWORD_HASH);
  });
});

describe("people rows through the adapter (slice 8, F4)", () => {
  it("creates an organization end to end, and refuses a second account with the same e-mail", async () => {
    const ctx = ctxFor(uuidv7());
    const input = { organizationName: "Test Org", name: "Jan Test", email: "jan@example.com", workspaceName: "First workspace", accessHash: "scrypt$h" };
    const r = createOrganization(ctx, { accountWithEmail: null }, input);
    if (!r.ok) throw new Error(r.error.message);
    expect(await store.apply(r.writeSet)).toEqual({ ok: true });
    expect((await store.users.getByEmail("jan@example.com"))?.display_name).toBe("Jan Test");
    expect((await store.organizations.getAccess(r.value.organizationId))?.access_hash).toBe("scrypt$h");

    // a race on the same e-mail: the unique index refuses the second
    const again = createOrganization(ctxFor(uuidv7()), { accountWithEmail: null }, input);
    if (!again.ok) throw new Error(again.error.message);
    expect(await store.apply(again.writeSet)).toMatchObject({ ok: false, error: { code: "conflict" } });
  });

  it("adds a person, then removes them with their organization row from their last workspace", async () => {
    const ws = await workspaceNamed("Retail Co – DWH");
    const access = { workspace: ws, member: await store.workspaces.getMember(ws.id, SEED_IDS.userLukasz) };
    const organization = await store.organizations.get(ws.organization_id);
    const added = addPerson(ctxFor(SEED_IDS.userLukasz), { access, organization, account: null, accountOrganizationMember: null, accountWorkspaceIds: [] }, {
      workspaceId: ws.id,
      name: "Jan Test",
      email: "jan@example.com",
      role: "reader",
    });
    if (!added.ok) throw new Error(added.error.message);
    expect(await store.apply(added.writeSet)).toEqual({ ok: true });
    const jan = (await store.users.getByEmail("jan@example.com"))!;

    const removed = removePerson(
      ctxFor(SEED_IDS.userLukasz),
      {
        access,
        person: jan,
        members: await store.workspaces.listMembers(ws.id),
        organization,
        personOrganizationMember: await store.organizations.getMember(ws.organization_id, jan.id),
        personOtherWorkspaceIds: [],
      },
      { workspaceId: ws.id, userId: jan.id },
    );
    if (!removed.ok) throw new Error(removed.error.message);
    expect(await store.apply(removed.writeSet)).toEqual({ ok: true });
    expect(await store.workspaces.getMember(ws.id, jan.id)).toBeNull();
    expect(await store.organizations.getMember(ws.organization_id, jan.id)).toBeNull();
    // the account stays; Jan did nothing in the workspace, so its pages no longer name him (F10)
    expect(await store.users.getByEmail("jan@example.com")).not.toBeNull();
    expect((await store.users.listForWorkspace(ws.id)).map((u) => u.email)).not.toContain("jan@example.com");
  });
});

describe("the people a workspace may name (slice 8, F10)", () => {
  it("lists the workspace's members and authors only, never another organization's people", async () => {
    const ws = await workspaceNamed("Sales analytics");
    const names = (await store.users.listForWorkspace(ws.id)).map((u) => u.id);
    const members = (await store.workspaces.listMembers(ws.id)).map((m) => m.user_id);
    expect(new Set(names)).toEqual(new Set(members));
    const all = await store.users.list();
    expect(names.length).toBeLessThan(all.length);
  });
});

describe("writing a whole file keeps the new table", () => {
  it("round-trips organization_access", async () => {
    const db = await readDb(file);
    await writeDb(file, structuredClone(db));
    expect((await readDb(file)).organization_access).toEqual(db.organization_access);
  });
});

describe("the last owner under concurrent writes (slice 8, step 5's answer)", () => {
  const { userLukasz: lukasz, userAnna: anna, wsRetailDwh: ws } = SEED_IDS;

  /** Retail Co – DWH with two owners, Łukasz and Anna; the state each of them reads before writing. */
  async function twoOwners() {
    const before = await stateOf(lukasz);
    const made = changeRole(ctxFor(lukasz), before, { workspaceId: ws, userId: anna, role: "owner" });
    if (!made.ok) throw new Error(made.error.message);
    expect(await store.apply(made.writeSet)).toEqual({ ok: true });
  }

  async function stateOf(actor: string, personId = actor === lukasz ? anna : lukasz) {
    const workspace = (await store.workspaces.get(ws))!;
    const person = (await store.users.get(personId))!;
    const organization = await store.organizations.get(workspace.organization_id);
    return {
      access: { workspace, member: await store.workspaces.getMember(ws, actor) },
      person,
      members: await store.workspaces.listMembers(ws),
      organization,
      personOrganizationMember: await store.organizations.getMember(workspace.organization_id, person.id),
      personOtherWorkspaceIds: (await store.workspaces.listForUser(person.id)).filter((w) => w.organization_id === workspace.organization_id && w.id !== ws).map((w) => w.id),
    };
  }

  const owners = async () => (await readDb(file)).workspace_member.filter((m) => m.workspace_id === ws && m.role === "owner").map((m) => m.user_id);

  it("two owners removing each other at once: one removal goes through, the other is refused, one owner stays", async () => {
    await twoOwners();
    // both read before either writes: each sees two owners
    const [byLukasz, byAnna] = [await stateOf(lukasz), await stateOf(anna)];
    const a = removePerson(ctxFor(lukasz), byLukasz, { workspaceId: ws, userId: anna });
    const b = removePerson(ctxFor(anna), byAnna, { workspaceId: ws, userId: lukasz });
    if (!a.ok || !b.ok) throw new Error("both removals pass the domain's check");
    const results = await Promise.all([store.apply(a.writeSet), store.apply(b.writeSet)]);
    expect(results).toEqual([{ ok: true }, { ok: false, error: expect.objectContaining({ code: "invalid", message: "Retail Co – DWH needs at least one owner." }) }]);
    expect(await owners()).toEqual([lukasz]);
  });

  it("two owners demoting each other at once: one owner stays", async () => {
    await twoOwners();
    const [byLukasz, byAnna] = [await stateOf(lukasz), await stateOf(anna)];
    const a = changeRole(ctxFor(lukasz), byLukasz, { workspaceId: ws, userId: anna, role: "admin" });
    const b = changeRole(ctxFor(anna), byAnna, { workspaceId: ws, userId: lukasz, role: "admin" });
    if (!a.ok || !b.ok) throw new Error("both changes pass the domain's check");
    const results = await Promise.all([store.apply(b.writeSet), store.apply(a.writeSet)]);
    expect(results[0]).toEqual({ ok: true });
    expect(results[1]).toMatchObject({ ok: false, error: { message: "Retail Co – DWH needs at least one owner." } });
    expect(await owners()).toEqual([anna]);
  });
});
