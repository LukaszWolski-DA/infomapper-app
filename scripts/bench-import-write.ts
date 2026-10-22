// Benchmark (slice 7a, step 4; PRD section 6; not part of `npm test`): an import's write through the local adapter
// with its change events, its undo, and a card move after three large imports, at 20,000 and 100,000 column rows.
// Each write runs the server's steps (runCommand without Next.js): read the state from the store, the domain command,
// the live canvas rules (`completeLiveWrites`), the adapter (`apply`, which writes the whole data file), the undo
// history. On copies of the demo data in .data/measure/import-bench/ (git-ignored), never on dev-db.json.
// One warm-up, then 5 rounds; median, fastest, slowest. Run: npx tsx scripts/bench-import-write.ts [20000|100000]

import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { readDbCached, writeDb } from "../src/data/local/file";
import { buildSeed, SEED_IDS, SEED_USERS } from "../src/data/local/seed";
import { createLocalDataStore } from "../src/data/local/store";
import type { DataStore } from "../src/data/ports";
import type { CommandContext, CommandResult, WriteSet } from "../src/domain/changes";
import { importSources, importStateOf } from "../src/domain/commands/import";
import { completeLiveWrites, touchesLiveCanvases } from "../src/domain/commands/live";
import { moveOnCanvas } from "../src/domain/commands/frame";
import { revertChangeGroup } from "../src/domain/commands/undo";
import { planFingerprint } from "../src/domain/import/compare";
import { buildPlan, importSummary, type ImportTarget } from "../src/domain/import/plan";
import { readStandard } from "../src/domain/import/standard";
import { uuidv7 } from "../src/domain/ids";
import { changeLabel } from "../src/domain/model/change-label";
import { afterUndo, nextUndo, recordChange } from "../src/domain/model/undo-history";
import type { WorkspaceAccess } from "../src/domain/permissions";
import { fivePercent, syntheticStandard } from "./lib/import-synthetic";

const ROUNDS = 5;
const DIR = path.resolve(".data", "measure", "import-bench");
const WS = SEED_IDS.wsRetailDwh;
const USER = SEED_USERS.lukasz.id;
const ms = (v: number) => `${Math.round(v).toLocaleString("en-GB")} ms`;
const mb = async (file: string) => `${((await stat(file)).size / 1e6).toFixed(0)} MB`;

async function accessOf(store: DataStore): Promise<WorkspaceAccess> {
  const workspace = (await store.workspaces.get(WS))!;
  return { workspace, member: await store.workspaces.getMember(WS, USER) };
}

/** runCommand's steps for one write. */
async function serverWrite<T>(store: DataStore, build: (ctx: CommandContext, access: WorkspaceAccess) => Promise<CommandResult<T>>, revert = false): Promise<WriteSet> {
  const ctx: CommandContext = { actorId: USER, now: new Date().toISOString(), newId: () => uuidv7() };
  const access = await accessOf(store);
  const result = await build(ctx, access);
  if (!result.ok) throw new Error(result.error.message);
  let writeSet = result.writeSet;
  if (touchesLiveCanvases(writeSet.writes)) {
    const [model, labels, labelLinks, canvases, canvasItems, frames, notes] = await Promise.all([
      store.model.load(WS), store.labels.list(WS), store.labels.listLinks(WS), store.canvases.list(WS), store.canvasItems.list(WS), store.frames.list(WS), store.notes.list(WS),
    ]);
    const completed = completeLiveWrites(ctx, access, { ...model, labels, labelLinks, canvases, canvasItems, frames, notes }, writeSet, { revert });
    if (!completed.ok) throw new Error(completed.error.message);
    writeSet = completed.writeSet;
  }
  const applied = await store.apply(writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return writeSet;
}

async function importFile(store: DataStore, text: string, target: ImportTarget, name: string): Promise<WriteSet> {
  const writeSet = await serverWrite(store, async (ctx, access) => {
    const state = importStateOf(await store.model.load(WS));
    const read = readStandard(text, name);
    const scope = read.tables.map((t) => t.key);
    const plan = buildPlan(state.model, read, target, { scope: new Set(scope), compare: "schemas", renames: new Map() });
    return importSources(ctx, access, state, { target, channel: "file", sourceLabel: name, text, scope, compare: "schemas", renames: [], fingerprint: planFingerprint(plan) });
  });
  await store.undoHistory.update(WS, USER, (h) => recordChange(h, { changeGroupId: writeSet.changeGroupId, label: changeLabel(writeSet.events), events: writeSet.events }));
  return writeSet;
}

async function undoLast(store: DataStore): Promise<void> {
  const step = nextUndo(await store.undoHistory.get(WS, USER))!;
  const writeSet = await serverWrite(store, async (ctx, access) => revertChangeGroup(ctx, access, { events: step.events, rows: await store.model.loadForUndo(WS) }, "undo"), true);
  await store.undoHistory.update(WS, USER, (h) => afterUndo(h, { changeGroupId: writeSet.changeGroupId, label: step.label, events: writeSet.events }));
}

async function moveACard(store: DataStore, dx: number): Promise<void> {
  await serverWrite(store, async (ctx, access) => {
    const canvasId = SEED_IDS.canvasCustomerOrders;
    const [canvas, frames, items, notes, model] = await Promise.all([
      store.canvases.get(WS, canvasId), store.frames.listOfCanvas(WS, canvasId), store.canvasItems.listOfCanvas(WS, canvasId), store.notes.listOfCanvas(WS, canvasId), store.model.load(WS),
    ]);
    const card = items[0]!;
    return moveOnCanvas(ctx, access, { canvas, frames, items, notes, entities: model.entities, concepts: model.concepts }, {
      canvasId,
      frames: [],
      items: [{ canvasItemId: card.id, expectedVersion: card.version, x: card.x + dx, y: card.y, height: 200 }],
    });
  });
}

const median = (times: number[]) => [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)]!;
const report = (label: string, bar: number, times: number[]) => {
  const s = [...times].sort((a, b) => a - b);
  const m = median(times);
  console.log(`  ${label}: median ${ms(m)}, fastest ${ms(s[0]!)}, slowest ${ms(s.at(-1)!)}; bar ${ms(bar)} ${m <= bar ? "met" : "MISSED"}`);
};
const timed = async (run: () => Promise<unknown>) => {
  const t = performance.now();
  await run();
  return performance.now() - t;
};

