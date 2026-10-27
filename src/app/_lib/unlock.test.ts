import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DataStore } from "@/data";
import { seedDevData } from "@/data/local/dev-data";
import { SEED_IDS } from "@/data/local/seed";
import { createLocalDataStore } from "@/data/local/store";
import { buildWriteSet } from "@/domain/changes";
import { createOrganizationForUser } from "@/domain/commands/organization";
import { createProject } from "@/domain/commands/project";
import { createWorkspace } from "@/domain/commands/workspace";
import { uuidv7 } from "@/domain/ids";
import { lockedRefusal, organizationOfWrite } from "./unlock";

let dir: string;
let store: DataStore;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-unlock-"));
  const file = path.join(dir, "dev-db.json");
  await seedDevData(file);
  store = createLocalDataStore(file);
});
afterEach(async () => rm(dir, { recursive: true, force: true }));

const ctx = () => ({ actorId: SEED_IDS.userLukasz, now: new Date().toISOString(), newId: () => uuidv7() });

describe("the lock (slice 8, P4, F3)", () => {
  it("refuses an organization this session has not unlocked, naming it", async () => {
    expect(await lockedRefusal(store, new Set([SEED_IDS.orgInfoMate]), SEED_IDS.orgInfoMate)).toBeNull();
    expect(await lockedRefusal(store, new Set([SEED_IDS.orgInfoMate]), SEED_IDS.orgRetailCo)).toEqual({
      ok: false,
      code: "forbidden",
      message: "Unlock Retail Co first: open it and enter its password.",
    });
  });

  it("finds the organization a write goes into: a workspace's, a new workspace's, or none for a new organization", async () => {
    const ws = (await store.workspaces.listForUser(SEED_IDS.userLukasz)).find((w) => w.organization_id === SEED_IDS.orgInfoMate)!;
    const access = { workspace: ws, member: await store.workspaces.getMember(ws.id, SEED_IDS.userLukasz) };
    const project = createProject(ctx(), access, { workspaceId: ws.id, name: "X" });
    if (!project.ok) throw new Error(project.error.message);
    expect(await organizationOfWrite(store, project.writeSet)).toBe(SEED_IDS.orgInfoMate);

    const organization = await store.organizations.get(SEED_IDS.orgRetailCo);
    const member = { organization_id: SEED_IDS.orgRetailCo, user_id: SEED_IDS.userLukasz, role: "member" as const, created_at: "" };
    const workspace = createWorkspace(ctx(), { organization, organizationMember: member }, { organizationId: SEED_IDS.orgRetailCo, name: "Y" });
    if (!workspace.ok) throw new Error(workspace.error.message);
    expect(await organizationOfWrite(store, workspace.writeSet)).toBe(SEED_IDS.orgRetailCo);

    const user = await store.users.get(SEED_IDS.userLukasz);
    const created = createOrganizationForUser(ctx(), { user }, { organizationName: "Z", workspaceName: "W", accessHash: "scrypt$x" });
    if (!created.ok) throw new Error(created.error.message);
    expect(await organizationOfWrite(store, created.writeSet)).toBe("new");

    expect(await organizationOfWrite(store, buildWriteSet(ctx(), ws.id, []))).toBeNull();
  });
});
