import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DataStore } from "@/data";
import { seedDevData } from "@/data/local/dev-data";
import { SEED_IDS } from "@/data/local/seed";
import { createLocalDataStore } from "@/data/local/store";
import { buildWriteSet } from "@/domain/changes";
import { createProject } from "@/domain/commands/project";
import { uuidv7 } from "@/domain/ids";
import { workspacePeople } from "./people";

let dir: string;
let store: DataStore;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-people-"));
  const file = path.join(dir, "dev-db.json");
  await seedDevData(file);
  store = createLocalDataStore(file);
});
afterEach(async () => rm(dir, { recursive: true, force: true }));

const ids = async (workspaceId: string) => (await workspacePeople(store, workspaceId)).map((u) => u.id).sort();

describe("the people a workspace's pages receive (slice 8, F10, D-58)", () => {
  it("are the workspace's members, never a user of another organization", async () => {
    // Sales analytics (Retail Co): Marek and the guest Łukasz; Anna and Piotr are InfoMate's only
    const sales = await ids(SEED_IDS.wsSales);
    expect(sales).toEqual((await store.workspaces.listMembers(SEED_IDS.wsSales)).map((m) => m.user_id).sort());
    expect(sales).not.toContain(SEED_IDS.userAnna);
    expect(sales).not.toContain(SEED_IDS.userPiotr);
    // Bank X (InfoMate) never names Retail Co's owner
    expect(await ids(SEED_IDS.wsBankX)).not.toContain(SEED_IDS.userMarek);
  });

  it("keep a removed person whose work is in the workspace's history", async () => {
    const ws = (await store.workspaces.get(SEED_IDS.wsSales))!;
    const marek = await store.workspaces.getMember(ws.id, SEED_IDS.userMarek);
    const ctx = { actorId: SEED_IDS.userMarek, now: new Date().toISOString(), newId: () => uuidv7() };
    const project = createProject(ctx, { workspace: ws, member: marek }, { workspaceId: ws.id, name: "History" });
    if (!project.ok) throw new Error(project.error.message);
    expect(await store.apply(project.writeSet)).toEqual({ ok: true });
    // Marek leaves the workspace (test data: the row removed as removePerson does)
    const removal = buildWriteSet(ctx, ws.id, [{ kind: "remove", table: "workspace_member", before: marek! }]);
    expect(await store.apply(removal)).toEqual({ ok: true });
    expect(await ids(SEED_IDS.wsSales)).toContain(SEED_IDS.userMarek);
  });
});