async function main() {
  const sizes = process.argv[2] ? [Number(process.argv[2])] : [20_000, 100_000];
  await mkdir(DIR, { recursive: true });
  const base = path.join(DIR, "base.json");
  await writeDb(base, buildSeed());
  for (const columns of sizes) {
    const tables = columns / 10;
    const first = syntheticStandard(tables);
    const changed = syntheticStandard(tables, undefined, fivePercent);
    console.log(`\n${columns.toLocaleString("en-GB")} columns (${tables.toLocaleString("en-GB")} tables); the demo data around them`);
    const t = { first: [] as number[], again: [] as number[], undoAgain: [] as number[], undoFirst: [] as number[] };
    for (let round = 0; round <= (process.env.ONLY_MOVE === "1" ? -1 : ROUNDS); round++) {
      const file = path.join(DIR, `work-${columns}.json`);
      await copyFile(base, file);
      const store = createLocalDataStore(file);
      const a = await timed(() => importFile(store, first, { newName: "Synth" }, "synthetic.csv"));
      const system = (await store.model.load(WS)).sourceSystems.find((s) => s.name === "Synth")!.id;
      let summary = "";
      const b = await timed(async () => {
        const ws = await importFile(store, changed, { systemId: system }, "synthetic-changed.csv");
        summary = importSummary(ws.writes.filter((w) => w.table === "source_import").map((w) => w.row as never)[0]!);
      });
      const fileSize = await mb(file);
      const c = await timed(() => undoLast(store));
      const d = await timed(() => undoLast(store));
      if (round === 0) {
        console.log(`  the re-import: ${summary}; the data file after both imports: ${fileSize}`);
        continue; // the warm-up
      }
      t.first.push(a);
      t.again.push(b);
      t.undoAgain.push(c);
      t.undoFirst.push(d);
    }
    if (process.env.ONLY_MOVE !== "1") {
    report("first import (every row new), with change events", 5_000, t.first);
    report("re-import, 5 % changed, renamed or missing", 5_000, t.again);
    report("undo the re-import", 5_000, t.undoAgain);
    report("undo the first import", 5_000, t.undoFirst);
    }

    // a card move after three large imports (step 1, F10)
    const file = path.join(DIR, `three-${columns}.json`);
    await copyFile(base, file);
    const store = createLocalDataStore(file);
    for (const n of [1, 2, 3]) await importFile(store, first, { newName: `Synth ${n}` }, `synthetic-${n}.csv`);
    console.log(`  after three imports the data file is ${await mb(file)}`);
    {
      const db = await readDbCached(file);
      const t0 = performance.now();
      const events = JSON.stringify(db.change_event).length;
      const t1 = performance.now();
      const all = JSON.stringify(db).length;
      const t2 = performance.now();
      console.log(`    of it change events ${(events / 1e6).toFixed(0)} MB (${db.change_event.length.toLocaleString("en-GB")}), the rest ${((all - events) / 1e6).toFixed(0)} MB; stringify all ${ms(t2 - t1)}, events ${ms(t1 - t0)}`);
    }
    await moveACard(store, 8); // warm-up
    const moves: number[] = [];
    for (let i = 0; i < ROUNDS; i++) moves.push(await timed(() => moveACard(store, i % 2 ? 8 : -8)));
    report("move a card after three large imports", 500, moves);
  }
  await rm(DIR, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
