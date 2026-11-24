// Slice 35 (step 1's Q4, F2, F7): the local adapter keeps each baseline's content in a file of its own beside the data
// file, written before its row; the rows and the data file never carry it; an older file without baselines reads as
// having none and is not written back; a reset empties the folder.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORE_SCHEMA } from "@/compose/tables";
import { baselineContentNow } from "@/compose/baselines";
import { addSeedDemoData, DEMO_BASELINE } from "@/compose/seed";
import { resetDevData } from "@/data/local/dev-data";
import { baselineFolder, readDb } from "@/data/local/file";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import { createLocalDataStore } from "@/data/local/store";
import { buildWriteSet } from "@/domain/changes";
import { createBaseline, renameBaseline } from "@/domain/commands/baseline";
import type { Write } from "@/domain/changes";

const RETAIL = SEED_IDS.wsRetailDwh;
const LUKASZ = SEED_IDS.userLukasz;
let dir: string;
let file: string;
const ctx = () => {
  let n = 0;
  return { actorId: LUKASZ, now: "2026-11-24T10:00:00.000Z", newId: () => `01a1c035-0000-7000-8000-${String(++n).padStart(12, "0")}` };
};

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "im-baselines-"));
  file = path.join(dir, "db.json");
  await resetDevData(file, addSeedDemoData);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("the local adapter's baselines", () => {
  it("keeps the demo baseline's content in its own file, never in the data file or a row", async () => {
    expect(baselineFolder(file)).toBe(path.join(dir, "db.baselines"));
    expect(fs.readdirSync(baselineFolder(file))).toEqual([`${DEMO_BASELINE.id}.json`]);
    const stored = JSON.parse(fs.readFileSync(file, "utf8")) as { baseline: Record<string, unknown>[] };
    expect(stored.baseline).toHaveLength(1);
    expect(stored.baseline[0]).not.toHaveProperty("snapshot");
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const [row] = await store.baselines.list(RETAIL);
    expect(row).toMatchObject({ id: DEMO_BASELINE.id, name: "Stage 1 sign-off", snapshot_schema: 1 });
    expect(row).not.toHaveProperty("snapshot");
    expect((await store.baselines.content(RETAIL, DEMO_BASELINE.id))?.model.entities.length).toBeGreaterThan(0);
  });

  it("writes a new baseline's content before its row; a rename never rewrites it; an update carrying one is refused", async () => {
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const access = { workspace: (await store.workspaces.get(RETAIL))!, member: await store.workspaces.getMember(RETAIL, LUKASZ) };
    const content = (await baselineContentNow(store, RETAIL))!;
    const made = createBaseline(ctx(), access, { baselines: await store.baselines.listAll(RETAIL) }, content, { workspaceId: RETAIL, name: "Stage 2" });
    if (!made.ok) throw new Error(made.error.message);
    expect(await store.apply(made.writeSet)).toEqual({ ok: true });
    const id = made.value.baseline.id;
    const at = path.join(baselineFolder(file), `${id}.json`);
    const written = fs.statSync(at).mtimeMs;
    expect((await store.baselines.list(RETAIL)).map((b) => b.name)).toEqual(["Stage 2", "Stage 1 sign-off"]);
    const events = (await store.changeEvents.list(RETAIL)).filter((e) => e.object_type === "baseline");
    expect(events.map((e) => e.operation)).toEqual(["create"]);
    expect(events[0]!.after_image).not.toHaveProperty("snapshot");

    const b = (await store.baselines.get(RETAIL, id))!;
    const renamed = renameBaseline(ctx(), access, { baselines: await store.baselines.listAll(RETAIL) }, b, { baselineId: id, expectedVersion: 1, name: "Stage 2b" });
    if (!renamed.ok) throw new Error(renamed.error.message);
    expect(await store.apply(renamed.writeSet)).toEqual({ ok: true });
    expect(fs.statSync(at).mtimeMs).toBe(written);
    expect(await store.baselines.content(RETAIL, id)).toEqual(content);

    const now = (await store.baselines.get(RETAIL, id))!;
    const rewrite = { kind: "update", table: "baseline", before: now, row: { ...now, version: now.version + 1, snapshot: content } } as unknown as Write;
    expect(await store.apply(buildWriteSet(ctx(), RETAIL, [rewrite]))).toMatchObject({ ok: false, error: { code: "invalid", message: "A baseline's content never changes." } });
  });

  it("reads a file without baselines (an older format) as having none and does not write it back", async () => {
    const plain = path.join(dir, "older.json");
    const db = buildSeed() as unknown as Record<string, unknown>;
    delete db.baseline;
    fs.writeFileSync(plain, JSON.stringify(db));
    const before = fs.statSync(plain).mtimeMs;
    expect((await readDb(plain)).baseline).toEqual([]);
    expect(fs.statSync(plain).mtimeMs).toBe(before);
    expect(fs.existsSync(baselineFolder(plain))).toBe(false);
  });

  it("moves a content written into the data file to its own file; a reset empties the folder", async () => {
    const inline = path.join(dir, "inline.json");
    const db = buildSeed();
    addSeedDemoData(db);
    fs.writeFileSync(inline, JSON.stringify(db));
    const store = createLocalDataStore(inline, STORE_SCHEMA);
    expect((await store.baselines.list(RETAIL))[0]).not.toHaveProperty("snapshot");
    expect(await store.baselines.content(RETAIL, DEMO_BASELINE.id)).not.toBeNull();
    fs.writeFileSync(path.join(baselineFolder(file), "stray.txt"), "x");
    await resetDevData(file);
    expect(fs.existsSync(baselineFolder(file))).toBe(false);
  });
});
