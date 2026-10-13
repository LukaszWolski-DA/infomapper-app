// Two people create a requirement at the same moment (slice 4a, step 1 point 1): both succeed with different keys,
// because the write that finds the key counter changed is built again from what is stored now.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ApplyResult, DataStore } from "@/data/ports";
import { seedDevData } from "@/data/local/dev-data";
import { SEED_IDS } from "@/data/local/seed";
import { createLocalDataStore } from "@/data/local/store";
import type { CommandContext } from "@/domain/changes";
import { createRequirement } from "@/domain/commands/requirement";
import { updateWorkspaceSettings } from "@/domain/commands/workspace";
import { uuidv7 } from "@/domain/ids";
import type { Requirement, Workspace } from "@/domain/types";
import { retryWhenStale } from "./fresh-retry";

let dir: string;
let store: DataStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-fresh-"));
  const file = path.join(dir, "dev-db.json");
  await seedDevData(file);
  store = createLocalDataStore(file);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const RETAIL = SEED_IDS.wsRetailDwh;
const ctxFor = (actorId: string): CommandContext => ({ actorId, now: new Date().toISOString(), newId: () => uuidv7() });

/** What the server reads for a create: the workspace (with the counter) and the requirements. */
async function snapshot(userId: string) {
  return {
    access: { workspace: (await store.workspaces.get(RETAIL))!, member: await store.workspaces.getMember(RETAIL, userId) },
    requirements: await store.requirements.list(RETAIL),
  };
}

/** One create as the server runs it: from `first` on the first try (read before the other person's write), fresh after. */
function creator(userId: string, first: Awaited<ReturnType<typeof snapshot>>) {
  let tries = 0;
  let made: Requirement | null = null;
  const attempt = async (): Promise<ApplyResult> => {
    const s = tries++ === 0 ? first : await snapshot(userId);
    const r = createRequirement(ctxFor(userId), s.access, { requirements: s.requirements }, {});
    if (!r.ok) return { ok: false, error: r.error };
    made = r.value.requirement;
    return store.apply(r.writeSet);
  };
  return { attempt, tries: () => tries, made: () => made };
}

const stale = (r: ApplyResult) => !r.ok && r.error.code === "stale_version";

describe("the requirement key counter under two creates at the same moment", () => {
  it("without a retry the second write is refused as stale (the counter changed)", async () => {
    const [a, b] = await Promise.all([snapshot(SEED_IDS.userAnna), snapshot(SEED_IDS.userLukasz)]);
    expect(await creator(SEED_IDS.userAnna, a).attempt()).toEqual({ ok: true });
    expect(await creator(SEED_IDS.userLukasz, b).attempt()).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });

  it("with the retry both succeed, with different keys and the counter raised twice", async () => {
    const [a, b] = await Promise.all([snapshot(SEED_IDS.userAnna), snapshot(SEED_IDS.userLukasz)]);
    const anna = creator(SEED_IDS.userAnna, a);
    const lukasz = creator(SEED_IDS.userLukasz, b);
    const results = await Promise.all([retryWhenStale(anna.attempt, stale), retryWhenStale(lukasz.attempt, stale)]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect([anna.made()!.key, lukasz.made()!.key].sort()).toEqual(["REQ-106", "REQ-107"]);
    expect(anna.tries() + lukasz.tries()).toBe(3);
    expect((await store.workspaces.get(RETAIL))!.requirement_key_next).toBe(108);
  });

  it("a settings dialog opened before the create is refused as stale", async () => {
    const owner = { workspace: (await store.workspaces.get(RETAIL))!, member: await store.workspaces.getMember(RETAIL, SEED_IDS.userLukasz) };
    expect(await retryWhenStale(creator(SEED_IDS.userAnna, await snapshot(SEED_IDS.userAnna)).attempt, stale)).toEqual({ ok: true });
    const ws: Workspace = owner.workspace;
    const settings = updateWorkspaceSettings(ctxFor(SEED_IDS.userLukasz), owner, { workspaceId: RETAIL, expectedVersion: ws.version, name: "Retail Co – DWH 2" });
    expect(settings.ok && (await store.apply(settings.writeSet))).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });

  it("gives up after three tries", async () => {
    let calls = 0;
    const always = async (): Promise<ApplyResult> => (calls++, { ok: false, error: { code: "stale_version", message: "x" } });
    expect(await retryWhenStale(always, stale)).toMatchObject({ ok: false });
    expect(calls).toBe(3);
  });
});
